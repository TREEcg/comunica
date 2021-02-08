import type { IActorArgs } from '@comunica/core';
import { ActorRdfScore } from '@treecg/bus-rdf-score';
import type { IActionRdfScore, IActorRdfScoreOutputSingle, IActorRdfScoreTest } from '@treecg/bus-rdf-score';

export class ActorRdfScoreStringLength extends ActorRdfScore<string> {
  public readonly ascending: boolean;

  public constructor(args: IActorRdfScoreStringLengthArgs) {
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
      score = action.quad.object.value.length;

      if (this.ascending) {
        score *= -1;
      }
    }

    return { score };
  }
}

export interface IActorRdfScoreStringLengthArgs
  extends IActorArgs<IActionRdfScore<string>, IActorRdfScoreTest, IActorRdfScoreOutputSingle> {
  ascending: boolean;
}
