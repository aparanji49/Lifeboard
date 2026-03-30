/**
 * Logs only in non-production. Use for operational messages that should not appear in prod logs.
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

/**
 * In production, log only the error message (no full stack/object dump). In development, log the full value.
 */
export function logErrorSafe(prefix: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "unknown error";
    console.error(prefix, msg);
  } else {
    console.error(prefix, error);
  }
}
