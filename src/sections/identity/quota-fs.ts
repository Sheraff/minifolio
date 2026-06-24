import { InMemoryFs, type BufferEncoding, type CpOptions, type FileContent, type FsStat, type InitialFiles, type MkdirOptions } from 'just-bash/browser'

export type QuotaFsOptions = {
	maxBytes: number
	maxFiles: number
}

type FsUsage = {
	bytes: number
	files: number
}

type FileEncodingOptions = {
	encoding?: BufferEncoding
}

const textEncoder = new TextEncoder()

export class QuotaFs extends InMemoryFs {
	private baseline: FsUsage | undefined
	private quota: QuotaFsOptions
	private suspendedChecks = 0

	constructor(initialFiles: InitialFiles, quota: QuotaFsOptions) {
		super(initialFiles)
		this.quota = quota
	}

	override async writeFile(path: string, content: FileContent, options?: FileEncodingOptions | BufferEncoding) {
		await this.assertCanWrite(path, getContentSize(content, options))
		await this.withSuspendedChecks(() => super.writeFile(path, content, options))
	}

	override async appendFile(path: string, content: FileContent, options?: FileEncodingOptions | BufferEncoding) {
		await this.assertCanAppend(path, getContentSize(content, options))
		await this.withSuspendedChecks(() => super.appendFile(path, content, options))
	}

	override async mkdir(path: string, options?: MkdirOptions) {
		await this.assertCanAddEntries(path, await this.missingEntryCount(path, options?.recursive === true ? 'path' : 'final'))
		await this.withSuspendedChecks(() => super.mkdir(path, options))
	}

	override async cp(src: string, dest: string, options?: CpOptions) {
		const usage = await this.measureCopyUsage(src, dest)
		await this.assertCanGrow(dest, usage.bytes, usage.files)
		await this.withSuspendedChecks(() => super.cp(src, dest, options))
	}

	override async mv(src: string, dest: string) {
		await this.withSuspendedChecks(() => super.mv(src, dest))
		await this.assertCurrentUsage(dest)
	}

	override async symlink(target: string, linkPath: string) {
		await this.assertCanAddEntries(linkPath, await this.missingEntryCount(linkPath, 'path'))
		await super.symlink(target, linkPath)
	}

	override async link(existingPath: string, newPath: string) {
		const [stat, missingEntries] = await Promise.all([
			this.lstat(existingPath),
			this.missingEntryCount(newPath, 'path'),
		])
		await this.assertCanGrow(newPath, stat.isFile ? stat.size : 0, missingEntries)
		await super.link(existingPath, newPath)
	}

	override writeFileSync(path: string, content: FileContent, options?: FileEncodingOptions | BufferEncoding, metadata?: { mode?: number, mtime?: Date }) {
		if (this.baseline && this.suspendedChecks === 0) throw quotaError(path)
		super.writeFileSync(path, content, options, metadata)
	}

	override mkdirSync(path: string, options?: MkdirOptions) {
		if (this.baseline && this.suspendedChecks === 0) throw quotaError(path)
		super.mkdirSync(path, options)
	}

	private async withSuspendedChecks(action: () => Promise<void>) {
		this.suspendedChecks++
		try {
			await action()
		}
		finally {
			this.suspendedChecks--
		}
	}

	private async assertCanWrite(path: string, bytes: number) {
		if (this.suspendedChecks > 0) return
		const [usage, oldSize, missingEntries] = await Promise.all([
			this.measureUsage(),
			this.fileSize(path),
			this.missingEntryCount(path, 'path'),
		])

		await this.assertUsage(path, {
			bytes: usage.bytes - oldSize + bytes,
			files: usage.files + missingEntries,
		})
	}

	private async assertCanAppend(path: string, bytes: number) {
		if (this.suspendedChecks > 0) return
		const [usage, missingEntries] = await Promise.all([
			this.measureUsage(),
			this.missingEntryCount(path, 'path'),
		])

		await this.assertUsage(path, {
			bytes: usage.bytes + bytes,
			files: usage.files + missingEntries,
		})
	}

