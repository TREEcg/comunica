import type { IActionRdfDereference } from '@comunica/bus-rdf-dereference';
import type { IActorRdfMetadataOutput } from '@comunica/bus-rdf-metadata';
import type { IActorRdfParseOutput } from '@comunica/bus-rdf-parse';
import type { IActionRdfScore, IExpectedValues, RDFScore } from '@treecg/bus-rdf-score';
import type { TreeValues } from '@treecg/bus-tree-score';
import { AsyncIterator } from 'asynciterator';
import type * as RDF from 'rdf-js';
import assignValueToLink from './functions/assignValueToLink';
import compareResults from './functions/compareResults';
import extractTreeNodes from './functions/extractTreeNodes';
import mergeScores from './functions/mergeScores';
import type IMediators from './interfaces/IMediators';
import type IRankedSubject from './interfaces/IRankedSubject';
import type IResult from './interfaces/IResult';
import type ITreeNode from './interfaces/ITreeNode';
import evaluatePath from './PathMatcher';
import TreeNodeQueue from './TreeNodeQueue';

const TREE = 'https://w3id.org/tree#';
const SHACL = 'http://www.w3.org/ns/shacl#';
const FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
const REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
const NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';

export interface IRelationPath {
  entrypoint: RDF.Quad_Subject; quads: RDF.Quad[];
}

export default class ResultsIterator extends AsyncIterator<IResult> {
  protected numResults: number;
  protected mediators: IMediators;
  protected inTransit: number;
  protected queue: TreeNodeQueue;
  protected expectedTreeValues: TreeValues;
  protected expectedDatatypeValues: IExpectedValues;
  protected expectedPredicateValues: IExpectedValues;
  protected latest: IResult;
  protected ready: boolean;

  // All the results that are ready to be read
  protected buffer: IResult[];
  protected knownTreeNodes: Record<string, ITreeNode>;
  // Avoid cyclic traversals
  protected visitedTreeNodes: Set<string>;

  private relationPath: IRelationPath;

  public constructor(
    numResults: number,
    nodes: ITreeNode[],
    mediators: IMediators,
    expectedTreeValues: TreeValues,
    expectedDatatypeValues: IExpectedValues,
    expectedPredicateValues: IExpectedValues,

  ) {
    super();

    this.numResults = numResults;
    this.mediators = mediators;
    this.expectedTreeValues = expectedTreeValues;
    this.expectedDatatypeValues = expectedDatatypeValues;
    this.expectedPredicateValues = expectedPredicateValues;
    this.inTransit = 0;
    this.queue = new TreeNodeQueue();

    this.visitedTreeNodes = new Set();
    this.buffer = [];
    this.latest = {
      subjects: new Set(),
      knownTreeNodes: nodes,
      rankedSubjects: [],
    };

    // Can't read while the queue is being populated
    this.readable = false;
    this.ready = false;

    // Not all URLs have to come from tree nodes
    // The constructor is just a special case
    const urls = [];

    const treeNodes: Record<string, ITreeNode> = {};
    this.knownTreeNodes = {};
    // Make the tree nodes indexable
    for (const node of nodes) {
      urls.push(node.url);
      treeNodes[node.url] = node;

      if (Object.keys(node.values).length > 0) {
        this.knownTreeNodes[node.url] = node;
      }
    }

    // After populating the queue, broadcast that we are ready to emit data
    this.populateQueue({}, urls, treeNodes)
      .then(() => {
        this.ready = true;
        this.readable = true;
      })
      .catch(error => {
        throw error;
      });
  }

  public async populateQueue(
    currentValue: TreeValues,
    urls: string[],
    treeNodes: Record<string, ITreeNode>,
  ): Promise<void> {
    for (const childNode of urls) {
      const values = assignValueToLink(childNode, currentValue, treeNodes);
      let { score: treeScore } = await this.mediators.mediatorTreeScore.mediate({
        values,
        expectedValues: this.expectedTreeValues,
      });

      if (!Array.isArray(treeScore)) {
        treeScore = [ treeScore ];
      }

      if (Object.keys(values).length > 0) {
        const sum = treeScore.reduce((acc, cur) => acc + cur, 0);
        if (sum > 0) {
          this.queue.push(treeScore, childNode, values);
        }
      } else {
        this.queue.push(treeScore, childNode, values);
      }
    }
  }

  public read(): IResult | null {
    if (this.closed) {
      return null;
    }

    if (!this.ready) {
      // The queue is still being initialized
      this.readable = false;
      return null;
    }

    if (this.buffer.length === 0) {
      // There are no results at the moment
      this.readable = false;
      this.scheduleRequests();
      return null;
    }

    // Always exists, we already checked the length
    const result: IResult = this.buffer.pop()!;

    return result;
  }

