import { Bus } from '@comunica/core';
import { ActorRdfScore } from '@hdelva/bus-rdf-score';
import { DataFactory } from 'rdf-data-factory';
import { ActorRdfScoreExactPrefix } from '../lib/ActorRdfScoreExactPrefix';

const DF = new DataFactory();

function createStringQuad(s: string, p: string, o: string) {
  return DF.quad(DF.namedNode(s), DF.namedNode(p), DF.literal(o));
}

function createLangStringQuad(s: string, p: string, o: string) {
  return DF.quad(DF.namedNode(s), DF.namedNode(p), DF.literal(o, 'en'));
}

function createNumberQuad(s: string, p: string, o: string) {
  return DF.quad(
    DF.namedNode(s),
    DF.namedNode(p),
    DF.literal(o, DF.namedNode('http://www.w3.org/2001/XMLSchema#integer')),
  );
}

function createNamedNodeQuad(s: string, p: string, o: string) {
  return DF.quad(DF.namedNode(s), DF.namedNode(p), DF.namedNode(o));
}

describe('ActorRdfScoreExactPrefix', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorRdfScoreExactPrefix module', () => {
    it('should be a function', () => {
      expect(ActorRdfScoreExactPrefix).toBeInstanceOf(Function);
    });

    it('should be a ActorRdfScoreExactPrefix constructor', () => {
      expect(new (<any>ActorRdfScoreExactPrefix)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorRdfScoreExactPrefix);
      expect(new (<any>ActorRdfScoreExactPrefix)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorRdfScore);
    });

    it('should not be able to create new ActorRdfScoreExactPrefix objects without \'new\'', () => {
      expect(() => { (<any>ActorRdfScoreExactPrefix)(); }).toThrow();
    });
  });

  describe('An ActorRdfScoreExactPrefix instance', () => {
    let actor: ActorRdfScoreExactPrefix;

    beforeEach(() => {
      actor = new ActorRdfScoreExactPrefix({ name: 'actor', bus, maxPrefixTolerance: 1 });
    });

    it('should test on string value', () => {
      const result = actor.test({
        quad: createStringQuad('sub', 'pred', 'test'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should test on lang string value', () => {
      const result = actor.test({
        quad: createLangStringQuad('sub', 'pred', 'test'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should not test on integer value', () => {
      const result = actor.test({
        quad: createNumberQuad('sub', 'pred', '4'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'te' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: false });
    });

    it('should not test on non-literals', () => {
      const result = actor.test({
        quad: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
        literalValue: [ 'anna' ],
        expectedPredicateValues: {
          pred: [ 'anna' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: false });
    });

    it('should match expected data type value, exact match', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 1 });
    });

    it('should prioritize explicit literal values', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
        literalValue: [ 'alphonse', 'meterie' ],
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 2 });
    });

    it('should not care about the order of values', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
        literalValue: [ 'meterie', 'alphonse' ],
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 2 });
    });

    it('should match expected predicate value, exact match', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
        expectedPredicateValues: {
          pred: [ 'alphonse' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 1 });
    });

    it('should not match everything', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'pablo'),
        expectedPredicateValues: {
          pred: [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: Number.NEGATIVE_INFINITY });
    });

    it('should not count occurences twice', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'de decker'),
        literalValue: [ 'de', 'decker' ],
        expectedPredicateValues: {
          pred: [ 'de' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 1 });
    });

    it('should not count occurences twice, unless explicitly expecting them twice', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'de decker'),
        literalValue: [ 'de', 'decker' ],
        expectedPredicateValues: {
          pred: [ 'de', 'de' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: 2 });
    });

    it('should not detect overlap', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'pred', 'anne'),
        expectedPredicateValues: {
          pred: [ 'anna' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: Number.NEGATIVE_INFINITY });
    });

    it('should return -Inf when no expected values match the quad', () => {
      const result = actor.run({
        quad: createStringQuad('sub', 'otherpred', ' Anna '),
        literalValue: 'anna',
        expectedPredicateValues: {
          pred: [ 'anna' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: Number.NEGATIVE_INFINITY });
    });

    it('should return null when it wasn\'t even a literal', () => {
      const result = actor.run({
        quad: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
        literalValue: 'anna',
        expectedPredicateValues: {
          pred: [ 'anna' ],
        },
      });
      return expect(result).resolves.toMatchObject({ score: null });
    });
  });
});
