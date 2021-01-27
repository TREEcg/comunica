import type { IAction, IActorArgs, IActorOutput, IActorTest } from '@comunica/core';
import { Actor } from '@comunica/core';
import type * as RDF from 'rdf-js';

export type TreeValues = Record<string, RDF.Literal[]>;

export abstract class ActorTreeScore extends
  Actor<IActionTreeScore, IActorTreeScoreTest, IActorTreeScoreOutput> {
  public constructor(
    args: IActorArgs<IActionTreeScore, IActorTreeScoreTest, IActorTreeScoreOutput>,
  ) {
    super(args);
  }
}

export interface IActionTreeScore extends IAction {
  /**
   * The tree values that need to be scored
   */
  values: TreeValues;

  /**
   * The expected values for each relation type
   */
  expectedValues: TreeValues;
}

export interface IActorTreeScoreTest extends IActorTest {
  /**
   * Simple result; an actor can score a value or it can not
   */
  suitable: boolean;
}

export interface IActorTreeScoreOutput extends IActorOutput {
  /**
   * Each value is scored on { [-Inf, +Inf] ∪ {null} }*.
   * +Inf is the best possible score,
   * -Inf the worst possible score,
   * null indicates that this quad could not be scored by this actor.
   *
   * Higher dimensional values have the following ordering:
   * (a,b) ≤ (a′,b′) if and only if a < a′ or (a = a′ and b ≤ b′).
   * When a or a' are null, they are considered to be equal for the sake of ordering.
   */
  score: number | number[];
}
