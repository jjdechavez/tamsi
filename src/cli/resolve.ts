import type { TamsiConfig } from "../config.js";

export interface ServerArgs {
  port?: string;
  host?: string;
  config?: string;
}

export interface ResolvedServerOptions {
  port: number;
  host: string;
  configFile?: string;
}

function parsePort(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new TypeError(`Invalid port: ${value}`);
  }

  return port;
}

export function resolveServerOptions(
  args: ServerArgs,
  config: TamsiConfig
): ResolvedServerOptions {
  const port = parsePort(args.port) ?? config.port ?? 3000;
  const host = args.host ?? "localhost";

  return {
    port,
    host,
    configFile: args.config
  };
}