  protected scheduleRequests(): void {
    if (this.closed) {
      // The consumer can signal it no longer cares
      return;
    }

    if (this.queue.size() === 0) {
      // Nothing left to schedule

      if (this.inTransit === 0) {
        if (this.buffer.length === 0) {
          // Nothing left to read either
          this.close();
        } else {
          // Probably unnecessary, just making sure consumers know there's some final data
          this.readable = true;
        }
      }

      return;
    }

    const url = this.queue.pop();
    if (this.visitedTreeNodes.has(url)) {
      return;
    }
    this.visitedTreeNodes.add(url);
    this.inTransit += 1;
    this.processUrl(url)
      .then(result => {
        // Add next result to front of the queue
        this.buffer.unshift(result);
        this.readable = true;
        this.inTransit -= 1;

        // Immediately start processing the next item on the queue
        if (this.inTransit < 1) {
          this.scheduleRequests();
        }
      })
      .catch(error => {
        throw error;
      });
  }

  protected async processUrl(url: string): Promise<IResult> {
    const dereference: IActionRdfDereference = {
      url,
    };

    const rdfDereferenceOutput: IActorRdfParseOutput = await this.mediators.mediatorRdfDereference.mediate(dereference);
    // Determine the metadata
    const rdfMetadataOuput: IActorRdfMetadataOutput = await this.mediators.mediatorMetadata.mediate(
      { url, quads: rdfDereferenceOutput.quads, triples: rdfDereferenceOutput.triples },
    );
    if (this.closed) {
      // The next step can be expensive, see if we can abort
      return this.latest;
    }

    const { metadata } = await this.mediators.mediatorMetadataExtract
      .mediate({ url, metadata: rdfMetadataOuput.metadata });
    const treeNodes = extractTreeNodes(metadata);
    const { urls } = await this.mediators.mediatorHypermediaLinks.mediate({ metadata });
    // TODO, propagate tree values
    await this.populateQueue({}, <string[]>urls, treeNodes);
    // Keep track of all known tree nodes for future queries
    this.knownTreeNodes = { ...this.knownTreeNodes, ...treeNodes };

    return this.processPageData(
      rdfMetadataOuput.data,
    );
  }

  protected processPageData(
    quadStream: RDF.Stream,
  ): Promise<IResult> {
    let rankedSubjects: IRankedSubject[] = [];

    const store: Record<string, RDF.Quad[]> = {};
    const pathEntryPointQuads: RDF.Quad[] = [];
    const pathQuads: RDF.Quad[] = [];
    quadStream
      .on('data', (quad: RDF.Quad) => {
        if (quad.predicate.value === `${TREE}path`) {
          // Extract quads with predicate tree:path as path quads
          pathEntryPointQuads.push(quad);
        } else if (!this.relationPath && (quad.predicate.value.startsWith(SHACL) ||
        quad.predicate.value === FIRST || quad.predicate.value === REST || quad.predicate.value === NIL)) {
          // Extract quads with the shacl path predicates orrdf:first, rdf:last and rdf:nil as path quads
          pathQuads.push(quad);
        } else if (quad.subject.termType === 'NamedNode') {
          // Extract other quads as data quads
          const subject = quad.subject.value;
          if (!(subject in store)) {
            store[subject] = [];
          }
          store[subject].push(quad);
        }
      });

    // Note: this may not be the best place to extract the data like this,
    // as it already happens in the metadata extraction lib.
    // Maybe the metadata extraction should return the metadata in quads format as well?
    const result: Promise<IResult> = new Promise(resolve => {
      quadStream.on('end', async() => {
        if (!this.relationPath) {
          const relationsPaths = pathEntryPointQuads.map(quad =>
            ({ entrypoint: quad.subject, quads: getPathQuads(quad, pathQuads) }));
          if (relationsPaths.length > 0) {
            this.relationPath = relationsPaths[0];
          }
        }

        for (const [ subject, quads ] of Object.entries(store)) {
          if (this.latest.subjects.has(subject)) {
            // No need to reevaluate this one
            continue;
          }
          this.latest.subjects.add(subject);

          // **************************** Path Matching ******************************
          // Check if relation path is present, and score based on value matching path
          // *************************************************************************
          if (this.relationPath) {
            rankedSubjects = rankedSubjects.concat(
              await this.processRelationPath(subject, quads, this.relationPath.quads, this.relationPath.entrypoint),
            );
          }

          // ***************** Expected Predicate Value Matching *******************
          // Check if quad predicate is contained in expected predicate values array
          // ***********************************************************************

          // We only check this if no matching has been done based on the discovered path
          if (rankedSubjects.length === 0) {
            rankedSubjects = rankedSubjects.concat(
              await this.processExpectedValues(subject, quads),
            );
          }
        }

        rankedSubjects = [ ...rankedSubjects, ...this.latest.rankedSubjects ];
        rankedSubjects.sort(compareResults);
        this.latest = {
          subjects: this.latest.subjects,
          knownTreeNodes: Object.values(this.knownTreeNodes),
          rankedSubjects: rankedSubjects.slice(0, this.numResults),
        };
        resolve(this.latest);
      });
    });

    return result;
  }

