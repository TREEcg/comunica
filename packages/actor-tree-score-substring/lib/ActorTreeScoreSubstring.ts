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
 * Returns a score if, and only if, every tree value:
 *   is a prefix of an input value;
 *   or a substring of an input value that already has a matching prefix tree value
 * Let 'i' be the position at which tree value 't' occurs in input value 'x', the score is incremented by:
 *   |t| + |t| / |x|   if i = 0
 *   |t| / (|x| + i)   else
 * This means that:
 *   prefix matches (i=0) are prioritized (increment value > 1) over regular substring matches (increment value < 1);
 *   and matches in short input values are prioritized (|x| in denominator is smaller)
 * The latter choice may be counter intuitive as shorter input values are likely more common
 *   - and thus require more page lookups to find specific entities.
 * However, this also increases the likelihood of cache hits - both on the client, and in the network.
 * In other words, if two tree values of the same length match the input,
 *   the one that's most likely already cached will be prioritized.
 */
export class ActorTreeScoreSubstring extends ActorTreeScore {
  public constructor(args: IActorTreeScoreSubstringArgs) {
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
      score = this.score(found, expected);
    }

    if (
      SUBSTRING_TYPE in action.expectedValues &&
      (SUBSTRING_TYPE in action.values || PREFIX_TYPE in action.values)
    ) {
      const treePrefixes = (action.values[PREFIX_TYPE] || []).map(quad => quad.value);
      const treeSubstrings = (action.values[SUBSTRING_TYPE] || []).map(quad => quad.value);
      const found = [ ...treePrefixes, ...treeSubstrings ];
      const expected = action.expectedValues[SUBSTRING_TYPE].map(quad => quad.value);
      const uniqueExpected = new Set(expected);
      score = this.score(found, [ ...uniqueExpected ]);
    }

    return { score };
  }

  protected markUsed(usedSubstrings: boolean[], begin: number, length: number): void {
    for (let i = begin; i < begin + length; i++) {
      usedSubstrings[i] = true;
    }
  }

  protected findMatch(treeValue: string, expectedValue: string, usedSubstrings: boolean[]): number {
    let currentIndex = expectedValue.indexOf(treeValue);
    while (currentIndex > -1) {
      let conflict = false;
      for (let i = currentIndex; i < currentIndex + treeValue.length; i++) {
        if (usedSubstrings[i]) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        return currentIndex;
      }

      currentIndex = expectedValue.indexOf(treeValue, currentIndex + 1);
    }

    return -1;
  }

  protected score(treeValues: string[], expectedValues: string[]): number {
    let score = 0;

    // Longest substrings first; these are the most specific
    treeValues = treeValues.sort((first, second) => first.length > second.length ? -1 : 1);

    const matchedTreeValues: boolean[] = new Array(treeValues.length).fill(false);
    const matchedExpectedValues: boolean[] = new Array(expectedValues.length).fill(false);
    const usedSubstrings: boolean[][] = expectedValues.map(value => new Array(value.length).fill(false));

    // Phase 1: find tree values that are prefixes of the expected values
    for (const [ treeIdx, treeValue ] of treeValues.entries()) {
      for (const [ expectedIdx, expectedValue ] of expectedValues.entries()) {
        if (matchedExpectedValues[expectedIdx]) {
          // Already found a longer prefix for this expected value
          continue;
        }
        if (expectedValue.startsWith(treeValue)) {
          // Score is proportional to the total length of the tree values
          score += treeValue.length + treeValue.length / expectedValue.length;
          // Label these two values as used in phase 1
          matchedTreeValues[treeIdx] = true;
          matchedExpectedValues[expectedIdx] = true;
          this.markUsed(usedSubstrings[expectedIdx], 0, treeValue.length);
          break;
        }
      }
    }

    for (const [ treeIdx, treeValue ] of treeValues.entries()) {
      if (matchedTreeValues[treeIdx]) {
        // Phase 1 found a match for this tree value - it's used a prefix in one of the expected values
        continue;
      }
      let found = false;
      for (const [ expectedIdx, expectedValue ] of expectedValues.entries()) {
        if (!matchedExpectedValues[expectedIdx]) {
          // We found no tree value that's a prefix of this expected value, ignore it
          continue;
        }

        // Find the best match for this tree value in this expected value, exclusively using unused characters
        const index = this.findMatch(treeValue, expectedValue, usedSubstrings[expectedIdx]);
        if (index > -1) {
          score += treeValue.length / (expectedValue.length + index);
          this.markUsed(usedSubstrings[expectedIdx], index, treeValue.length);
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

export interface IActorTreeScoreSubstringArgs extends
  IActorArgs<IActionTreeScore, IActorTreeScoreTest, IActorTreeScoreOutput> {
}
