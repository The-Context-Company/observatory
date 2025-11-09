export function error(...args: any[]) {
  const namespace = "[TCC]";
  const prefix = `\x1b[31m${namespace}\x1b[0m`;

  console.error(`${prefix}`, ...args);
}

export function log(...args: any[]) {
  const namespace = "[TCC]";
  const prefix = `\x1b[34m${namespace}\x1b[0m`;

  console.log(`${prefix}`, ...args);
}

export function debug(...args: any[]) {
  if (!window.TCC_DEBUG) return;

  const namespace = "[TCC]";
  const prefix = `\x1b[34m${namespace}\x1b[0m`;

  console.log(`${prefix}`, ...args);
}
