export type DateWindow = {
	fromDate: string
	toDate: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function toDateString(date: Date) {
	return date.toISOString().slice(0, 10)
}

export function getContributionCalendarStart(now: Date) {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
	start.setUTCDate(start.getUTCDate() - start.getUTCDay() - 52 * 7)
	return toDateString(start)
}

export function createHalfYearWindows(fromDate: string, toDate: string) {
	const fromYear = Number(fromDate.slice(0, 4))
	const toYear = Number(toDate.slice(0, 4))
	const windows: DateWindow[] = []

	for (let year = fromYear; year <= toYear; year++) {
		for (const window of [
			{ fromDate: `${year}-01-01`, toDate: `${year}-06-30` },
			{ fromDate: `${year}-07-01`, toDate: `${year}-12-31` },
		]) {
			if (window.toDate >= fromDate && window.fromDate <= toDate) {
				windows.push(window)
			}
		}
	}

	return windows
}

export function splitDateWindow(window: DateWindow): [DateWindow, DateWindow] | null {
	const from = Date.parse(`${window.fromDate}T00:00:00Z`)
	const to = Date.parse(`${window.toDate}T00:00:00Z`)
	if (from >= to) return null

	const totalDays = Math.floor((to - from) / DAY_MS) + 1
	const leftTo = from + (Math.floor(totalDays / 2) - 1) * DAY_MS
	const rightFrom = leftTo + DAY_MS

	return [
		{ fromDate: window.fromDate, toDate: toDateString(new Date(leftTo)) },
		{ fromDate: toDateString(new Date(rightFrom)), toDate: window.toDate },
	]
}

export function toGraphqlRange(window: DateWindow) {
	return {
		from: `${window.fromDate}T00:00:00Z`,
		to: `${window.toDate}T23:59:59Z`,
	}
}
