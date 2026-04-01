import { defineMayaConfig } from "maya";
import handler from "./routes/index";

export default defineMayaConfig({
  port: 5555,
  shutdownTimeoutMs: 8000,
  routes: [{ path: "/", handler }],
  onBeforeClose: () => {
    console.warn("Prepare for landing...")
  }
});
