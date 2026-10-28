import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import { constants } from "node:os";

export interface StartEnvArgs {
	port?: string;
	host?: string;
	env?: string;
	quiet?: boolean;
	health?: string;
	noHealth?: boolean;
}

const FORWARDED_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

/**
 * Builds the environment for the built server. Variable names must match
 * those read by `resolveRuntimeOptions` and `loadTamsiEnv`.
 */
export function buildStartEnv(
	args: StartEnvArgs,
	baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env = { ...baseEnv };
	if (args.port) {
		env.PORT = args.port;
	}
	if (args.host) {
		env.HOST = args.host;
	}
	if (args.env) {
		env.TAMSI_ENV_FILE = args.env;
	}
	if (args.quiet) {
		env.TAMSI_QUIET = "1";
	}
	if (args.health) {
		env.TAMSI_HEALTH_PATH = args.health;
	}
	if (args.noHealth) {
		env.TAMSI_NO_HEALTH = "1";
	}
	return env;
}

/**
 * Relays termination signals to the child so it can shut down gracefully.
 * Returns a function that removes the listeners.
 */
export function forwardSignals(
	child: Pick<ChildProcess, "kill">,
	target: EventEmitter = process,
) {
	const handlers = FORWARDED_SIGNALS.map((signal) => {
		const handler = () => {
			child.kill(signal);
		};
		target.on(signal, handler);
		return [signal, handler] as const;
	});

	return () => {
		for (const [signal, handler] of handlers) {
			target.off(signal, handler);
		}
	};
}

/**
 * Maps a child exit to a process exit code, using the shell convention of
 * 128 + signal number when the child was killed by a signal.
 */
export function toExitCode(
	code: number | null,
	signal: NodeJS.Signals | null,
): number {
	if (code !== null) {
		return code;
	}
	if (signal) {
		return 128 + (constants.signals[signal] ?? 0);
	}
	return 1;
}
