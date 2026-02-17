// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER — Dev-only logging utility
// In production builds, log() and warn() are fully dead-code-eliminated.
// ═══════════════════════════════════════════════════════════════════════════════

export const __DEV__ = process.env.NODE_ENV !== "production";

/** Console.log that is silenced in production. */
export const log = (...args: unknown[]): void => {
    if (__DEV__) console.log(...args);
};

/** Console.warn that is silenced in production. */
export const warn = (...args: unknown[]): void => {
    if (__DEV__) console.warn(...args);
};
