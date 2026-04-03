import { loadConfig, type DotenvOptions } from "c12";
import type { TamsiConfig } from "./config.js";

export interface LoadTamsiConfigOptions {
  cwd?: string;
  configFile?: string;
  import?: (id: string) => Promise<unknown>;
  dotenv?: boolean | DotenvOptions;
}

export interface LoadedTamsiConfig {
  config: TamsiConfig;
  configFile?: string;
}

export async function loadTamsiConfig(
  options: LoadTamsiConfigOptions = {}
): Promise<LoadedTamsiConfig> {
  const { cwd, configFile, import: importModule, dotenv } = options;
  const result = await loadConfig<TamsiConfig>({
    name: "tamsi",
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
