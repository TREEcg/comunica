import type { IActorArgs } from '@comunica/core';
import { ActorRdfScore } from '@treecg/bus-rdf-score';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@treecg/bus-rdf-score';

export class ActorRdfScoreCommonPrefix extends ActorRdfScore<string> {
  public constructor(
    args: IActorArgs<IActionRdfScore<string>, IActorRdfScoreTest, IActorRdfScoreOutputSingle>,
  ) {
    super(args);
  }

  public async test(action: IActionRdfScore<any>): Promise<IActorRdfScoreTest> {
    const quadObject = action.quad.object;
    if (quadObject.termType === 'Literal') {
      const dataType = quadObject.datatype.value;
      if (
        dataType === 'http://www.w3.org/2001/XMLSchema#string' ||
        dataType === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
      ) {
        return { suitable: true };
      }
    }

    return { suitable: false };
  }

  public async run(action: IActionRdfScore<string>): Promise<IActorRdfScoreOutputSingle> {
    let score = null;

    if (action.quad.object.termType === 'Literal') {
      // Any literal results in a valid score
      score = 0;

      const foundValues: string[] = this.extractFoundValues(action);
      const expectedValues: string[] = this.extractExpectedValues(action);

      const expectedTokens: Map<string, number> = new Map();
      for (const token of expectedValues) {
        const count = expectedTokens.get(token) || 0;
        expectedTokens.set(token, count + 1);
      }

      // We're trying to account for every character in the expected values
      for (const [ expected, count ] of expectedTokens) {
        let t = 0;

        for (const found of foundValues) {
          const minLength = Math.min(expected.length, found.length);

          for (let i = 0; i < minLength; i++) {
            // TODO: Can we avoid direct indexing, might be a bottleneck
            if (found[i] === expected[i]) {
              t += 1;
            } else {
              break;
            }
          }
        }

        score += Math.min(t, expected.length * count);
      }
    }

    return { score };
  }
}
