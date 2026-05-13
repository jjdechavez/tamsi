import { defineTamsiRouter } from "tamsi";
import hello from "./hello.ts";
import ping from "./ping.ts";

export const apiRoutes = defineTamsiRouter({
	basePath: "/api",
	routes: [{ method: "GET", path: "/ping", handler: ping }],
});

export const publicRoutes = defineTamsiRouter({
	basePath: "/",
	routes: [{ method: "GET", path: "/hello", handler: hello }],
});

export const routes = [...apiRoutes, publicRoutes];
