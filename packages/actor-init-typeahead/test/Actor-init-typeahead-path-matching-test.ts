import type { Quad } from '@rdfjs/types';
import * as N3 from 'n3';
import type { Term } from 'rdf-js';
import rdfParser from 'rdf-parse';
import evaluatePath from '../lib/PathMatcher';
const toStream = require('streamify-string');

const nn = (term: string) => {
  return new N3.NamedNode(term);
};

const bn = (term: string) => {
  return new N3.BlankNode(term);
};

const compareResults = (result: any[], expectedResults: any[]) => {
  expect(result.map(e => e.value.toString()).sort((a, b) => a.localeCompare(b)))
    .toEqual(expectedResults.map(e => e.toString()).sort((a, b) => a.localeCompare(b)));
};

const parseTurtle = async(turtleString: string): Promise<Quad[]> => {
  return await new Promise((resolve, reject) => {
    const quads: Quad[] = [];
    rdfParser.parse(toStream(turtleString), { contentType: 'text/turtle', baseIRI: 'http://ex.org' })
      .on('data', quad => quads.push(quad))
      .on('error', error => reject(error))
      .on('end', () => resolve(quads));
  });
};

async function testPath(pathString: string, expectedResults: string[],
  graphEntry?: string | Term, pathEntry?: string | Term | null) {
  graphEntry = graphEntry || nn('http://ex.org/5');
  pathEntry = pathEntry || null;

  const dataString = `
    @prefix ex: <http://ex.org/> .

    ex:0 ex:value "0" .
    ex:1 ex:value "1" .
    ex:2 ex:value "2" .
    ex:3 ex:value "3" .
    ex:4 ex:value "4" .
    ex:5 ex:value "5" .
    ex:6 ex:value "6" .
    ex:7 ex:value "7" .
    ex:8 ex:value "8" .
    ex:9 ex:value "9" .

    ex:0 ex:plus ex:1 .
    ex:1 ex:plus ex:2 .
    ex:2 ex:plus ex:3 .
    ex:3 ex:plus ex:4 .
    ex:4 ex:plus ex:5 .
    ex:5 ex:plus ex:6 .
    ex:6 ex:plus ex:7 .
    ex:7 ex:plus ex:8 .
    ex:8 ex:plus ex:9 .
    
    ex:1 ex:min ex:0 .
    ex:2 ex:min ex:1 .
    ex:3 ex:min ex:2 .
    ex:4 ex:min ex:3 .
    ex:5 ex:min ex:4 .
    ex:6 ex:min ex:5 .
    ex:7 ex:min ex:6 .
    ex:8 ex:min ex:7 .
    ex:9 ex:min ex:8 .
  `;

  const dataQuads = await parseTurtle(dataString);
  const pathQuads = await parseTurtle(pathString);

  const result = evaluatePath(dataQuads, pathQuads, graphEntry, pathEntry);

  // Run assertion. Evaluate based on sorted string representations
  compareResults(result, expectedResults);
}

