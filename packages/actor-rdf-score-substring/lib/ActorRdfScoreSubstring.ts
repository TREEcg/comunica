import type { IActorArgs } from '@comunica/core';
import { ActorRdfScoreCommonPrefix } from '@treecg/actor-rdf-score-common-prefix';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@treecg/bus-rdf-score';

/**
 * Based on ActorTreeScoreSubstring, which is better documented.
 */
export class ActorRdfScoreSubstring extends ActorRdfScoreCommonPrefix {
  public readonly maxPrefixTolerance: number;

  public constructor(args: IActorRdfScoreSubstringArgs) {
    super(args);
  }

  public async run(action: IActionRdfScore<string>): Promise<IActorRdfScoreOutputSingle> {
    if (action.quad.object.termType !== 'Literal') {
      return { score: null };
    }

    let score = 0;

    const literalValues: string[] = this.extractFoundValues(action);
    let inputValues: string[] = this.extractExpectedValues(action);

    if (literalValues.length === 0 || inputValues.length === 0) {
      // Nothing to work with
      return { score: Number.NEGATIVE_INFINITY };
    }

    // Longest substrings first; these are the most specific
    inputValues = inputValues.sort((first, second) => first.length > second.length ? -1 : 1);

    const matchedLiteralValues: boolean[] = new Array(literalValues.length).fill(false);
    const matchedInputValues: boolean[] = new Array(inputValues.length).fill(false);
    const usedSubstrings: boolean[][] = literalValues.map(value => new Array(value.length).fill(false));

    // Phase 1: find input values that are prefixes of the literal values
    for (const [ inputIdx, inputValue ] of inputValues.entries()) {
      for (const [ literalIdx, literalValue ] of literalValues.entries()) {
        if (matchedLiteralValues[literalIdx]) {
          // Already found a longer prefix for this literal value
          continue;
        }
        if (literalValue.startsWith(inputValue)) {
          score += inputValue.length + inputValue.length / literalValue.length;

          // Label these two values as used in phase 1
          matchedInputValues[inputIdx] = true;
          matchedLiteralValues[literalIdx] = true;
          this.markUsed(usedSubstrings[literalIdx], 0, inputValue.length);
          break;
        }
      }
    }

    for (const [ inputIdx, inputValue ] of inputValues.entries()) {
      if (matchedInputValues[inputIdx]) {
        // Phase 1 found a match for this input value - it's used a prefix in one of the literal values
        continue;
      }
      let found = false;
      for (const [ literalIdx, literalValue ] of literalValues.entries()) {
        if (!matchedLiteralValues[literalIdx]) {
          // We found no input value that's a prefix of this expected value, ignore it
          continue;
        }

        // Find the best match for this tree value in this expected value, exclusively using unused characters
        const index = this.findMatch(inputValue, literalValue, usedSubstrings[literalIdx]);
        if (index > -1) {
          score += inputValue.length / index;
          this.markUsed(usedSubstrings[literalIdx], index, inputValue.length);
          found = true;
          break;
        }
      }
      if (!found) {
        // None of the literal values matched; this input value remains unmatched
        return { score: Number.NEGATIVE_INFINITY };
      }
    }

    // Phase 3:
    // We know all input values have been matched to this literal, but is it someone may have actually typed?
    let prefixMatches = 0;
    for (const [ literalIdx, literalValue ] of literalValues.entries()) {
      const charactersUsed = usedSubstrings[literalIdx].filter(used => used).length;
      if (charactersUsed === 0 || charactersUsed === literalValue.length) {
        // If all characters are used, the user has typed this word
        // If no characters are used, the user simply hasn't gotten to this word yet
        continue;
      }

      // We know there's at least a prefix match in this value, because of phase 1
      prefixMatches++;

      if (this.maxPrefixTolerance < prefixMatches) {
        // There are too many unfinished words
        return { score: Number.NEGATIVE_INFINITY };
      }
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
}

export interface IActorRdfScoreSubstringArgs extends
  IActorArgs<IActionRdfScore<string>, IActorRdfScoreTest, IActorRdfScoreOutputSingle> {
  // How many prefix matches do we tolerate
  // All other matches must be exact
  maxPrefixTolerance: number;
}
