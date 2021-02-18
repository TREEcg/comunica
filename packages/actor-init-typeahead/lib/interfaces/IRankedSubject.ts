import type * as RDF from 'rdf-js';

export default interface IRankedSubject {
  score: number[];
  subject: string;
  matchingQuads: RDF.Quad[];
  quads: RDF.Quad[];
}
