import { defineTamsiConfig } from "tamsi";
import { routes } from "./src/routes/index.ts";

export default defineTamsiConfig({
  port: __PORT__,
  serveStatic: {
    publicDir: "public",
    publicPath: "/public",
  },
  routes
});
