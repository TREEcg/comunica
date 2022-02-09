/* eslint-disable operator-linebreak */
/* eslint-disable id-length */
/* eslint-disable max-len */
import type {
  Quad,
  Term,
  BlankNode,
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

/**
 * Evaluate the path contained in the pathQuads over the graph constructed by the dataQuads.
 * @param dataQuads The quads containing the data over which the path is evaluated
 * @param pathQuads The quads containing the data path
 * @param graphEntry The identifier of the point in the data graph from where the path is evaluated
 * @param pathEntry The identifier in the path graph from where the path predicate should be discovered. A quad of the form - <pathEntry> tree:path <shape> - must be present in the pathQuads. Defaults to any triple containing the predicate tree:path.
 * @returns The resulting terms of evaluating the SHACL path over the data graph.
 */
export default function evaluatePath(dataQuads: Quad[], pathQuads: Quad[], graphEntry: string | Term, pathEntry?: string | Term | null): Term[] {
  const dataStore = new N3.Store(dataQuads);
  const pathStore = new N3.Store(pathQuads);

  // Create Term of graphEntry if present

  /* istanbul ignore next */
  if (!graphEntry) {
    throw new Error('Please provide a valid string or term as graphEntry parameter');
  }

  if (typeof graphEntry === 'string' || graphEntry instanceof String) {
    graphEntry = nn(<string>graphEntry);
  } else if (graphEntry.termType === 'BlankNode') {
    graphEntry = <BlankNode><unknown>graphEntry;
  } else if (graphEntry.termType === 'NamedNode') {
    graphEntry = nn(graphEntry.value);
  } else {
    throw new Error('Please provide a valid string or term as graphEntry parameter');
  }

  // Create Term of pathEntry if present
  if (pathEntry) {
    if (typeof pathEntry === 'string' || pathEntry instanceof String) {
      pathEntry = nn(<string>pathEntry);
    } else if (pathEntry.termType === 'BlankNode') {
      pathEntry = <BlankNode><unknown>pathEntry;
    } else if (pathEntry.termType === 'NamedNode') {
      pathEntry = nn(pathEntry.value);
    } else {
      throw new Error('Please provide a valid string or term as pathEntry parameter');
    }
  }

  let shapeIds;

  // Look for the start of the predicate paths in the triple store initialized with the pathQuads
  if (pathEntry) {
    shapeIds = pathStore.getQuads(pathEntry, sh.path, null, null).map(q => q.object);
    if (!shapeIds || shapeIds.length === 0) {
      shapeIds = pathStore.getQuads(pathEntry, tree.path, null, null).map(q => q.object);
    }
  } else {
    shapeIds = pathStore.getQuads(null, sh.path, null, null).map(q => q.object);
    if (!shapeIds || shapeIds.length === 0) {
      shapeIds = pathStore.getQuads(null, tree.path, null, null).map(q => q.object);
    }
  }

  if (!shapeIds || shapeIds.length === 0) {
    throw new Error('No data shape found.');
  }

  // If we only have a single quad in our pathQuads array, the resulting path MUST be a predicate path of the form <pathEntry> tree:path <predicatePath>.
  // if (pathQuads.length === 1) {
  //   // We only have a match for shacl:path or tree:path
  //   const predicatePathValue = pathQuads[0].object.value;
  //   const foundQuads = [];
  //   for (const quad of dataQuads) {
  //     if ((!graphEntry || graphEntry.value === quad.subject.value) && quad.predicate.value === predicatePathValue) {
  //       foundQuads.push(quad);
  //     }
  //   }
  //   return foundQuads.map(quad => quad.object);
  // }

  // In the case of more than a single quad in the pathQauds array, we keep a mapping of our location in the dataGraph and the pathGraph, and traverse both at the same time to find our resulting values.
  const mapping: IPathMapping = {
    currentShapeTerm: shapeIds[0],
    currentDataGraphTerms: [ graphEntry ],
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
 * @param dataStore Triple store containing the quads in the dataQuads parameter
 * @param pathStore Triple store containing the quads in the pathQuads parameter
 * @param mapping Mapping of the current location in out path graph to the locations that match in the data graph.
 * @param inverted Flag indicating we have to process the data graph inversely (from object to subject)
 * @param alternative Indicates if the current parsing is happening directly inside an alternative path, and must return every subsequent list entry.
 * @returns
 */
function processPath(
  dataStore: N3.Store,
  pathStore: N3.Store,
  mapping: IPathMapping, inverted: boolean, alternative = false,
): IResultPathMapping[] {
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
 * Process the current location in the path graph as a predicate path (end of a path).
 * From the current subject in the data graph, follow all predicates matching the path term stored in the mapping.
 * Returns the object (or subject in inverse flag is set) of the current data graph quads by following the predicate as predicate paths.
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @returns
 */
function processPredicatePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean): IPathMapping[] {
  const resultMapping: IPathMapping = {
    currentShapeTerm: mapping.currentShapeTerm,
    currentDataGraphTerms: [],
  };

  // Retrieve the quads in the data graph matching the current shape term.
  for (const dataTerm of mapping.currentDataGraphTerms) {
    const values = inverted
      ? dataStore.getQuads(null, mapping.currentShapeTerm, dataTerm, null).map(q => q.subject)
      : dataStore.getQuads(dataTerm, mapping.currentShapeTerm, null, null).map(q => q.object);
    resultMapping.currentDataGraphTerms = resultMapping.currentDataGraphTerms.concat(values);
  }
  return [ resultMapping ];
}

/**
 * Process remaining paths inversely (object to subject)
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @param quad
 * @returns
 */
function processInversePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad): IPathMapping[] {
  // Update the location in the shape graph
  mapping.currentShapeTerm = quad.object;
  // Continue but invert all encountered predicate paths
  return processPath(dataStore, pathStore, mapping, !inverted);
}

/**
 * Process alternative path by enabling flag to process nested sequence path as alternatives instead of a sequence.
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @param quad
 * @returns
 */
function processAlternativePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad): IPathMapping[] {
  // Update the mapping by following the sh:alternativePath quad
  const updatedMapping: IPathMapping = {
    currentShapeTerm: quad.object,
    currentDataGraphTerms: mapping.currentDataGraphTerms.slice(),
  };
  return processPath(dataStore, pathStore, updatedMapping, inverted, true);
}

/**
 * Process sequence path. If alternative flag is set, entries are processed as alternatives.
 * @param dataStore
 * @param pathStore
 * @param mapping
 * @param inverted
 * @param quad
 * @param alternative
 * @returns
 */
function processSequencePath(dataStore: N3.Store, pathStore: N3.Store, mapping: IPathMapping, inverted: boolean, quad: Quad, alternative: boolean): IPathMapping[] {
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
    // We keep the alternative flag for the tail as we are in the list of an alternativePath
    const processedPath = processPath(dataStore, pathStore, tailMapping, Boolean(inverted), alternative);
    return listHeadMappings.concat(processedPath);
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
