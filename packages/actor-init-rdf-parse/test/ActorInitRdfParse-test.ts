import {ActorRdfParseN3} from "@comunica/actor-rdf-parse-n3";
import {ActorInit} from "@comunica/bus-init/lib/ActorInit";
import {Bus} from "@comunica/core/lib/Bus";
import {MediatorRace} from "@comunica/mediator-race";
import {PassThrough, Readable} from "stream";
import {ActorInitRdfParse} from "../lib/ActorInitRdfParse";

describe('ActorInitRdfParse', () => {
  let bus;
  let busInit;
  let mediator;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
    busInit = new Bus({ name: 'bus-init' });
    mediator = new MediatorRace({ name: 'mediator', bus: busInit });
  });

  describe('The ActorInitRdfParse module', () => {
    it('should be a function', () => {
      expect(ActorInitRdfParse).toBeInstanceOf(Function);
    });

    it('should be a ActorInitRdfParse constructor', () => {
      expect(new (<any> ActorInitRdfParse)({ name: 'actor', bus, mediatorRdfParse: mediator, mediaType: 'abc' }))
        .toBeInstanceOf(ActorInitRdfParse);
      expect(new (<any> ActorInitRdfParse)({ name: 'actor', bus, mediatorRdfParse: mediator, mediaType: 'abc' }))
        .toBeInstanceOf(ActorInit);
    });

    it('should not be able to create new ActorInitRdfParse objects without \'new\'', () => {
      expect(() => { (<any> ActorInitRdfParse)(); }).toThrow();
    });

    it('should throw an error when constructed without a mediaType', () => {
      expect(() => { new (<any> ActorInitRdfParse)({ name: 'actor', bus, mediatorRdfParse: mediator }); }).toThrow();
    });

    it('should throw an error when constructed without a mediator', () => {
      expect(() => { new (<any> ActorInitRdfParse)({ name: 'actor', bus, mediaType: 'abc' }); }).toThrow();
    });

    it('should throw an error when constructed without a mediaType and mediator', () => {
      expect(() => { new (<any> ActorInitRdfParse)({ name: 'actor', bus }); }).toThrow();
    });

    it('should throw an error when constructed without a name, bus, mediaType and mediator', () => {
      expect(() => { new (<any> ActorInitRdfParse)({}); }).toThrow();
    });

    it('should throw an error when constructed without arguments', () => {
      expect(() => { new (<any> ActorInitRdfParse)(); }).toThrow();
    });

    it('should store the \'mediatorRdfParse\' parameter', () => {
      expect(new ActorInitRdfParse({ name: 'actor', bus, mediatorRdfParse: mediator, mediaType: 'abc' })
        .mediatorRdfParse).toEqual(mediator);
    });

    it('should store the \'mediaType\' parameter', () => {
      expect(new ActorInitRdfParse({ name: 'actor', bus, mediatorRdfParse: mediator, mediaType: 'abc' })
        .mediaType).toEqual('abc');
    });
  });

  describe('An ActorInitRdfParse instance', () => {
    let actor: ActorInitRdfParse;
    let input: Readable;

    beforeEach(() => {
      actor = new ActorInitRdfParse({ name: 'actor', bus, mediatorRdfParse: mediator, mediaType: 'text/turtle' });
      busInit.subscribe(new ActorRdfParseN3({ name: 'actor-rdf-parse', bus }));
      input = stringToStream(`
      <a> <b> <c>.
      <d> <e> <f> <g>.
      `);
    });

    it('should test', () => {
      return expect(actor.test({ argv: [], env: {}, stdin: input })).resolves.toBe(null);
    });

    it('should run', () => {
      return expect(actor.run({ argv: [ 'https://www.google.com/' ], env: {}, stdin: input })).resolves
        .toHaveProperty('stdout');
    });
  });
});

function stringToStream(input: string) {
  const array: string[] = input.split('');
  const readable = new Readable();
  readable._read = () => {
    readable.push(array.shift());
    if (array.length === 0) {
      readable.push(null);
    }
    return;
  };
  return readable;
}