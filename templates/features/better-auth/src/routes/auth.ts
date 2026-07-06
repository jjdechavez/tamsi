import { defineHandler, getRequestURL } from "tamsi";
import authHandler from "../lib/auth.ts";

export default defineHandler((event) => {
  event.node.req.url = getRequestURL(event).toString();
  return authHandler(event);
});
