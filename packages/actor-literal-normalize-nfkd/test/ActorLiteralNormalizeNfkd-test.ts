import { Bus } from '@comunica/core';
import { ActorLiteralNormalize } from '@treecg/bus-literal-normalize';
import { DataFactory } from 'rdf-data-factory';
import { ActorLiteralNormalizeNFKD } from '../lib/ActorLiteralNormalizeNfkd';

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

describe('ActorLiteralNormalizeNFKD', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorLiteralNormalizeNFKD module', () => {
    it('should be a function', () => {
      expect(ActorLiteralNormalizeNFKD).toBeInstanceOf(Function);
    });

    it('should be a ActorLiteralNormalizeNFKD constructor', () => {
      expect(new (<any>ActorLiteralNormalizeNFKD)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorLiteralNormalizeNFKD);
      expect(new (<any>ActorLiteralNormalizeNFKD)({ name: 'actor', bus }))
        .toBeInstanceOf(ActorLiteralNormalize);
    });

    it('should not be able to create new ActorLiteralNormalizeNFKD objects without \'new\'', () => {
      expect(() => { (<any>ActorLiteralNormalizeNFKD)(); }).toThrow();
    });
  });

  describe('An ActorLiteralNormalizeNFKD instance', () => {
    let actor: ActorLiteralNormalizeNFKD;

    beforeEach(() => {
      actor = new ActorLiteralNormalizeNFKD({ name: 'actor', bus });
    });

    it('should test on javascript primitives', () => {
      const result = actor.test({
        data: 'test',
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should test on string value', () => {
      const result = actor.test({
        data: createStringQuad('sub', 'pred', 'test'),
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should test on lang string value', () => {
      const result = actor.test({
        data: createLangStringQuad('sub', 'pred', 'test'),
      });
      return expect(result).resolves.toMatchObject({ suitable: true });
    });

    it('should not test on integer value', () => {
      const result = actor.test({
        data: createNumberQuad('sub', 'pred', '4'),
      });
      return expect(result).rejects.toThrow();
    });

    it('should not test on non-literals', () => {
      const result = actor.test({
        data: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
      });
      return expect(result).rejects.toThrow();
    });

    it('should not touch already normalized literals', () => {
      const result = actor.run({
        data: createStringQuad('sub', 'pred', 'alphonse'),
      });
      return expect(result).resolves.toMatchObject({ result: [ 'alphonse' ]});
    });

    it('should work on javascript primitives', () => {
      const result = actor.run({
        data: 'alphonse',
      });
      return expect(result).resolves.toMatchObject({ result: [ 'alphonse' ]});
    });

    it('should remove diacritics', () => {
      const result = actor.run({
        data: createStringQuad('sub', 'pred', 'bateau à moteur'),
      });
      return expect(result).resolves.toMatchObject({ result: [ 'bateau', 'a', 'moteur' ]});
    });

    it('should lowercase', () => {
      const result = actor.run({
        data: createStringQuad('sub', 'pred', 'AlPhonSe'),
      });
      return expect(result).resolves.toMatchObject({ result: [ 'alphonse' ]});
    });

    it('should not do anything if the input wasn\'t a literal', () => {
      const result = actor.run({
        data: createNamedNodeQuad('sub', 'otherpred', 'http://example.org'),
      });
      return expect(result).resolves.toMatchObject({ result: []});
    });
  });
});
