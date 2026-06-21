import { onCleanup, type Accessor, type Setter } from "solid-js";
import "./labs-lazy.css";

export default function LabsLazy(props: {
	ref: HTMLUListElement | undefined;
	swap: Accessor<{
		from: number;
		to: number;
	} | null>;
	setSwap: Setter<{
		from: number;
		to: number;
	} | null>;
	length: number;
	current: Accessor<number[]>;
	setCurrent: Setter<number[]>;
	hold: Accessor<number>;
}) {
	let last = -1;
	const controller = new AbortController();

	const animate = () => {
		if (!props.ref || props.swap()) return;

		// resolve after animation
		setTimeout(() => {
			const pair = props.swap();
			if (!pair) return;
			const { from, to } = pair;
			props.setSwap(null);
			props.setCurrent((prev) => {
				const next = [...prev];
				const index = next.indexOf(from);
				next[index] = to;
				return next;
			});
		}, 3800);

		// find swap pair
		let from: number;
		do {
			from =
				props.current()[Math.floor(Math.random() * props.current().length)];
		} while (from === props.hold() || from === last);
		let to: number;
		do {
			to = Math.floor(Math.random() * props.length);
		} while (props.current().includes(to));

		// start swap
		last = to;
		props.setSwap({ from, to });
	}

	const interval = setInterval(animate, 6000);
	animate()

	onCleanup(() => {
		clearInterval(interval);
		controller.abort();
	});

	return null;
}
