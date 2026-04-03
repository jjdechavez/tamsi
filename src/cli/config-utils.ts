import type { TamsiConfig } from "../config.js";

const redactionKeys = /key|secret|token|password|pwd|auth|bearer|clientsecret|clientkey|apikey|apisecret|database|dsn|connection/i;

export function applyConfigDefaults(config: TamsiConfig): TamsiConfig {
  const next: TamsiConfig = {
    ...config
  };

  if (next.port == null) {
    next.port = 3000;
  }

  if (next.publicDir && !next.publicPath) {
    next.publicPath = "/public";
  }

  if (!next.health) {
    next.health = { enabled: true, path: "/health" };
  } else {
    next.health = {
      enabled: next.health.enabled ?? true,
      path: next.health.path ?? "/health"
    };
  }

  return next;
}

export function redactConfig<T>(input: T): T {
  return redactValue(input) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const next: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      if (redactionKeys.test(key)) {
        next[key] = "***";
      } else {
        next[key] = redactValue(child);
      }
    }
    return next;
  }

  return value;
}
