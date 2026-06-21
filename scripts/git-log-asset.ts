import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Plugin } from "vite";

const execFileAsync = promisify(execFile);

export function gitLogAsset({
	environment = "client",
	fileName = "git-log.txt",
	maxCount = 10,
}: {
	/** which environment does this plugin apply to */
	environment?: string;
	/** output asset name */
	fileName?: string;
	/** number of commits to include */
	maxCount?: number;
} = {}): Plugin {
	return {
		name: "git-log-asset",
		apply: "build",
		applyToEnvironment(env) {
			return env.name === environment;
		},
		async buildStart() {
			const { stdout } = await execFileAsync("git", [
				"--no-pager",
				"log",
				"--no-color",
				`--max-count=${maxCount}`,
			], { maxBuffer: 1024 * 1024 });

			this.emitFile({
				type: "asset",
				fileName,
				source: stdout,
			});
		},
	};
}
