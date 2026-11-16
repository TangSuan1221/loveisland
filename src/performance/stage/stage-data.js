import { STAGES as recipes } from './stage-data.generated.js';

/** Published recipes are immutable and shared by all stage instances. */
function freezeRecipe(node) {
  for (const child of Object.values(node)) {
    if (child && typeof child === 'object') freezeRecipe(child);
  }
  return Object.freeze(node);
}

export const STAGES = freezeRecipe(recipes);
export function loadStages() { return STAGES; }
