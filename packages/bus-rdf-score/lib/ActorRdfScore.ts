import type { IAction, IActorArgs, IActorOutput, IActorTest } from '@comunica/core';
import { Actor } from '@comunica/core';
import type * as RDF from 'rdf-js';

/**
 * A comunica actor for the rdf-score bus.
 *
 * Actor types:
 * * Input:  IActionRdfScore
 * * Test:   IActorRdfScoreTest
 * * Output: IActorRdfScoreOutput
 *
 * @see IActionRdfScore
 * @see IActorRdfScoreTest
 * @see IActorRdfScoreOutput
 */
export abstract class ActorRdfScore<T> extends
  Actor<IActionRdfScore<T>, IActorRdfScoreTest, IActorRdfScoreOutputSingle> {
  public constructor(
    args: IActorArgs<IActionRdfScore<T>, IActorRdfScoreTest, IActorRdfScoreOutputSingle>,
  ) {
    super(args);
  }

  protected extractFoundValues(action: IActionRdfScore<T>): any[] {
    if (Array.isArray(action.literalValue)) {
      return action.literalValue;
    }

    return [ action.literalValue || action.quad.object.value ];
  }

  protected extractExpectedValues(action: IActionRdfScore<T>): T[] {
    let expectedValues;

    if (action.expectedPredicateValues) {
      expectedValues = action.expectedPredicateValues[action.quad.predicate.value];
    }

    if (!expectedValues || expectedValues.length === 0) {
      // No match yet
      if (action.quad.object.termType === 'Literal' && action.expectedDatatypeValues) {
        expectedValues = action.expectedDatatypeValues[action.quad.object.datatype.value];
      }
    }

    return expectedValues || [];
  }
}

// Multiple values may searched for at the same time
export type IExpectedValues = Record<string, any[]>;

export interface IActionRdfScore<T> extends IAction {
  /**
   * The statement that is to be scored
   */
  quad: RDF.Quad;

  /**
   * An index from predicate URIs to the expected value of these predicates.
   * Takes precedent over the expectedDatatypeValues.
   */
  expectedPredicateValues?: IExpectedValues;

  /**
   * An index from datatype URIs to the expected value of these literals.
   */
  expectedDatatypeValues?: IExpectedValues;

  /**
   * If provided, this represents the (normalized) value that should be evaluated instead of the object value.
   */
  literalValue?: T | T[];
}

export interface IActorRdfScoreTest extends IActorTest {
  /**
   * Simple result; an actor can score a quad or it can not
   */
  suitable: boolean;
}

export type RDFScore = number | null;

export interface IActorRdfScoreOutput extends IActorOutput {
  /**
   * Each quad is scored on { [-Inf, +Inf] ∪ {null} }*.
   * +Inf is the best possible score,
   * -Inf the worst possible score,
   * null indicates that this quad could not be scored by this actor.
   *
   * Higher dimensional values have the following ordering:
   * (a,b) ≤ (a′,b′) if and only if a < a′ or (a = a′ and b ≤ b′).
   * When a or a' are null, they are considered to be equal for the sake of ordering.
   */
  score: RDFScore | RDFScore[];
}

export interface IActorRdfScoreOutputSingle extends IActorRdfScoreOutput {
  /**
   * Scalar scoring output, most likely the result of a single actor.
   */
  score: RDFScore;
}

export interface IActorRdfScoreOutputMultiple extends IActorRdfScoreOutput {
  /**
   * Higher dimensional scoring output, most likely the result of a mediator.
   */
  score: RDFScore[];
}