  /**
   * Score quads based on the discovered relation path in the page
   */
  private async processRelationPath(
    subject: string,
    quads: RDF.Quad[],
    relationPathQuads: RDF.Quad[],
    pathEntryPoint: RDF.Quad_Subject,
  ): Promise<IRankedSubject[]> {
    let resultingLiterals: RDF.Term[] = [];
    // Discover literals matching the relation path
    try {
      resultingLiterals = resultingLiterals.concat(
        evaluatePath(quads, relationPathQuads, subject, pathEntryPoint),
      );
    } catch {
      // Unsure how to catch this
    }

    let quadsToBeScored: RDF.Quad[] = [];
    // Discover the original quad the resulting literal came from.
    // This is not ideal, but the rest of the code requires a quad instead of a term.
    // This is a bit dirty and should be reworked!
    for (const literal of resultingLiterals) {
      // Reverse case in case of inversePathquadsContainingLiteral
      quadsToBeScored = quadsToBeScored.concat(
        quads.filter(quad => quad.object.value === literal.value || quad.subject.value === literal.value),
      );
    }

    // We do not pass expected predicate values, because these are used in the scoring algorithm.
    return this.calculateSubjectScore(subject, quadsToBeScored, this.expectedDatatypeValues);
  }

  /**
   * Score quads based on the passed expected values
   */
  private async processExpectedValues(
    subject: string,
    quads: RDF.Quad[],
  ): Promise<IRankedSubject[]> {
    const scorableQuads: RDF.Quad[] = [];
    const expectedDatatypeValues = this.expectedDatatypeValues;
    const expectedPredicateValues = this.expectedPredicateValues;

    for (const quad of quads) {
    // The * predicate matches all predicates
      const rightPredicate = quad.predicate.value in expectedPredicateValues;
      const rightDatatype = quad.object.termType === 'Literal' &&
      (quad.object.datatype.value in expectedDatatypeValues);
      if (rightPredicate && rightDatatype) {
        // We want to try to score this quad
        scorableQuads.push(quad);
      }
    }
    return this.calculateSubjectScore(subject, quads, this.expectedDatatypeValues, this.expectedPredicateValues);
  }

  private async calculateSubjectScore(
    subject: string,
    quads: RDF.Quad[],
    expectedDatatypeValues?: IExpectedValues,
    expectedPredicateValues?: IExpectedValues,
  ): Promise<IRankedSubject[]> {
    const scoredQuads: RDF.Quad[] = [];
    let score: RDFScore[] = [];
    const rankedSubjects: IRankedSubject[] = [];

    for (const quad of quads) {
      const action: IActionRdfScore<any> = {
        quad,
        expectedDatatypeValues,
        expectedPredicateValues,
      };

      try {
        const literalValue = await this.mediators.mediatorLiteralNormalize.mediate({ data: quad });
        action.literalValue = literalValue.result;
      } catch {
        // Is ok - is it?
      }

      // Calculate score for the action - aka calculate score for the quad
      let { score: quadScore } = await this.mediators.mediatorRdfScore.mediate(action);
      if (!Array.isArray(quadScore)) {
        // Most useful mediators will return an array, but no guarantees
        quadScore = [ quadScore ];
      }

      if (!quadScore.includes(Number.NEGATIVE_INFINITY)) {
        if (quadScore.every(element => element === null)) {
          // None of the sorting actors had anything to say
          continue;
        }
        scoredQuads.push(quad);

        // -Inf indicates the score is too bad to be used
        if (score.length === 0) {
          // First valid score for this subject
          score = quadScore;
        } else {
          score = mergeScores(score, quadScore);
        }
      }
    }

    if (
      score.length > 0 &&
    !score.includes(null) &&
    !score.includes(Number.NEGATIVE_INFINITY)
    ) {
      const cast: number[] = <number[]>score;
      rankedSubjects.push({
        score: cast,
        subject,
        matchingQuads: scoredQuads,
        quads,
      });
    }
    return rankedSubjects;
  }
}

function getPathQuads(startQuad: RDF.Quad, pathQuads: RDF.Quad[]): RDF.Quad[] {
  let relationPathQuads = [ startQuad ];
  const outQuads = pathQuads.filter(quad => quad.subject.value === startQuad.object.value);
  for (const outQuad of outQuads) {
    relationPathQuads = relationPathQuads.concat(getPathQuads(outQuad, pathQuads));
  }
  return relationPathQuads;
}
