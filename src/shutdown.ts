import { createHooks } from "hookable";
import type { TamsiConfig } from "./config.js";

export interface ShutdownHooks {
  beforeClose: () => Promise<void> | void;
}

export interface ShutdownOptions {
  timeoutMs: number;
  onTimeout?: () => void;
}

export interface ClosableServer {
  close(closeActiveConnections?: boolean): Promise<void>;
}

export interface CloseServerOptions {
  timeoutMs: number;
  onTimeout?: (phase: "drain" | "hooks") => void;
  onError?: (error: unknown) => void;
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
  const settled = await settleWithin(
    hooks.callHook("beforeClose"),
    options.timeoutMs
  );
  if (!settled) {
    options.onTimeout?.();
  }
}

/**
 * Stops accepting connections, waits for in-flight requests to drain, and
 * only then runs `beforeClose` hooks, so resources such as database pools
 * stay available until the last request finishes. Never rejects; returns
 * `false` when draining or a hook failed.
 */
export async function closeTamsiServer(
  listener: ClosableServer | undefined,
  hooks: ReturnType<typeof createShutdownHooks>,
  options: CloseServerOptions
): Promise<boolean> {
  let ok = true;

  if (listener) {
    try {
      const drained = await settleWithin(listener.close(), options.timeoutMs);
      if (!drained) {
        options.onTimeout?.("drain");
        await settleWithin(listener.close(true), options.timeoutMs);
      }
    } catch (error) {
      ok = false;
      options.onError?.(error);
    }
  }

  try {
    await runBeforeClose(hooks, {
      timeoutMs: options.timeoutMs,
      onTimeout: () => options.onTimeout?.("hooks")
    });
  } catch (error) {
    ok = false;
    options.onError?.(error);
  }

  return ok;
}

// hookable returns a plain value instead of a promise when every hook is sync.
async function settleWithin(value: unknown, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<false>((resolve) => {
    timeout = setTimeout(() => resolve(false), timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([
      Promise.resolve(value).then(() => true),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
