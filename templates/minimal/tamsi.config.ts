import { defineTamsiConfig } from "tamsi";
import handler from "./routes/index";

export default defineTamsiConfig({
  port: __PORT__,
  routes: [{ path: "/", handler }]
});
