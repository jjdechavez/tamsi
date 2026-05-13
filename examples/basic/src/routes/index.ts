import { defineHandler } from "tamsi";

export default defineHandler((event) => {
	return {
		ok: true,
		message: "Tamsi is cool.",
		requestId: event.context.requestId,
	};
});
