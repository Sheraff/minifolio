import { publicLog } from '#server/public-logs.ts'
import { createCachedFetcher } from '#server/utils/cache.ts'
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

type TanstackArticle = v.InferOutput<typeof tanstackArticleSchema>
type TanstackArticlesResponse = v.InferOutput<typeof tanstackArticlesResponseSchema>

const nonEmptyRssTextSchema = v.pipe(
	v.string(),
	v.trim(),
	v.nonEmpty(),
)

const rssTextSchema = v.union([
	nonEmptyRssTextSchema,
	v.pipe(
		v.object({ '#text': nonEmptyRssTextSchema }),
		v.transform((value) => value['#text']),
	),
])

const rssEnclosureUrlSchema = v.pipe(
	v.object({ url: nonEmptyRssTextSchema }),
	v.transform((enclosure) => enclosure.url),
)

const rssArticleSchema = v.pipe(
	v.object({
		title: rssTextSchema,
		link: rssTextSchema,
		guid: v.optional(rssTextSchema),
		pubDate: rssTextSchema,
		author: rssTextSchema,
		description: rssTextSchema,
		enclosure: v.optional(
			v.fallback(v.nullable(rssEnclosureUrlSchema), null),
			null,
		),
	}),
	v.check((item) => item.author.toLowerCase().includes(AUTHOR_MATCH)),
	v.transform((item): TanstackArticle => ({
		title: item.title,
		link: item.link,
		guid: item.guid ?? item.link,
		pubDate: item.pubDate,
		author: item.author,
		description: item.description,
		imageUrl: item.enclosure,
	})),
)

const optionalRssArticleSchema = v.fallback(v.optional(rssArticleSchema), undefined)

const rssArticlesSchema = v.pipe(
	v.union([
		v.array(optionalRssArticleSchema),
		v.pipe(
			optionalRssArticleSchema,
			v.transform((article) => [article]),
		),
	]),
	v.transform((articles) => articles.filter((article): article is TanstackArticle => article !== undefined)),
)

const rssFeedSchema = v.object({
	rss: v.optional(v.object({
		channel: v.optional(v.object({
			item: v.optional(rssArticlesSchema, []),
		})),
	})),
})

const loadTanstackArticles = createCachedFetcher<TanstackArticlesResponse>({
	label: 'article RSS',
	ttlMs: ONE_HOUR_MS,
	fetch: fetchTanstackArticlesFromRss,
	onUpdate(data, previous) {
		const prevCount = previous?.articles.length
		if (prevCount !== undefined && data.articles.length > prevCount) {
			publicLog("[data] new article")
		}
	},
})

async function fetchTanstackArticlesFromRss(): Promise<TanstackArticlesResponse> {
	publicLog("[data] fetching article RSS")
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
	const feed = v.parse(rssFeedSchema, parser.parse(xml))
	const articles = feed.rss?.channel?.item ?? []

	return v.parse(tanstackArticlesResponseSchema, { articles })
}

export async function fetchTanstackArticles() {
	return loadTanstackArticles()
}
