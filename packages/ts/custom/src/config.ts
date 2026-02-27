import type { ClientConfig } from "./types";

let config: ClientConfig = {};

/**
 * Set global SDK options. Subsequent calls are **merged** into the existing
 * configuration, so you only need to pass the fields you want to change.
 *
 * @example
 * ```ts
 * import { configure } from "@contextcompany/custom";
 *
 * configure({ apiKey: "tcc_abc123", debug: true });
 * ```
 *
 * @param options - Configuration values to merge.
 */
export function configure(options: ClientConfig): void {
  config = { ...config, ...options };
}

export function getConfig(): Readonly<ClientConfig> {
  return config;
}