describe('ActorInitTypeahead Path Matching', () => {
  // BeforeEach(() => {});

  describe('Path Matching Module', () => {
    it('should be a function', () => {
      expect(evaluatePath).toBeInstanceOf(Function);
    });

    const data = `
    @prefix ex: <http://ex.org/> .
    ex:member0 ex:value "0" .
    ex:member1 ex:value "1" .
    _:memberBlank ex:value "blank" .
    `;

    const shape = `
    @prefix tree: <https://w3id.org/tree#> . 
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://ex.org/> .

    ex:relationTree tree:path ex:value .
    ex:relationShacl sh:path ex:value .
    _:relationBlank tree:path ex:value .
    `;

    it('should evaluate paths for a NamedNode string type graphEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const result = evaluatePath(dataQuads, pathQuads, 'http://ex.org/member0');
      const expectedResult = [ '0' ];
      compareResults(result, expectedResult);
    });

    it('should evaluate paths for a NamedNode Term type graphEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const result = evaluatePath(dataQuads, pathQuads, nn('http://ex.org/member0'));
      const expectedResult = [ '0' ];
      compareResults(result, expectedResult);
    });

    it('should evaluate paths for a BlankNode Term type graphEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const blankNodeQuads = dataQuads.filter(n => n.subject.value.includes('memberBlank'));
      const blankPathQuad = pathQuads.filter(n => n.subject.value.includes('relationBlank'));
      expect(blankNodeQuads.length).toEqual(1);
      expect(blankPathQuad.length).toEqual(1);
      const result = evaluatePath(dataQuads, pathQuads, blankNodeQuads[0].subject);
      const expectedResult = [ 'blank' ];
      compareResults(result, expectedResult);
    });

    it('should throw for random graphEntry parameters', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect(() => { evaluatePath(dataQuads, pathQuads, 100 as any); }).toThrow(Error);
    });

    it('should evaluate paths for a NamedNode string type pathEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const result = evaluatePath(dataQuads, pathQuads, 'http://ex.org/member1', 'http://ex.org/relationTree');
      const expectedResult = [ '1' ];
      compareResults(result, expectedResult);
    });

    it('should evaluate paths for a NamedNode Term type pathEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const result = evaluatePath(dataQuads, pathQuads, nn('http://ex.org/member1'), nn('http://ex.org/relationTree'));
      const expectedResult = [ '1' ];
      compareResults(result, expectedResult);
    });

    it('should evaluate paths for a BlankNode Term type pathEntry parameter', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const blankNodeQuads = dataQuads.filter(n => n.subject.value.includes('memberBlank'));
      const blankPathQuads = pathQuads.filter(n => n.subject.value.includes('relationBlank'));
      expect(blankNodeQuads.length).toEqual(1);
      expect(blankPathQuads.length).toEqual(1);
      const result = evaluatePath(dataQuads, pathQuads, blankNodeQuads[0].subject, blankPathQuads[0].subject);
      const expectedResult = [ 'blank' ];
      compareResults(result, expectedResult);
    });

    it('should throw for random pathEntry parameters', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect(() => { evaluatePath(dataQuads, pathQuads, 'http://ex.org/member1', 100 as any); }).toThrow(Error);
    });

    it('should evaluate paths for a shacl:path shape', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(shape);
      const result = evaluatePath(dataQuads, pathQuads, nn('http://ex.org/member1'), nn('http://ex.org/relationShacl'));
      const expectedResult = [ '1' ];
      compareResults(result, expectedResult);
    });

    const unusableShape = `
    @prefix tree: <https://w3id.org/tree#> . 
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://ex.org/> .

    ex:incorrect sh:inversePath ex:value.
    `;

    it('should fail on incorrect shapes', async() => {
      const dataQuads = await parseTurtle(data);
      const pathQuads = await parseTurtle(unusableShape);
      expect(() => { evaluatePath(dataQuads, pathQuads, 'http://ex.org/member1'); }).toThrow(Error);
    });
  });

  describe('Predicate Path evaluation', () => {
    it('should evaluate the predicate path to a value', async() => {
      const predicatePath = `
        @prefix tree: <https://w3id.org/tree#> . 
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://ex.org/> .
    
        _:relation tree:path ex:value .
      `;
      await testPath(predicatePath, [ '5' ]);
    });
  });

  describe('Sequence Path evaluation', () => {
    it('should evaluate the sequence path to a value', async() => {
      const sequencePath = `
        @prefix tree: <https://w3id.org/tree#> .
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://ex.org/> .

        _:relation sh:path ( ex:plus ex:plus ex:value ) .
      `;
      await testPath(sequencePath, [ '7' ]);
    });

    it('should work on non-correctly terminated sequences', async() => {
      const dataString = `
      @prefix ex: <http://ex.org/> .
      ex:0 ex:plus ex:1 .
      ex:1 ex:plus ex:2 .
      ex:2 ex:value "2" .
      `;
      const sequencePath = `
        @prefix tree: <https://w3id.org/tree#> .
        @prefix ex: <http://ex.org/> .
        ex:relation tree:path ( ex:plus ex:plus ex:value ) .
      `;
      const dataQuads = await parseTurtle(dataString);
      const pathQuads = await parseTurtle(sequencePath);
      const pathQuadsWithoutNil = pathQuads.filter(q =>
        q.object.value !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil');

      const result = evaluatePath(dataQuads, pathQuadsWithoutNil, 'http://ex.org/0');
      const expectedResults = [ '2' ];
      compareResults(result, expectedResults);
    });
  });

  describe('Alternative Path evaluation', () => {
    it('should evaluate the alternative path to a value', async() => {
      const alternativePath = `
      @prefix tree: <https://w3id.org/tree#> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://ex.org/> .

      _:relation sh:path ( [ sh:alternativePath (ex:plus ex:min) ] ex:value ) .
      `;
      await testPath(alternativePath, [ '4', '6' ]);
    });
  });

  describe('Inverse Path evaluation', () => {
    it('should evaluate the inverse path to a value', async() => {
      const alternativePath = `
      @prefix tree: <https://w3id.org/tree#> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://ex.org/> .

      _:relation sh:path ( [ sh:inversePath (ex:plus ex:plus) ] ex:value ) .
      `;
      await testPath(alternativePath, [ '3' ]);
    }); });
});
