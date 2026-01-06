import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load environment variables from a specific .env file
 *
 * Wrapper around dotenv.config() that loads variables from the specified
 * file path into process.env. Silently ignores missing files.
 *
 * File Format:
 * - Standard .env format (KEY=value)
 * - One variable per line
 * - Comments start with #
 * - Supports variable expansion
 *
 * @param path - Absolute path to the .env file
 *
 * @example
 * ```typescript
 * // Load from specific file
 * setupDotenvFile('/app/.env.production');
 *
 * // Access loaded variables
 * console.log(process.env.AWS_S3_ENDPOINT);
 * ```
 */
const setupDotenvFile = (path: string) => dotenv.config({ path });

/**
 * Load environment variables from multiple .env files based on NODE_ENV
 *
 * Loads .env files in priority order (later files override earlier ones):
 * 1. .env.{env}.local (e.g., .env.production.local) - Environment-specific, local overrides
 * 2. .env.{env} (e.g., .env.production) - Environment-specific defaults
 * 3. .env.local - Local overrides for all environments
 * 4. .env - Base defaults for all environments
 *
 * This follows the standard dotenv file priority convention used by many
 * frameworks (Create React App, Next.js, etc.).
 *
 * Missing Files:
 * - All files are optional - silently skips if file doesn't exist
 * - Commonly, only .env and .env.local exist in development
 * - Production may have .env.production or .env.production.local
 *
 * Auto-Initialization:
 * - This module auto-executes on import
 * - Loads files based on NODE_ENV environment variable
 * - No manual initialization required
 *
 * @param env - Environment name (e.g., 'development', 'production', 'test')
 *
 * @example
 * ```typescript
 * // Auto-loaded on module import based on NODE_ENV
 * // NODE_ENV=production loads: .env.production.local, .env.production, .env.local, .env
 *
 * // Manual usage (if needed)
 * setupDotenvFilesForEnv('staging');
 * // Loads: .env.staging.local, .env.staging, .env.local, .env
 * ```
 *
 * @example
 * ```typescript
 * // Typical file structure:
 * // .env                    - Base config (committed to git)
 * // .env.local              - Local overrides (gitignored)
 * // .env.production         - Production config (committed to git)
 * // .env.production.local   - Production secrets (gitignored)
 * ```
 */
const setupDotenvFilesForEnv = (env: string): void => {
  const RELATIVE_DIRNAME = path.resolve(__dirname, '..', '..');

  if (env) {
    setupDotenvFile(path.resolve(RELATIVE_DIRNAME, `.env.${env}.local`));
    setupDotenvFile(path.resolve(RELATIVE_DIRNAME, `.env.${env}`));
  }

  setupDotenvFile(path.resolve(RELATIVE_DIRNAME, '.env.local'));
  setupDotenvFile(path.resolve(RELATIVE_DIRNAME, '.env'));
};

// Auto initialize on module load based on NODE_ENV
setupDotenvFilesForEnv(process.env && process.env.NODE_ENV);
