# Maya

Lightweight micro-engine for explicit h3-based servers.

maya.config.ts

```ts
import { defineMayaConfig } from "maya";
import { defineEventHandler } from "h3";

const hello = defineEventHandler(() => ({ ok: true }));

export default defineMayaConfig({
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
    console.log("Maya is landing...");
  }
});
```

Config reference

- `port: number` (default `3000`)
  Port to listen on when running `maya dev` or `maya start`.
- `routes: MayaRoute[]` (default `[]`)
  Explicit routes with `{ method, path, handler, middleware? }`.
- `routesBasePath: string` (default `""`)
  Prefix added to all routes (e.g. `"/api"`).
- `middleware: MayaMiddleware[]` (default `[]`)
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

Notes

- Relative paths like `publicDir` resolve from the directory containing `maya.config.ts`.
- Health is enabled by default; disable with `health: { enabled: false }`.

MayaRoute type

```ts
import type { EventHandler, Middleware, HTTPMethod } from "h3";

type MayaRoute = {
  method?: "ALL" | HTTPMethod | Lowercase<HTTPMethod>;
  path: string;
  handler: EventHandler;
  middleware?: Middleware[];
};
```

Config patterns

```ts
// API-only
export default defineMayaConfig({
  routesBasePath: "/api",
  routes: [{ method: "GET", path: "/ping", handler: ping }],
  health: { enabled: true }
});

// Static-only
export default defineMayaConfig({
  publicDir: "public",
  publicPath: "/public",
  health: { enabled: false }
});
```

Shutdown hooks

Use `onBeforeClose` to run cleanup logic during a graceful shutdown. The CLI
waits for this hook before closing the listener, with a timeout guard.

```ts
import { defineMayaConfig } from "maya";

export default defineMayaConfig({
  shutdownTimeoutMs: 10000,
  async onBeforeClose() {
    console.log("Maya is landing...");
    // close DB connections, flush queues, etc.
  }
});
```

- `shutdownTimeoutMs` defaults to 10000 if not set.
- `onBeforeClose` runs for both `maya dev` and `maya start`.

Routing helpers

Use `defineMayaRouter` to group routes under a base path and shared middleware.

```ts
import { defineMayaConfig, defineMayaRouter } from "maya";
import { defineEventHandler } from "h3";

const routes = defineMayaRouter({
  basePath: "/api",
  routes: [
    {
      method: "GET",
      path: "/ping",
      handler: defineEventHandler(() => ({ ok: true }))
    }
  ]
});

export default defineMayaConfig({ routes });
```

You can also set a global prefix with `routesBasePath`.

Static files (optional)

Static serving is disabled by default. Enable it by setting `publicDir`.

```ts
import { defineMayaConfig } from "maya";

export default defineMayaConfig({
  publicDir: "public",
  publicPath: "/public"
});
```

Static assets pipeline

- Maya does not minify public assets.
- Build/minify assets into `public/` with your own tooling.
- `maya build` copies `public/` into `dist/public/`.

Examples

- `examples/basic/README.md`
- `examples/static/README.md`
- `examples/router/README.md`

Scaffolding

Create a new project:

```sh
maya init my-api --template minimal
```

Templates:

- `minimal`
- `standard`

Notes:

- Templates use `"maya": "workspace:*"` while developing locally to avoid the npm name collision.
- For local workspace installs, set `node-linker=isolated` in `.npmrc` so each app gets a `node_modules/.bin`.

Build & start

Build a project into `dist/`:

```sh
maya build --outDir dist
```

Asset pipeline example:

- `pnpm run assets:build`
- `maya build --outDir dist`

Optional flags:

- `--minify`
- `--sourcemap=true|inline|external`
- `--target=node20|node22|node24`
- `--clean`
- `--env .env.production`

Start from the compiled output:

```sh
NODE_ENV=production maya start --outDir dist
```

Notes:

- `maya start` requires `dist/server.mjs`.
- Use `--clean` with `maya build` to remove the output directory before building.

Start flags:

- `--env .env.production` (replaces default `.env`)
- `--quiet`
- `--health /healthz`
- `--no-health`
