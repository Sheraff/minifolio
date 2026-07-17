import { expect, test } from 'vitest'
import { createHalfYearWindows, splitDateWindow } from './windows.ts'

test('creates deterministic half-year windows for a rolling range', () => {
	expect(createHalfYearWindows('2025-07-13', '2026-07-17')).toEqual([
		{ fromDate: '2025-07-01', toDate: '2025-12-31' },
		{ fromDate: '2026-01-01', toDate: '2026-06-30' },
		{ fromDate: '2026-07-01', toDate: '2026-12-31' },
	])
})

test('recursively splits an inclusive date window without gaps', () => {
	expect(splitDateWindow({ fromDate: '2025-01-01', toDate: '2025-06-30' })).toEqual([
		{ fromDate: '2025-01-01', toDate: '2025-03-31' },
		{ fromDate: '2025-04-01', toDate: '2025-06-30' },
	])
	expect(splitDateWindow({ fromDate: '2025-01-01', toDate: '2025-01-01' })).toBeNull()
})
