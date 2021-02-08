import type { IActorArgs } from '@comunica/core';
import { ActorRdfScore } from '@treecg/bus-rdf-score';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@treecg/bus-rdf-score';

export class ActorRdfScoreBiGram extends ActorRdfScore<string> {
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

      const expectedBigrams: Map<string, number> = new Map();
      for (const expected of expectedValues) {
        for (let i = 0; i < expected.length - 1; i++) {
          const bigram = expected.slice(i, i + 2);
          const count = (expectedBigrams.get(bigram) || 0) + 1;

          expectedBigrams.set(bigram, count);
        }
      }

      let intersectionSize = 0;
      for (const found of foundValues) {
        for (let i = 0; i < found.length - 1; i++) {
          const bigram = found.slice(i, i + 2);
          const count = expectedBigrams.get(bigram) || 0;

          if (count > 0) {
            expectedBigrams.set(bigram, count - 1);
            intersectionSize++;
          }
        }
      }

      score = intersectionSize;
    }

    return { score };
  }
}
