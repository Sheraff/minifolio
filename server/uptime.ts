import { Hono } from "hono";

function plural(value: number, unit: string) {
	return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatUptime(seconds: number) {
	const totalSeconds = Math.floor(seconds);
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 60 / 60) % 24;
	const days = Math.floor(totalSeconds / 60 / 60 / 24);

	if (totalSeconds < 60) {
		return `up ${plural(totalSeconds, "second")}`;
	}

	if (days > 0) {
		return `up ${plural(days, "day")}, ${plural(hours, "hour")}, ${plural(minutes, "minute")}`;
	}

	if (hours > 0) {
		return `up ${plural(hours, "hour")}, ${plural(minutes, "minute")}`;
	}

	return `up ${plural(minutes, "minute")}`;
}

export function uptime() {
	const app = new Hono();

	app.get("/", (c) => {
		c.header("Cache-Control", "no-store");

		const uptimeSeconds = process.uptime();
		return c.text(formatUptime(uptimeSeconds));
	});

	return app;
}
