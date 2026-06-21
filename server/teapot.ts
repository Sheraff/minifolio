import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";

export function teapot() {
	const app = new Hono();

	const choices = ["coffee", "tea"] as const;

	const brewQuerySchema = v.object({
		drink: v.optional(v.union(choices.map((c) => v.literal(c)))),
	});

	app.get("/", sValidator("query", brewQuerySchema), (c) => {
		const { drink } = c.req.valid("query");
		c.header("Cache-Control", "no-store");

		if (drink === "coffee") {
			return c.text(
				"This node is a teapot. Coffee cannot be brewed here.\n",
				418,
			);
		}

		if (drink === "tea") {
			return c.text("Steeping.\n", 200);
		}

		c.header(
			"Link",
			choices
				.map((choice) => `</api/brew?drink=${choice}>; rel="alternate"`)
				.join(", "),
		);

		return c.text(
			`Multiple choices: ${choices.join(", ")}. Try /api/brew?drink=tea.\n`,
			300,
		);
	});

	return app;
}
