# Tamsi

Lightweight micro-engine for explicit h3-based servers.

## Table of Contents

- [Installation](#installation)
- [CLI](#cli)
- [Features](#features)
  - [tamsi.config.ts](#tamsi.config.ts)
  - [TamsiRoute](#tamsiroute-type)
  - [Shutdown Hooks](#shutdown-hooks)
  - [Routing Helpers](#routing-helpers)
  - [Static files](#static-files)
  - [Config introspection](#config-introspection)

## Installation

Use your favorite package manager npm, pnpm and etc.

```
pnpm add tamsi
```

## CLI

Tamsi ships with a CLI for dev, build, and production start.

### Common usage

```sh
tamsi init my-api --template minimal
tamsi init my-api --template minimal --kysely --betterAuth
tamsi dev --env .env.local
tamsi build --outDir dist
tamsi start --outDir dist
```

### Commands

#### init

Create a new project from a template.

```sh
tamsi init my-api --template standard
```

Flags:

- `--template minimal|standard` (default `minimal`)
- `--kysely` add Kysely setup (defaults to sqlite)
- `--betterAuth` add Better Auth (email/password) and Kysely
- `--db sqlite|postgres` database driver for Kysely
- `--force` overwrite if directory is not empty
- `--cwd <path>` base directory to create the project in

#### dev

Start in development mode with file watching.

```sh
tamsi dev --port 5555 --host 0.0.0.0
```

Flags:

- `--config <path>` path to config file
- `--env <path>` path to env file (replaces default `.env`)
- `--port <number>` port to listen on
- `--host <string>` host to bind
- `--quiet` reduce output to only the URL
- `--health <path>` override health endpoint path
- `--no-health` disable health endpoint

#### build

Build a production bundle to `dist/` (or `--outDir`).

```sh
tamsi build --outDir dist --minify --sourcemap=external
```

Flags:

- `--config <path>` path to config file
- `--outDir <path>` output directory (default `dist`)
- `--clean` remove output directory before build
- `--minify` minify build output
- `--sourcemap true|false|inline|external` (default `false`)
- `--target node18|node20|node22|node24` (default `node18`)
- `--env <path>` path to env file (replaces default `.env`)

#### start

Start from a production build.

```sh
tamsi start --outDir dist --env .env.production
```

Flags:

- `--outDir <path>` build output directory (default `dist`)
- `--env <path>` path to env file (replaces default `.env`)
- `--port <number>` port to listen on
- `--host <string>` host to bind
- `--quiet` reduce output to only the URL
- `--health <path>` override health endpoint path
- `--no-health` disable health endpoint

#### config

Print resolved config (redacted by default).

```sh
tamsi config --env .env.production --showSources
```

Flags:

- `--config <path>` path to config file
- `--env <path>` path to env file (replaces default `.env`)
- `--raw` print full values without redaction
- `--showSources` include config source metadata

## Features

### tamsi.config.ts

```ts
import { defineTamsiConfig } from "tamsi";
import { defineEventHandler } from "h3";

const hello = defineEventHandler(() => ({ ok: true }));

export default defineTamsiConfig({
  host: "localhost",
  port: 5555,
  routesBasePath: "/api",
  routes: [
    {
      method: "GET",
      path: "/hello",
      handler: hello,
      middleware: [defineEventHandler(() => console.log("Middleware before '/' endpoint."))]
    }
  ],
  serveStatic: {
    publicDir: "public",
    publicPath: "/public",
  },
  health: { enabled: true, path: "/health" },
  shutdownTimeoutMs: 10000,
  onBeforeClose() {
    console.log("Tamsi is landing...");
  }
});
```

#### Config reference

- `host: string` (default `0.0.0.0`)
  Host to listen on when running `tamsi dev` or `tamsi start`.
- `port: number` (default `3000`)
  Port to listen on when running `tamsi dev` or `tamsi start`.
- `routes: TamsiRoute[]` (default `[]`)
  Explicit routes with `{ method, path, handler, middleware? }`.
- `routesBasePath: string` (default `""`)
  Prefix added to all routes (e.g. `"/api"`).
- `middlewares: TamsiMiddleware[]` (default `[]`)
  Global middleware applied to all requests.
- `serveStatic.publicDir: string | false` (default `false`)
  Directory of static assets to serve. Disabled when `false` or unset.
- `serveStatic.publicPath: string` (default `"/public"`)
  URL prefix for static assets.
- `health: { enabled?: boolean; path?: string }` (default enabled, path `"/health"`)
  Built-in health endpoint.
- `shutdownTimeoutMs: number` (default `10000`)
  Time limit for graceful shutdown hooks.
- `onBeforeClose: () => void | Promise<void>`
  Hook called before the server closes.

**Notes**

- Relative paths like `publicDir` resolve from the directory containing `tamsi.config.ts`.
- Health is enabled by default; disable with `health: { enabled: false }`.

### TamsiRoute type

```ts
import type { EventHandler, Middleware, HTTPMethod } from "h3";

type TamsiRoute = {
  method?: "ALL" | HTTPMethod | Lowercase<HTTPMethod>;
  path: string;
  handler: EventHandler;
  middlewares?: Middleware[];
};
```

#### Config patterns

```ts
// API-only
export default defineTamsiConfig({
  routesBasePath: "/api",
  routes: [{ method: "GET", path: "/ping", handler: ping }],
  health: { enabled: true }
});

// Static-only
export default defineTamsiConfig({
  serveStatic: {
    publicDir: "public",
    publicPath: "/public",
  },
  health: { enabled: false }
});
```

### Shutdown hooks

Use `onBeforeClose` to run cleanup logic during a graceful shutdown. The CLI
waits for this hook before closing the listener, with a timeout guard.

```ts
import { defineTamsiConfig } from "tamsi";

export default defineTamsiConfig({
  shutdownTimeoutMs: 10000,
  async onBeforeClose() {
    console.log("Tamsi is landing...");
    // close DB connections, flush queues, etc.
  }
});
```

- `shutdownTimeoutMs` defaults to 10000 if not set.
- `onBeforeClose` runs for both `tamsi dev` and `tamsi start`.

### Routing helpers

Use `defineTamsiRouter` to group routes under a base path and shared middlewares.

```ts
import { defineTamsiConfig, defineTamsiRouter } from "tamsi";
import { defineEventHandler } from "h3";

const routes = defineTamsiRouter({
  basePath: "/api",
  routes: [
    {
      method: "GET",
      path: "/ping",
      handler: defineEventHandler(() => ({ ok: true }))
    }
  ]
});

export default defineTamsiConfig({ routes });
```

You can also set a global prefix with `routesBasePath`.

### Static files (optional)

Static serving is disabled by default. Enable it by setting `serveStatic.publicDir`.

```ts
import { defineTamsiConfig } from "tamsi";

export default defineTamsiConfig({
  serveStatic: {
    publicDir: "public",
    publicPath: "/public"
  }
});
```

**Static assets pipeline**

- Tamsi does not minify public assets.
- Build/minify assets into `public/` with your own tooling.
- `tamsi build` copies `public/` into `dist/public/`.

**Examples**

- `examples/basic/README.md`
- `examples/static/README.md`
- `examples/router/README.md`

Scaffolding

Create a new project:

```sh
tamsi init my-api --template minimal
tamsi init my-api --template minimal --kysely --betterAuth
```

Templates:

- `minimal`
- `standard`

Notes:

- Templates use `"tamsi": "workspace:*"` while developing locally to avoid the npm name collision.
- For local workspace installs, set `node-linker=isolated` in `.npmrc` so each app gets a `node_modules/.bin`.

### Build & start

Build a project into `dist/`:

```sh
tamsi build --outDir dist
```

Asset pipeline example:

- `pnpm run assets:build`
- `tamsi build --outDir dist`

See the CLI section above for full build flags.

Start from the compiled output:

```sh
NODE_ENV=production tamsi start --outDir dist
```

Notes:

- `tamsi start` requires `dist/server.mjs`.
- Use `--clean` with `tamsi build` to remove the output directory before building.

See the CLI section above for full start flags.

### Config introspection

Print resolved config (redacted by default):

```sh
tamsi config --env .env.production --showSources
```

Use `--raw` to print full values.
