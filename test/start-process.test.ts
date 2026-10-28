import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  buildStartEnv,
  forwardSignals,
  toExitCode
} from "../src/cli/start-process.js";
import { resolveRuntimeOptions } from "../src/server.js";

describe("buildStartEnv", () => {
  it("passes start flags through to the built server runtime", () => {
    const quiet = resolveRuntimeOptions(
      {},
      buildStartEnv({ quiet: true, health: "/hz", host: "::", port: "4100" }, {})
    );
    expect(quiet.quiet).toBe(true);
    expect(quiet.host).toBe("::");
    expect(quiet.port).toBe(4100);
    expect(quiet.config.health).toEqual({ enabled: true, path: "/hz" });

    const noHealth = resolveRuntimeOptions(
      {},
      buildStartEnv({ noHealth: true }, {})
    );
    expect(noHealth.config.health).toEqual({ enabled: false });
  });

  it("sets TAMSI_ENV_FILE for --env", () => {
    expect(buildStartEnv({ env: ".env.production" }, {}).TAMSI_ENV_FILE).toBe(
      ".env.production"
    );
  });
});

describe("forwardSignals", () => {
  it("relays SIGTERM and SIGINT to the child until stopped", () => {
    const target = new EventEmitter();
    const child = { kill: vi.fn(() => true) };

    const stop = forwardSignals(child, target);
    target.emit("SIGTERM");
    target.emit("SIGINT");
    expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(child.kill).toHaveBeenNthCalledWith(2, "SIGINT");

    stop();
    target.emit("SIGTERM");
    expect(child.kill).toHaveBeenCalledTimes(2);
    expect(target.listenerCount("SIGTERM")).toBe(0);
  });
});

describe("toExitCode", () => {
  it("returns the child exit code", () => {
    expect(toExitCode(0, null)).toBe(0);
    expect(toExitCode(2, null)).toBe(2);
  });

  it("does not report success when the child is killed by a signal", () => {
    expect(toExitCode(null, "SIGTERM")).toBe(143);
    expect(toExitCode(null, "SIGKILL")).toBe(137);
  });
});
