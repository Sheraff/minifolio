import { XMLParser } from 'fast-xml-parser'
import * as v from 'valibot'

const ONE_HOUR_MS = 60 * 60 * 1000
const TANSTACK_RSS_URL = 'https://tanstack.com/rss.xml'
const AUTHOR_MATCH = 'florian pellet'

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '',
	textNodeName: '#text',
	trimValues: true,
})

const tanstackArticleSchema = v.object({
	title: v.string(),
	link: v.string(),
	guid: v.string(),
	pubDate: v.string(),
	author: v.string(),
	description: v.string(),
	imageUrl: v.nullable(v.string()),
})

const tanstackArticlesResponseSchema = v.object({
	articles: v.array(tanstackArticleSchema),
})

type TanstackArticle = {
	title: string
	link: string
	guid: string
	pubDate: string
	author: string
	description: string
	imageUrl: string | null
}

type TanstackArticlesResponse = {
	articles: TanstackArticle[]
}

type ParsedTextValue = string | { '#text'?: unknown } | null | undefined

type ParsedRssItem = {
	title?: ParsedTextValue
	link?: ParsedTextValue
	guid?: ParsedTextValue
	pubDate?: ParsedTextValue
	author?: ParsedTextValue
	description?: ParsedTextValue
	enclosure?: {
		url?: unknown
	} | null
}

type ParsedRssFeed = {
	rss?: {
		channel?: {
			item?: ParsedRssItem | ParsedRssItem[]
		}
	}
}

let tanstackArticlesCache:
	| {
		data: TanstackArticlesResponse
		expiresAt: number
	}
	| undefined

let tanstackArticlesPromise: Promise<TanstackArticlesResponse> | undefined

async function loadTanstackArticles(): Promise<TanstackArticlesResponse> {
	if (tanstackArticlesCache && tanstackArticlesCache.expiresAt > Date.now()) {
		return tanstackArticlesCache.data
	}

	if (tanstackArticlesPromise) {
		return tanstackArticlesPromise
	}

	tanstackArticlesPromise = fetchTanstackArticlesFromRss()

	try {
		const data = await tanstackArticlesPromise
		tanstackArticlesCache = {
			data,
			expiresAt: Date.now() + ONE_HOUR_MS,
		}
		return data
	} finally {
		tanstackArticlesPromise = undefined
	}
}

async function fetchTanstackArticlesFromRss(): Promise<TanstackArticlesResponse> {
	const response = await fetch(TANSTACK_RSS_URL, {
		headers: {
			accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
			'user-agent': 'minifolio',
		},
	})

	if (!response.ok) {
		throw new Error(`TanStack RSS request failed with ${response.status}`)
	}

	const xml = await response.text()
	const feed = parser.parse(xml) as ParsedRssFeed
	const items = asArray(feed.rss?.channel?.item)
	const articles = items
		.map(mapRssItemToArticle)
		.filter((article): article is TanstackArticle => article !== null)

	return v.parse(tanstackArticlesResponseSchema, { articles })
}

function mapRssItemToArticle(item: ParsedRssItem): TanstackArticle | null {
	const author = readText(item.author)
	if (!author || !author.toLowerCase().includes(AUTHOR_MATCH)) {
		return null
	}

	const title = readText(item.title)
	const link = readText(item.link)
	const guid = readText(item.guid) ?? link
	const pubDate = readText(item.pubDate)
	const description = readText(item.description)

	if (!title || !link || !guid || !pubDate || !description) {
		return null
	}

	return {
		title,
		link,
		guid,
		pubDate,
		author,
		description,
		imageUrl: readEnclosureUrl(item.enclosure),
	}
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (Array.isArray(value)) {
		return value
	}

	return value ? [value] : []
}

function readText(value: ParsedTextValue): string | null {
	if (typeof value === 'string') {
		const text = value.trim()
		return text.length > 0 ? text : null
	}

	if (value && typeof value === 'object' && '#text' in value && typeof value['#text'] === 'string') {
		const text = value['#text'].trim()
		return text.length > 0 ? text : null
	}

	return null
}

function readEnclosureUrl(enclosure: ParsedRssItem['enclosure']): string | null {
	if (!enclosure || typeof enclosure !== 'object' || typeof enclosure.url !== 'string') {
		return null
	}

	const url = enclosure.url.trim()
	return url.length > 0 ? url : null
}

export async function fetchTanstackArticles() {
	return loadTanstackArticles()
}
