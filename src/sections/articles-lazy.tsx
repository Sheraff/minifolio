import { createMemo, For } from 'solid-js'
import './articles-lazy.css'

type Char = { real: string, list: string }

const scramble = '&@#=*$%01+{}µ~<>[]'.split('')
const COUNT = 6

function randomString() {
	const arr = new Array(COUNT)
	for (let i = 0; i < COUNT; i++) {
		arr[i] = scramble[Math.floor(Math.random() * scramble.length)]
	}
	return arr.join('\n')
}

export default function ArticleDescription(props: {
	description: string
	trigger: number
}) {
	const chars = createMemo(() => {
		props.trigger
		const segmenter = new Intl.Segmenter('en-US', { granularity: 'grapheme' })
		const desc: Char[] = []
		for (const { segment } of segmenter.segment(props.description)) {
			desc.push({
				real: segment,
				list: segment === ' ' ? segment : randomString() + '\n' + segment,
			})
		}
		return desc
	})
	return (
		<For each={chars()}>
			{(char, i) => <span
				data-chars={char.list}
				style={{
					'--delay': i(),
					'--count': ((char.list.length - 1) / 2)
				}}
			>
				{char.real}
			</span>}
		</For>
	)
}