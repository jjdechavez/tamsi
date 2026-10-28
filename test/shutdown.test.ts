import { describe, expect, it, vi } from "vitest";
import {
  closeTamsiServer,
  createShutdownHooks,
  runBeforeClose
} from "../src/shutdown.js";

describe("shutdown hooks", () => {
  it("awaits onBeforeClose", async () => {
    const hook = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const hooks = createShutdownHooks({ onBeforeClose: hook });
    await runBeforeClose(hooks, { timeoutMs: 1000 });
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it("invokes timeout handler when hooks are slow", async () => {
    const hook = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const onTimeout = vi.fn();
    const hooks = createShutdownHooks({ onBeforeClose: hook });

    await runBeforeClose(hooks, { timeoutMs: 5, onTimeout });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("runBeforeClose timeout", () => {
  it("does not report a timeout when hooks finish in time", async () => {
    const onTimeout = vi.fn();
    const hooks = createShutdownHooks({ onBeforeClose: () => {} });

    await runBeforeClose(hooks, { timeoutMs: 10, onTimeout });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe("closeTamsiServer", () => {
  it("closes the listener before running hooks", async () => {
    const calls: string[] = [];
    const listener = {
      close: vi.fn(async () => {
        calls.push("close");
      })
    };
    const hooks = createShutdownHooks({
      onBeforeClose: () => {
        calls.push("hook");
      }
    });

    const ok = await closeTamsiServer(listener, hooks, { timeoutMs: 100 });
    expect(ok).toBe(true);
    expect(calls).toEqual(["close", "hook"]);
    expect(listener.close).toHaveBeenCalledWith();
  });

  it("resolves false instead of rejecting when a hook throws", async () => {
    const onError = vi.fn();
    const listener = { close: vi.fn(async () => {}) };
    const hooks = createShutdownHooks({
      onBeforeClose: () => {
        throw new Error("db close failed");
      }
    });

    const ok = await closeTamsiServer(listener, hooks, {
      timeoutMs: 100,
      onError
    });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "db close failed" })
    );
    expect(listener.close).toHaveBeenCalled();
  });

  it("force-closes connections when draining times out", async () => {
    const onTimeout = vi.fn();
    const listener = {
      close: vi.fn((force?: boolean) =>
        force ? Promise.resolve() : new Promise<void>(() => {})
      )
    };
    const hook = vi.fn();
    const hooks = createShutdownHooks({ onBeforeClose: hook });

    const ok = await closeTamsiServer(listener, hooks, {
      timeoutMs: 10,
      onTimeout
    });
    expect(ok).toBe(true);
    expect(onTimeout).toHaveBeenCalledWith("drain");
    expect(listener.close).toHaveBeenLastCalledWith(true);
    expect(hook).toHaveBeenCalledTimes(1);
  });
});
