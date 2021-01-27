import type * as RDF from 'rdf-js';

export default interface IRankedSubject {
  score: number[];
  subject: string;
  quads: RDF.Quad[];
}
