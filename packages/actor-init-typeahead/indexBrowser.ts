export * from './lib/ActorInitTypeaheadBrowser';

// eslint-disable-next-line no-duplicate-imports
import type { ActorInitTypeaheadBrowser } from './lib/ActorInitTypeaheadBrowser';

/**
 * Create a new comunica engine from the default config.
 * @return {ActorInitTypeaheadBrowser} A comunica engine.
 */
export function newEngine(): ActorInitTypeaheadBrowser {
  return require('./engine-default.js');
}
