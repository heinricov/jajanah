export interface LoadEnvironmentOptions {
  /** Defaults to `process.env.NODE_ENV`, falling back to `"development"`. */
  mode?: string;
  /** Repo root to read `.env*` files from. Defaults to auto-detection via `findRepoRoot()`. */
  root?: string;
}

/**
 * Find the monorepo root by walking up from `startDir` until `pnpm-workspace.yaml`
 * is found. Falls back to `startDir` when no workspace marker exists.
 */
export declare function findRepoRoot(startDir?: string): string;

/**
 * Read root `.env` files for `mode` (in precedence order) and fill `process.env`.
 * Values already present in `process.env` always win. Runs automatically on import.
 *
 * @returns a frozen snapshot of the values read from the files.
 */
export declare function loadEnvironment(
  options?: LoadEnvironmentOptions,
): Readonly<Record<string, string>>;

/** Read a value from `process.env` (loaded from root `.env*` files), with optional fallback. */
export declare function getEnv(name: string, fallback?: string): string | undefined;

/** Read a value from `process.env`, throwing when it is missing or empty. */
export declare function requireEnv(name: string): string;

/** Read-only live view over `process.env`, e.g. `environment.API_BASE_URL`. */
export declare const environment: Readonly<Record<string, string | undefined>>;
