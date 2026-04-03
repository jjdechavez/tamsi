import { defineTamsiConfig } from "tamsi";
import handler from "./routes/index";

export default defineTamsiConfig({
  port: __PORT__,
  publicDir: "public",
  publicPath: "/public",
  routes: [{ path: "/", handler }]
});
