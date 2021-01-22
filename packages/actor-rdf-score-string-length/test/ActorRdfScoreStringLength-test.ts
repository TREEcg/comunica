import { Bus } from '@comunica/core';
import { ActorRdfScore } from '@hdelva/bus-rdf-score';
import { DataFactory } from 'rdf-data-factory';
import { ActorRdfScoreStringLength } from '../lib/ActorRdfScoreStringLength';

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

describe('ActorRdfScoreStringLength', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorRdfScoreStringLength module', () => {
    it('should be a function', () => {
      expect(ActorRdfScoreStringLength).toBeInstanceOf(Function);
    });

    it('should be a ActorRdfScoreStringLength constructor', () => {
      expect(new (<any>ActorRdfScoreStringLength)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorRdfScoreStringLength);
      expect(new (<any>ActorRdfScoreStringLength)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorRdfScore);
    });

    it('should not be able to create new ActorRdfScoreStringLength objects without \'new\'', () => {
      expect(() => { (<any>ActorRdfScoreStringLength)(); }).toThrow();
    });
  });

  describe('An ActorRdfScoreStringLength instance', () => {
    let ascendingActor: ActorRdfScoreStringLength;
    let descendingActor: ActorRdfScoreStringLength;

    beforeEach(() => {
      ascendingActor = new ActorRdfScoreStringLength({ name: 'actor', bus, ascending: true });
      descendingActor = new ActorRdfScoreStringLength({ name: 'actor', bus, ascending: false });
    });

    it('should test on string value', () => {
      const result = ascendingActor.test({
        quad: createStringQuad('sub', 'pred', 'test'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should test on lang string value', () => {
      const result = ascendingActor.test({
        quad: createLangStringQuad('sub', 'pred', 'test'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'alphonse', 'meterie' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should not test on integer value', () => {
      const result = ascendingActor.test({
        quad: createNumberQuad('sub', 'pred', '4'),
        expectedDatatypeValues: {
          'http://www.w3.org/2001/XMLSchema#string': [ 'te' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: false });
    });

    it('should not test on non-literals', () => {
      const result = ascendingActor.test({
        quad: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
        literalValue: [ 'anna' ],
        expectedPredicateValues: {
          pred: [ 'anna' ],
        },
      });
      return expect(result).resolves.toMatchObject({ suitable: false });
    });

    it('should return negative number if ascending', () => {
      const result = ascendingActor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
      });
      return expect(result).resolves.toMatchObject({ score: -8 });
    });

    it('should return positive number if descending', () => {
      const result = descendingActor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
      });
      return expect(result).resolves.toMatchObject({ score: 8 });
    });

    it('should ignore literalValue properties', () => {
      const result = descendingActor.run({
        quad: createStringQuad('sub', 'pred', 'alphonse'),
        literalValue: [ 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' ],
      });
      return expect(result).resolves.toMatchObject({ score: 8 });
    });

    it('should return null when it wasn\'t even a literal', () => {
      const result = ascendingActor.run({
        quad: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
      });
      return expect(result).resolves.toMatchObject({ score: null });
    });
  });
});
