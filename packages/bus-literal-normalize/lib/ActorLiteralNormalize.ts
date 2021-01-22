import type { IAction, IActorArgs, IActorOutput, IActorTest } from '@comunica/core';
import { Actor } from '@comunica/core';
import type * as RDF from 'rdf-js';

export abstract class ActorLiteralNormalize<T> extends
  Actor<IActionLiteralNormalize<T>, IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<T>> {
  public constructor(
    args: IActorArgs<IActionLiteralNormalize<T>, IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<T>>,
  ) {
    super(args);
  }
}

export interface IActionLiteralNormalize<T> extends IAction {
  /**
   * The statement with the literal that is to be normalized
   * OR the literal itself
   */
  data: RDF.Quad | T;
}

export interface IActorLiteralNormalizeTest extends IActorTest {
  /**
   * Simple result; an actor can normalize a value or it can not
   */
  suitable: boolean;
}

export interface IActorLiteralNormalizeOutput<T> extends IActorOutput {
  result: T[];
}
