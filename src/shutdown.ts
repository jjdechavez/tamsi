import { createHooks } from "hookable";
import type { TamsiConfig } from "./config.js";

export interface ShutdownHooks {
  beforeClose: () => Promise<void> | void;
}

export interface ShutdownOptions {
  timeoutMs: number;
  onTimeout?: () => void;
}

export function createShutdownHooks(config: TamsiConfig) {
  const hooks = createHooks<ShutdownHooks>();

  if (config.onBeforeClose) {
    hooks.hook("beforeClose", config.onBeforeClose);
  }

  return hooks;
}

export async function runBeforeClose(
  hooks: ReturnType<typeof createShutdownHooks>,
  options: ShutdownOptions
) {
  const hookPromise = hooks.callHook("beforeClose");
  const timeoutPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      options.onTimeout?.();
      resolve();
    }, options.timeoutMs);
    timeout.unref?.();
  });

  await Promise.race([hookPromise, timeoutPromise]);
}
