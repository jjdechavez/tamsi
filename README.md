# Maya

Lightweight micro-engine for explicit h3-based servers.

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

Examples

- `examples/basic/README.md`
- `examples/static/README.md`
- `examples/router/README.md`
