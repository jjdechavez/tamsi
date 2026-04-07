import { defineTamsiConfig } from "tamsi";
import handler from "./routes/index";

export default defineTamsiConfig({
  port: 5555,
  publicDir: "public",
  publicPath: "/", // Set "/admin" or "/dashboard"
  routes: [{ method: "GET", path: "/api/test", handler }],
  health: { enabled: false }
});
