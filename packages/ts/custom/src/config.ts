import type { ClientConfig } from "./types";

let config: ClientConfig = {};

export function configure(options: ClientConfig): void {
  config = { ...config, ...options };
}

export function getConfig(): Readonly<ClientConfig> {
  return config;
}
