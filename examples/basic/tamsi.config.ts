import { randomUUID } from "node:crypto";
import { defineHandler, defineTamsiConfig } from "tamsi";

import handler from "./src/routes/index.ts";

export default defineTamsiConfig({
	port: 5555,
	shutdownTimeoutMs: 8000,
	middlewares: [
		{
			handler: defineHandler((event) => {
				const requestId = randomUUID();

				event.context.requestId = requestId;
				event.res.headers.set("x-request-id", requestId);

				console.log("Middleware 1");
			}),
		},
		{ handler: defineHandler(() => console.log("Middleware 2")) },
	],
	routes: [
		{
			method: "GET",
			path: "/",
			middleware: [
				defineHandler(() => console.log("Middleware before '/' endpoint.")),
			],
			handler,
		},
	],
	onBeforeClose: () => {
		console.warn("Prepare for landing...");
	},
});
