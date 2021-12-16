/* eslint-disable operator-linebreak */
/* eslint-disable id-length */
/* eslint-disable max-len */
import type {
  Quad,
  Term,
} from '@rdfjs/types';
import * as N3 from 'n3';

// Namespaces
const tree = {
  path: 'https://w3id.org/tree#path',
};

const sh = {
  path: 'http://www.w3.org/ns/shacl#path',
  inversePath: 'http://www.w3.org/ns/shacl#inversePath',
  alternativePath: 'http://www.w3.org/ns/shacl#alternativePath',
  zeroOrMorePath: 'http://www.w3.org/ns/shacl#zeroOrMorePath',
  oneOrMorePath: 'http://www.w3.org/ns/shacl#oneOrMorePath',
  zeroOrOnePath: 'http://www.w3.org/ns/shacl#zeroOrOnePath',
};
const rdf = {
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil',
};

// Interfaces

interface IPathMapping {
  currentShapeTerm: Term;
  currentDataGraphTerms: Term[];
}

interface IResultPathMapping {
  currentShapeTerm: Term;
  currentDataGraphTerms: Term[];
  sequence?: IPathMapping[];
}

// Helper functions
const nn = (term: string): N3.NamedNode => new N3.NamedNode(term);
const bn = (term: string): N3.BlankNode => new N3.BlankNode(term);

// Functionality

/**
 *
 * @param dataQuads The quads containing the data over which the path is evaluated
 * @param pathQuads The quads containing the data path
 * @param objectEntry The identifier of the point in the data graph from where the path is evaluated
 * @param pathEntry The identifier in the path graph from where the path predicate should be discovered
 * @returns The resulting terms of evaluating the SHACL path over the data graph.
 */
export default function evaluatePath(dataQuads: Quad[], pathQuads: Quad[], objectEntry: string | Term, pathEntry: string | Term | null): Term[] {
  const dataStore = new N3.Store(dataQuads);
  const pathStore = new N3.Store(pathQuads);

  if (!objectEntry) {
    throw new Error('Please provide a valid string or term as objectEntry parameter');
  }
  if (typeof objectEntry === 'string' || objectEntry instanceof String) {
    objectEntry = nn(<string>objectEntry);
  } else if (objectEntry.termType === 'BlankNode') {
    objectEntry = bn(objectEntry.value);
  } else if (objectEntry.termType === 'NamedNode') {
    objectEntry = nn(objectEntry.value);
  } else {
    throw new Error('Please provide a valid string or term as objectEntry parameter');
  }

  if (pathEntry) {
    if (typeof pathEntry === 'string' || pathEntry instanceof String) {
      pathEntry = nn(<string>pathEntry);
    } else if (pathEntry.termType === 'BlankNode') {
      pathEntry = bn(pathEntry.value);
    } else if (pathEntry.termType === 'NamedNode') {
      pathEntry = nn(pathEntry.value);
    } else {
      throw new Error('Please provide a valid string or term as pathEntry parameter');
    }
  }

  let shapeIds;

  if (pathEntry) {
    shapeIds = pathStore.getQuads(pathEntry, tree.path, null, null).map(q => q.object);
  } else {
    shapeIds = pathStore.getQuads(null, tree.path, null, null).map(q => q.object);
  }

  if (!shapeIds) {
    throw new Error('No shacl shape found.');
  }

  if (pathQuads.length === 1) {
    // We only have a match for shacl:path or tree:path
    const predicatePathValue = pathQuads[0].object.value;
    const foundQuads = [];
    for (const quad of dataQuads) {
      if (quad.predicate.value === predicatePathValue) {
        foundQuads.push(quad);
      }
    }
    return foundQuads.map(quad => quad.object);
  }

  const mapping: IPathMapping = {
    currentShapeTerm: shapeIds[0],
    currentDataGraphTerms: [ objectEntry ],
  };
  const mappings = processPath(dataStore, pathStore, mapping, false);

  const resultingDataTerms = [];
  for (const pathMapping of mappings) {
    for (const term of pathMapping.currentDataGraphTerms) {
      resultingDataTerms.push(term);
    }
  }

  return resultingDataTerms;
}

/**
 *
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @param alterantive Indicates if the current parsing is happening directly inside an alternative path, and must return every subsequent list entry.
 * @returns
 */
