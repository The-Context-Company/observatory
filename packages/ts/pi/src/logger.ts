let DEBUG_ENABLED = false;

export function setDebug(enabled: boolean): void {
  DEBUG_ENABLED = enabled;
}

export function debug(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;

  const prefix = "\x1b[36m[TCC Pi]\x1b[0m";
  console.log(
    prefix,
    ...args.map((a) =>
      typeof a === "object" && a !== null
        ? JSON.stringify(a, null, 2)
        : String(a)
    )
  );
}