	private async assertCanAddEntries(path: string, files: number) {
		await this.assertCanGrow(path, 0, files)
	}

	private async assertCanGrow(path: string, bytes: number, files: number) {
		if (this.suspendedChecks > 0) return
		const usage = await this.measureUsage()
		await this.assertUsage(path, {
			bytes: usage.bytes + bytes,
			files: usage.files + files,
		})
	}

	private async assertCurrentUsage(path: string) {
		await this.assertUsage(path, await this.measureUsage())
	}

	private async assertUsage(path: string, usage: FsUsage) {
		const baseline = await this.getBaseline()
		if (usage.bytes - baseline.bytes > this.quota.maxBytes || usage.files - baseline.files > this.quota.maxFiles) {
			throw quotaError(path)
		}
	}

	private async getBaseline() {
		this.baseline ??= await this.measureUsage()
		return this.baseline
	}

	private async measureUsage(): Promise<FsUsage> {
		let bytes = 0
		let files = 0

		await Promise.all(this.getAllPaths().map(async path => {
			if (path === '/') return
			files++
			try {
				const stat = await this.lstat(path)
				if (stat.isFile) bytes += stat.size
			}
			catch {
				// Ignore entries that disappear while a mutating command is running.
			}
		}))

		return { bytes, files }
	}

	private async measureCopyUsage(src: string, dest: string): Promise<FsUsage> {
		let srcStat: FsStat
		try {
			srcStat = await this.lstat(src)
		}
		catch {
			return { bytes: 0, files: 0 }
		}

		const target = await this.resolveCopyTarget(src, dest)
		const targetEntries = await this.missingEntryCount(target, 'path')

		if (!srcStat.isDirectory) return { bytes: srcStat.isFile ? srcStat.size : 0, files: targetEntries }

		const sourcePaths = this.getAllPaths().filter(path => path === src || path.startsWith(`${src}/`))
		let bytes = 0
		let files = targetEntries
		for (const path of sourcePaths) {
			const stat = await this.lstat(path)
			if (path !== src) files++
			if (stat.isFile) bytes += stat.size
		}

		return { bytes, files }
	}

	private async resolveCopyTarget(src: string, dest: string) {
		try {
			const stat = await this.stat(dest)
			if (stat.isDirectory) return joinPath(dest, basename(src))
		}
		catch {
			// Non-existent destination is handled by the underlying fs.
		}

		return dest
	}

	private async fileSize(path: string) {
		try {
			const stat = await this.lstat(path)
			return stat.isFile ? stat.size : 0
		}
		catch {
			return 0
		}
	}

	private async missingEntryCount(path: string, mode: 'final' | 'path') {
		const normalized = this.resolvePath('/', path)
		const parts = normalized.split('/').filter(Boolean)
		let count = 0
		let current = ''

		for (const [index, part] of parts.entries()) {
			current = joinPath(current || '/', part)
			if (mode === 'final' && index < parts.length - 1) continue
			if (!await this.exists(current)) count++
		}

		return count
	}
}

function getContentSize(content: FileContent, options?: FileEncodingOptions | BufferEncoding) {
	if (content instanceof Uint8Array) return content.byteLength
	const encoding = typeof options === 'string' ? options : options?.encoding
	if (encoding === 'binary' || encoding === 'latin1' || encoding === 'ascii') return content.length
	return textEncoder.encode(content).byteLength
}

function quotaError(path: string) {
	return new Error(`ENOSPC: no space left on virtual filesystem, write '${path}'`)
}

function joinPath(parent: string, child: string) {
	return parent === '/' ? `/${child}` : `${parent}/${child}`
}

function basename(path: string) {
	const normalized = normalizePath(path)
	return normalized.split('/').at(-1) || ''
}

function normalizePath(path: string) {
	const parts: string[] = []
	for (const segment of path.split('/')) {
		if (!segment || segment === '.') continue
		if (segment === '..') parts.pop()
		else parts.push(segment)
	}
	return `/${parts.join('/')}`
}
