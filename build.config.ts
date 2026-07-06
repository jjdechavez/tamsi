import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/h3", "src/cli"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    external: ["esbuild"]
  },
  externals: ["esbuild"]
});
