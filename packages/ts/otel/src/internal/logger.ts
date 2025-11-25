// debug logger singleton
let DEBUG_ENABLED = false;

export function setDebug(enabled: boolean) {
  DEBUG_ENABLED = enabled;
}

export function debug(...args: any[]) {
  if (!DEBUG_ENABLED) return;

  const namespace = "[TCC]";
  const prefix = `\x1b[34m${namespace}\x1b[0m`;

  console.log(`${prefix}`, ...args);
}
