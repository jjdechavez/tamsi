import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createTamsiApp } from "../src/app.js";
import { buildProject } from "../src/cli/build.js";
import { resolveTamsiMiddlewares } from "../src/server.js";

function bareImports(source: string) {
  const specifiers = [
    ...source.matchAll(/from\s+"([^"]+)"/g),
    ...source.matchAll(/import\(\s*"([^"]+)"\s*\)/g)
  ].map((match) => match[1]);
  return specifiers.filter(
    (specifier) => !specifier.startsWith(".") && !specifier.startsWith("node:")
  );
}

describe("buildProject", () => {
  it("emits server.mjs and copies public assets", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "tamsi-build-"));
    try {
      await writeFile(
        join(baseDir, "tamsi.config.ts"),
        `export default {\n  port: 5555,\n  serveStatic: {\n    publicDir: "public"\n  }\n};\n`
      );
      await mkdir(join(baseDir, "public"), { recursive: true });
      await writeFile(join(baseDir, "public/index.html"), "hello");

      const result = await buildProject({
        cwd: baseDir,
        outDir: "dist",
        clean: true
      });

      await access(resolve(result.outDir, "server.mjs"));
      await access(resolve(result.outDir, "tamsi.config.mjs"));
      const html = await readFile(
        resolve(result.outDir, "public/index.html"),
        "utf8"
      );
      expect(html).toBe("hello");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("emits a server entry that only imports tamsi", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "tamsi-build-"));
    try {
      await writeFile(join(baseDir, "tamsi.config.ts"), "export default {};\n");

      const result = await buildProject({
        cwd: baseDir,
        outDir: "dist",
        clean: true
      });

      const server = await readFile(resolve(result.outDir, "server.mjs"), "utf8");
      expect(new Set(bareImports(server))).toEqual(new Set(["tamsi"]));
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("bundles string middleware handlers", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "tamsi-build-"));
    try {
      await mkdir(join(baseDir, "src"), { recursive: true });
      await writeFile(
        join(baseDir, "src/middleware.ts"),
        `export default (event: { res: { headers: Headers } }) => {\n  event.res.headers.set("x-from-middleware", "yes");\n};\n`
      );
      await writeFile(
        join(baseDir, "tamsi.config.ts"),
        `export default {\n  middlewares: [{ handler: "./src/middleware.ts" }],\n  routes: [{ path: "/hi", handler: () => "hi" }]\n};\n`
      );

      const result = await buildProject({
        cwd: baseDir,
        outDir: "dist",
        clean: true
      });

      const outUrl = (file: string) =>
        pathToFileURL(resolve(result.outDir, file)).href;
      const { default: config } = await import(outUrl("tamsi.config.mjs"));
      const { default: manifest } = await import(
        outUrl("tamsi.middlewares.mjs")
      );
      expect(Object.keys(manifest)).toEqual(["./src/middleware.ts"]);

      const resolved = await resolveTamsiMiddlewares(config, (id) =>
        manifest[id]()
      );
      const response = await createTamsiApp(resolved).request(
        "http://localhost/hi"
      );
      expect(await response.text()).toBe("hi");
      expect(response.headers.get("x-from-middleware")).toBe("yes");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
