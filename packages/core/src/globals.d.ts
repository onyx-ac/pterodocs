/**
 * Ambient declarations for tokens the build substitutes.
 *
 * Kept in a declaration file so the replacement pass never sees the
 * declaration itself: rewriting `declare const __PTERODOC_VERSION__` into
 * `declare const "0.1.0"` is a syntax error.
 */

/** The package's version, replaced at build time; absent when running from source. */
declare const __PTERODOC_VERSION__: string | undefined;
