import type { Actor, IAction, IActorOutput, IActorTest } from '@comunica/core';
import type { IMediatorCombineUnionArgs } from '@comunica/mediator-combine-union';
import { MediatorCombineUnion } from '@comunica/mediator-combine-union';

/**
 * A comunica mediator that chains the results of all actors together.
 * Check out the beforeActor configuration property, to guarantee the order of actors.
 */
export class MediatorCombineSequence<A extends Actor<I, T, O>, I extends IAction, T extends IActorTest,
  O extends IActorOutput> extends MediatorCombineUnion<A, I, T, O> implements IMediatorCombineUnionArgs<A, I, T, O> {
  public constructor(args: IMediatorCombineSequenceArgs<A, I, T, O>) {
    super(args);
  }

  protected createCombiner(): (results: O[]) => O {
    return (results: O[]) => {
      let data: any[] = [];

      for (const result of results) {
        const rr = <any>result;
        if (Array.isArray(rr[this.field])) {
          data = [ ...data, ...rr[this.field] ];
        } else {
          data.push(rr[this.field]);
        }
      }

      const result: any = {};
      result[this.field] = data;
      return result;
    };
  }
}

export interface IMediatorCombineSequenceArgs<A extends Actor<I, T, O>, I extends IAction, T extends IActorTest,
  O extends IActorOutput> extends IMediatorCombineUnionArgs<A, I, T, O> {
}
