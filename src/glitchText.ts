const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min

const nextDelay = () => {
	if (Math.random() > 0.7) {
		return randomBetween(180, 650)
	}

	return randomBetween(1600, 6200)
}

const attachGlitchLoop = (element: HTMLElement, initialDelay: number) => {
	let startTimer = 0
	let stopTimer = 0
	let disposed = false

	const schedule = (delay: number) => {
		startTimer = window.setTimeout(() => {
			if (disposed) {
				return
			}

			const duration = Math.round(randomBetween(180, 420))
			element.dataset.glitchActive = 'true'

			stopTimer = window.setTimeout(() => {
				if (disposed) {
					return
				}

				element.removeAttribute('data-glitch-active')
				schedule(nextDelay())
			}, duration)
		}, delay)
	}

	schedule(initialDelay)

	return () => {
		disposed = true
		window.clearTimeout(startTimer)
		window.clearTimeout(stopTimer)
		element.removeAttribute('data-glitch-active')
	}
}

export function attachRandomGlitch(selector: string) {
	const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))

	return elements.map((element, index) =>
		attachGlitchLoop(element, randomBetween(400 + index * 180, 2200 + index * 320))
	)
}
