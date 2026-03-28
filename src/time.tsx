import { createSignal, onCleanup, Show } from "solid-js"

function getTime() {
	return new Intl.DateTimeFormat(new Intl.Locale(navigator.language, { numberingSystem: "latn" }), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format()
}

export function Time() {
	const [time, setTime] = createSignal(getTime())

	const i = setInterval(() => setTime(getTime()), 500)
	onCleanup(() => clearInterval(i))

	return <time>{time()}</time>
}

function getParisDifferenceLabel() {
	const now = Temporal.Now.instant()

	const user = now.toZonedDateTimeISO(Temporal.Now.timeZoneId())
	const paris = now.toZonedDateTimeISO("Europe/Paris")

	const diffMinutes =
		(paris.offsetNanoseconds - user.offsetNanoseconds) / 60e9

	if (diffMinutes === 0) return null

	const abs = Math.abs(diffMinutes)
	const hours = Math.floor(abs / 60)
	const minutes = abs % 60
	const amount = minutes ? `${hours}h${minutes}` : `${hours}h`

	return diffMinutes > 0 ? `${amount} ahead` : `${amount} behind`
}

export function TimeDifference() {
	const diff = getParisDifferenceLabel()
	return (
		<Show when={diff}>
			<span> # {diff}</span>
		</Show>
	)
}