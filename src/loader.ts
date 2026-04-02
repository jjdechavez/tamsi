import { loadConfig, type DotenvOptions } from "c12";
import type { MayaConfig } from "./config.js";

export interface LoadMayaConfigOptions {
  cwd?: string;
  configFile?: string;
  import?: (id: string) => Promise<unknown>;
  dotenv?: boolean | DotenvOptions;
}

export interface LoadedMayaConfig {
  config: MayaConfig;
  configFile?: string;
}

export async function loadMayaConfig(
  options: LoadMayaConfigOptions = {}
): Promise<LoadedMayaConfig> {
  const { cwd, configFile, import: importModule, dotenv } = options;
  const result = await loadConfig<MayaConfig>({
    name: "maya",
    cwd,
    configFile,
    dotenv: dotenv ?? true,
    import: importModule
  });

  return {
    config: result.config,
    configFile: result.configFile
  };
}
