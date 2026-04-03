# Tamsi

Lightweight micro-engine for explicit h3-based servers.

## Features

### tamsi.config.ts

```ts
import { defineTamsiConfig } from "tamsi";
import { defineEventHandler } from "h3";

const hello = defineEventHandler(() => ({ ok: true }));

export default defineTamsiConfig({
  port: 5555,
  routesBasePath: "/api",
  routes: [
    { method: "GET", path: "/hello", handler: hello }
  ],
  publicDir: "public",
  publicPath: "/public",
  health: { enabled: true, path: "/health" },
  shutdownTimeoutMs: 10000,
  onBeforeClose() {
    console.log("Tamsi is landing...");
  }
});
```

#### Config reference

- `port: number` (default `3000`)
  Port to listen on when running `tamsi dev` or `tamsi start`.
- `routes: TamsiRoute[]` (default `[]`)
  Explicit routes with `{ method, path, handler, middleware? }`.
- `routesBasePath: string` (default `""`)
  Prefix added to all routes (e.g. `"/api"`).
- `middleware: TamsiMiddleware[]` (default `[]`)
  Global middleware applied to all requests.
- `publicDir: string | false` (default `false`)
  Directory of static assets to serve. Disabled when `false` or unset.
- `publicPath: string` (default `"/public"`)
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
  middleware?: Middleware[];
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
  publicDir: "public",
  publicPath: "/public",
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

Use `defineTamsiRouter` to group routes under a base path and shared middleware.

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

Static serving is disabled by default. Enable it by setting `publicDir`.

```ts
import { defineTamsiConfig } from "tamsi";

export default defineTamsiConfig({
  publicDir: "public",
  publicPath: "/public"
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

Optional flags:

- `--minify`
- `--sourcemap=true|inline|external`
- `--target=node20|node22|node24`
- `--clean`
- `--env .env.production`

Start from the compiled output:

```sh
NODE_ENV=production tamsi start --outDir dist
```

Notes:

- `tamsi start` requires `dist/server.mjs`.
- Use `--clean` with `tamsi build` to remove the output directory before building.

Start flags:

- `--env .env.production` (replaces default `.env`)
- `--quiet`
- `--health /healthz`
- `--no-health`

### Config introspection

Print resolved config (redacted by default):

```sh
tamsi config --env .env.production --showSources
```

Use `--raw` to print full values.
