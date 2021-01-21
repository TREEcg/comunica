import type { IActorArgs } from '@comunica/core';
import { ActorRdfScore } from '@hdelva/bus-rdf-score';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@hdelva/bus-rdf-score';

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

      // Prioritize the literalValue, as this may contain a preprocessed version of the literal
      const found: string = action.literalValue || action.quad.object.value;

      const expectedValues: string[] = this.extractExpectedValues(action);

      // Of all specified expectedValues, take the one with the highest score
      for (const expected of expectedValues) {
        let t = 0;
        const minLength = Math.min(expected.length, found.length);

        for (let i = 0; i < minLength; i++) {
          // TODO: Can we avoid direct indexing, might be a bottleneck
          if (found[i] === expected[i]) {
            t += 1;
          } else {
            break;
          }
        }

        score = Math.max(score, t / minLength);
      }
    }

    return { score };
  }
}
