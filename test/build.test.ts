import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile, access, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildProject } from "../src/cli/build.js";

describe("buildProject", () => {
  it("emits server.mjs and copies public assets", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "tamsi-build-"));
    try {
      await writeFile(
        join(baseDir, "tamsi.config.ts"),
        `export default {\n  port: 5555,\n  publicDir: "public"\n};\n`
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
});
