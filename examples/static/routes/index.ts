import { defineHandler } from "h3";

export default defineHandler(() => ({
  ok: true,
  message: "Static example ready"
}));
