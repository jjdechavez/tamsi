import { defineHandler } from "h3";

// FEATURE_IMPORTS

const rootHandler = defineHandler(() => ({
  ok: true,
  message: "Tamsi is flying."
}));

export const routes = [
  { path: "/", handler: rootHandler },
  // FEATURE_ROUTES
];

export default routes;
