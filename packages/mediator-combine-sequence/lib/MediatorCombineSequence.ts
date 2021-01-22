import type { Actor, IAction, IActorOutput, IActorReply, IActorTest, IMediatorArgs } from '@comunica/core';
import { Mediator } from '@comunica/core';

/**
 * Mediator that will send the action to _all_ subscribed Actors on the Bus.
 * If one actor's test indicates it cannot handle the action,
 * a `null` is inserted instead.
 * There should always be a response for each actor,
 * and the order is deterministic iff the actors are ordered using the beforeActor configuration.
 */
export class MediatorCombineSequence<A extends Actor<I, T, O>, I extends IAction, T extends IActorTest,
  O extends IActorOutput> extends Mediator<A, I, T, O> implements IMediatorCombineSequenceArgs<A, I, T, O> {
  public readonly outputField: string;
  public readonly testField: string;

  public constructor(args: IMediatorCombineSequenceArgs<A, I, T, O>) {
    super(args);
  }

  // Todo: consider returning an AsyncIterator<O> instead
  public async mediate(action: I): Promise<O> {
    let testResults: IActorReply<A, I, T, O>[];
    try {
      testResults = this.publish(action);
    } catch {
      testResults = [];
    }

    const data = [];
    for (const reply of testResults) {
      const response = await reply.reply;
      if ((<any> response)[this.testField]) {
        // If the response is truthy, send it to the actor
        const result = await reply.actor.runObservable(action);
        data.push((<any> result)[this.outputField]);
      } else {
        // The response was not truthy, insert null in the responses
        data.push(null);
      }
    }
    const result = {};
    (<any> result)[this.outputField] = data;

    return <O> result;
  }

  protected mediateWith(action: I, testResults: IActorReply<A, I, T, O>[]): Promise<A> {
    throw new Error('Method not implemented.');
  }
}

export interface IMediatorCombineSequenceArgs<A extends Actor<I, T, O>, I extends IAction, T extends IActorTest,
  O extends IActorOutput> extends IMediatorArgs<A, I, T, O> {
  /**
   * The field name of the output field over which must be mediated.
   */
  outputField: string;

  /**
   * The field name of the test result field over which must be mediated.
   */
  testField: string;
}
