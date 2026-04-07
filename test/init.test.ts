import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/cli/init.js";

describe("initProject", () => {
  it("renders minimal template", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "tamsi-init-"));
    try {
      const targetDir = await initProject({
        name: "my-api",
        template: "minimal",
        cwd: baseDir,
        force: false,
        port: 5555
      });

      const pkg = await readFile(join(targetDir, "package.json"), "utf8");
      const config = await readFile(join(targetDir, "tamsi.config.ts"), "utf8");

      expect(pkg).toContain("\"name\": \"my-api\"");
      expect(config).toContain("port: 5555");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
