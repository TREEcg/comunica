import type { IActorArgs } from '@comunica/core';
import type {
  IActionTreeScore,
  IActorTreeScoreOutput,
  IActorTreeScoreTest,
} from '@treecg/bus-tree-score';
import { ActorTreeScore } from '@treecg/bus-tree-score';

const SUBSTRING_TYPE = 'https://w3id.org/tree#SubstringRelation';
const PREFIX_TYPE = 'https://w3id.org/tree#PrefixRelation';

/**
 * Returns the sum of the tree values' length if, and only if, all found tree values are prefixes of the input terms.
 */
export class ActorTreeScoreExactPrefix extends ActorTreeScore {
  public constructor(args: IActorTreeScoreExactPrefixArgs) {
    super(args);
  }

  public async test(action: IActionTreeScore): Promise<IActorTreeScoreTest> {
    if (PREFIX_TYPE in action.expectedValues && PREFIX_TYPE in action.values) {
      return { suitable: true };
    }

    if (
      SUBSTRING_TYPE in action.expectedValues &&
      (SUBSTRING_TYPE in action.values || PREFIX_TYPE in action.values)
    ) {
      return { suitable: true };
    }

    return { suitable: false };
  }

  public async run(action: IActionTreeScore): Promise<IActorTreeScoreOutput> {
    let score = 0;

    if (PREFIX_TYPE in action.expectedValues && PREFIX_TYPE in action.values) {
      const found = action.values[PREFIX_TYPE].map(quad => quad.value);
      const expected = action.expectedValues[PREFIX_TYPE].map(quad => quad.value);
      score = this._score(found, expected);
    }

    if (
      SUBSTRING_TYPE in action.expectedValues &&
      (SUBSTRING_TYPE in action.values || PREFIX_TYPE in action.values)
    ) {
      const foundPrefixes = (action.values[PREFIX_TYPE] || []).map(quad => quad.value);
      const foundSubstrings = (action.values[SUBSTRING_TYPE] || []).map(quad => quad.value);
      const found = [ ...foundPrefixes, ...foundSubstrings ];
      const expected = action.expectedValues[SUBSTRING_TYPE].map(quad => quad.value);
      score = this._score(found, expected);
    }

    return { score };
  }

  protected _score(treeValues: string[], expectedValues: string[]): number {
    let score = 0;

    for (const treeValue of treeValues) {
      let found = false;
      for (const expectedValue of expectedValues) {
        if (expectedValue.startsWith(treeValue)) {
          score += treeValue.length;
          found = true;
          break;
        }
      }
      if (!found) {
        // None of the expected values matched
        return 0;
      }
    }

    return score;
  }
}

export interface IActorTreeScoreExactPrefixArgs extends
  IActorArgs<IActionTreeScore, IActorTreeScoreTest, IActorTreeScoreOutput> {
}
