import { consola } from "consola";

export interface BootLogOptions {
  version?: string;
  mode?: string;
  url?: string;
}

export function bootLog({ version, mode, url }: BootLogOptions) {
  const title = version ? `Tamsi v${version}` : "Tamsi";
  const lines = [
    "🪶 Status: Flight ready.",
    url ? `🔗 URL: ${url}` : undefined,
    mode ? `🛠️ Mode: ${mode}` : undefined,
    "Press Ctrl+C to initiate Soft Landing."
  ].filter(Boolean);

  consola.box({
    title,
    message: lines.join("\n")
  });
}
