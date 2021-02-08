import type { IActorArgs } from '@comunica/core';
import { ActorRdfScoreCommonPrefix } from '@treecg/actor-rdf-score-common-prefix';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@treecg/bus-rdf-score';

/**
 * This actor returns how many of the expectedValue(s) occurred as in the foundValue(s) as well.
 * A constant amount `maxPrefixTolerance` of these matches does not have to be an exact match,
 * But may be a prefix match instead.
 */
export class ActorRdfScoreExactPrefix extends ActorRdfScoreCommonPrefix {
  public readonly maxPrefixTolerance: number;

  public constructor(args: IActorRdfScoreExactPrefixArgs) {
    super(args);
  }

  public async run(action: IActionRdfScore<string>): Promise<IActorRdfScoreOutputSingle> {
    let score = null;

    if (action.quad.object.termType === 'Literal') {
      // How many prefix matches do we have so far
      let prefixTolerance = 0;

      const foundValues: string[] = this.extractFoundValues(action);
      const expectedValues: string[] = this.extractExpectedValues(action);

      const expectedTokens: Map<string, number> = new Map();
      for (const token of expectedValues) {
        const count = expectedTokens.get(token) || 0;
        expectedTokens.set(token, count + 1);
      }

      for (const [ expectedValue, expectedCount ] of expectedTokens.entries()) {
        let count = 0;

        for (const foundValue of foundValues) {
          if (foundValue === expectedValue) {
            count++;
          } else if (prefixTolerance < this.maxPrefixTolerance && foundValue.startsWith(expectedValue)) {
            prefixTolerance++;
            count++;
          }
        }

        if (count >= expectedCount) {
          // This prefix occurred enough in the foundValue(s)
          if (score === null) {
            // This score just became valid
            score = 0;
          }
          // Increment the score by how many matches we were looking for
          // Not how many were actually found
          score += expectedCount;
        }
      }

      if (score !== expectedValues.length) {
        // Not all values are accounted for
        score = Number.NEGATIVE_INFINITY;
      }
    }

    return { score };
  }
}

export interface IActorRdfScoreExactPrefixArgs extends
  IActorArgs<IActionRdfScore<string>, IActorRdfScoreTest, IActorRdfScoreOutputSingle> {
  // How many prefix matches do we tolerate
  // All other matches must be exact
  maxPrefixTolerance: number;
}