function processPath(
  dataStore: N3.Store,
  pathStore: N3.Store,
  mapping: IPathMapping, inverted: boolean, alternative = false,
): IResultPathMapping[] {
  // Console.log("processing: path", mapping, inverted)
  const availableShapePathsQuads = pathStore.getQuads(mapping.currentShapeTerm, null, null, null);

  if (!availableShapePathsQuads || availableShapePathsQuads.length === 0) {
    // The current term is a property path
    return processPredicatePath(dataStore, pathStore, mapping, inverted);
  }

  let resultMappings: IPathMapping[] = [];

  for (const quad of availableShapePathsQuads) {
    if (quad.predicate.value === sh.inversePath) {
      resultMappings = resultMappings.concat(
        processInversePath(
          dataStore, pathStore, mapping, inverted, quad,
        ),
      );
    } else if (quad.predicate.value === sh.alternativePath) {
      // Calculate the alternative paths separately
      resultMappings = resultMappings.concat(
        processAlternativePath(
          dataStore, pathStore, mapping, inverted, quad,
        ),
      );
    } else if (quad.predicate.value === rdf.first) {
      resultMappings = resultMappings.concat(
        processSequencePath(
          dataStore, pathStore, mapping, inverted, quad, alternative,
        ),
      );
    }
  }
  return resultMappings;
}

/**
 * Process the current predicate path
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @returns
 */
function processPredicatePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean): IPathMapping[] {
  // Console.log("processing: predicatePath", mapping.currentShapeTerm.value, mapping.currentDataGraphTerms, inverted)
  const resultMapping: IPathMapping = {
    currentShapeTerm: mapping.currentShapeTerm,
    currentDataGraphTerms: [],
  };

  for (const dataTerm of mapping.currentDataGraphTerms) {
    const values = inverted
      ? dataStore.getQuads(null, mapping.currentShapeTerm, dataTerm, null).map(q => q.subject)
      : dataStore.getQuads(dataTerm, mapping.currentShapeTerm, null, null).map(q => q.object);
    resultMapping.currentDataGraphTerms = resultMapping.currentDataGraphTerms.concat(values);
  }
  return [ resultMapping ];
}

function processInversePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad): IPathMapping[] {
  // Console.log("processing: inversePath", mapping, inverted)
  // Update the location in the shape graph
  mapping.currentShapeTerm = quad.object;
  // Continue but invert all encountered predicate paths
  return processPath(dataStore, pathStore, mapping, !inverted);
}

function processAlternativePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad): IPathMapping[] {
  // Console.log("processing: alternativePath", mapping, inverted)
  const updatedMapping: IPathMapping = {
    currentShapeTerm: quad.object,
    currentDataGraphTerms: mapping.currentDataGraphTerms.slice(),
  };
  return processPath(dataStore, pathStore, updatedMapping, inverted, true);
}

function processSequencePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad, alternative: boolean): IPathMapping[] {
  // Console.log("processing: sequencePath", mapping, inverted, alternative)
  const updatedMapping: IPathMapping = {
    currentShapeTerm: quad.object,
    currentDataGraphTerms: mapping.currentDataGraphTerms.slice(),
  };

  // Alternative paths can never propagate through heads of the list, only through the tails. This way we never have issues with nested lists
  const listHeadMappings = processPath(dataStore, pathStore, updatedMapping, Boolean(inverted), false);

  // Find the tail value
  const restQuads = pathStore.getQuads(mapping.currentShapeTerm, rdf.rest, null, null);
  const restQuad = restQuads && restQuads.length > 0 ? restQuads[0] : null;

  if (!restQuad) {
    // If no tail, we return the results of the head (rdf:first)
    return listHeadMappings;
  }
  if (restQuad.object.id === rdf.nil) {
    // The tail of the sequence is nil, so we return the results of the head (rdf:first)
    return listHeadMappings;
  }
  // Pass the results of the head to the tail, and return the results of the tail (rdf:rest)
  if (alternative) {
    // As we are in the sequence of a sh:alternativePath, we need to return both the head and tail results as separate results of the path
    const tailMapping: IPathMapping = {
      currentShapeTerm: restQuad.object,
      currentDataGraphTerms: mapping.currentDataGraphTerms.slice(),
    };
    const resultingMappings = processPath(dataStore, pathStore, tailMapping, Boolean(inverted), alternative); // We keep the alternative flag for the tail as we are in the list of an alternativePath
    return listHeadMappings.concat(resultingMappings);
  }
  // As we are in a normal sequence path, we need to return the result at the tail of the sequence
  let resultingMappings: IPathMapping[] = [];
  for (const map of listHeadMappings) {
    const tailMapping: IPathMapping = {
      currentShapeTerm: restQuad.object,
      currentDataGraphTerms: map.currentDataGraphTerms.slice(),
    };
    resultingMappings = resultingMappings.concat(
      processPath(dataStore, pathStore, tailMapping, Boolean(inverted)),
    );
  }
  return resultingMappings;
}
