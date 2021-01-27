import type { IActionRdfDereference } from '@comunica/bus-rdf-dereference';
import type { IActorRdfMetadataOutput } from '@comunica/bus-rdf-metadata';
import type { IActorRdfParseOutput } from '@comunica/bus-rdf-parse';
import type { IActionRdfScore, IExpectedValues, RDFScore } from '@hdelva/bus-rdf-score';
import type { TreeValues } from '@hdelva/bus-tree-score';
import { AsyncIterator } from 'asynciterator';
import * as N3 from 'n3';
import type * as RDF from 'rdf-js';
import assignValueToLink from './functions/assignValueToLink';
import compareResults from './functions/compareResults';
import compareTreeNodes from './functions/compareTreeNodes';
import extractTreeNodes from './functions/extractTreeNodes';
import mergeScores from './functions/mergeScores';
import type IMediators from './interfaces/IMediators';
import type IRankedSubject from './interfaces/IRankedSubject';
import type IRankedTreeNode from './interfaces/IRankedTreeNode';
import type IResult from './interfaces/IResult';
import type ITreeNode from './interfaces/ITreeNode';
const TinyQueue = require('tinyqueue');

export default class ResultsIterator extends AsyncIterator<IResult> {
  protected mediators: IMediators;
  protected inTransit: number;
  protected maxRequests: number;
  protected queue: typeof TinyQueue;
  protected expectedTreeValues: TreeValues;
  protected expectedDatatypeValues: IExpectedValues;
  protected expectedPredicateValues: IExpectedValues;
  protected latest: IResult;
  protected ready: boolean;

  // All the results that are ready to be read
  protected buffer: IResult[];

  public constructor(
    nodes: ITreeNode[],
    mediators: IMediators,
    expectedTreeValues: TreeValues,
    expectedDatatypeValues: IExpectedValues,
    expectedPredicateValues: IExpectedValues,
    maxRequests = 8,
  ) {
    super();

    this.mediators = mediators;
    this.expectedTreeValues = expectedTreeValues;
    this.expectedDatatypeValues = expectedDatatypeValues;
    this.expectedPredicateValues = expectedPredicateValues;
    this.inTransit = 0;
    this.maxRequests = maxRequests;
    this.queue = new TinyQueue([], compareTreeNodes);

    this.buffer = [];
    this.latest = {
      subjects: new Set(),
      rankedSubjects: [],
    };

    // Can't read while the queue is being populated
    this.readable = false;
    this.ready = false;

    // Not all URLs have to come from tree nodes
    // The constructor is just a special case
    const urls = [];

    // Make the tree nodes indexable
    const treeNodes: Record<string, ITreeNode> = {};
    for (const node of nodes) {
      urls.push(node.url);
      treeNodes[node.url] = node;
    }

    // After populating the queue, broadcast that we are ready to emit data
    this.populateQueue({}, urls, treeNodes, false)
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
    prune = true,
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

      if (prune) {
        const sum = treeScore.reduce((acc, cur) => acc + cur, 0);
        if (sum > 0) {
          this.queue.push({
            treeScore,
            url: childNode,
            values,
          });
        }
      } else {
        this.queue.push({
          treeScore,
          url: childNode,
          values,
        });
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
    const result: IResult = <IResult> this.buffer.pop();

    return result;
  }

  protected scheduleRequests(): void {
    if (this.queue.length === 0 && this.inTransit === 0) {
      // Nothing left to schedule
      this.close();
    }

    while (this.queue.length > 0 && this.inTransit < this.maxRequests) {
      const { url } = <IRankedTreeNode> this.queue.pop();
      this.inTransit += 1;
      this.processUrl(url)
        .then(result => {
          // Add next result to front of the queue
          this.buffer.unshift(result);
          this.readable = true;
          this.inTransit -= 1;

          // Immediately start processing the next item on the queue
          this.scheduleRequests();
        })
        .catch(error => {
          throw error;
        });
    }
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
    const { metadata } = await this.mediators.mediatorMetadataExtract
      .mediate({ url, metadata: rdfMetadataOuput.metadata });

    const treeNodes = extractTreeNodes(metadata);
    const { urls } = await this.mediators.mediatorHypermediaLinks.mediate({ metadata });
    // TODO, propagate tree values
    await this.populateQueue({}, <string[]>urls, treeNodes);

    const result = await this.processPageData(
      rdfMetadataOuput.data,
      this.latest,
      this.expectedDatatypeValues,
      this.expectedPredicateValues,
    );
    this.latest = result;
    return result;
  }

  protected processPageData(
    quadStream: RDF.Stream,
    previousResults: IResult,
    expectedDatatypeValues: IExpectedValues,
    expectedPredicateValues: IExpectedValues,
  ): Promise<IResult> {
    const rankedSubjects: IRankedSubject[] = [ ...previousResults.rankedSubjects ];
    const subjects = previousResults.subjects;

    const store = new N3.Store();
    store.import(quadStream);

    const result: Promise<IResult> = new Promise(resolve => {
      quadStream.on('end', async() => {
        for (const subject of store.getSubjects(null, null, null)) {
          if (subjects.has(subject.value)) {
            // No need to reevaluate this one
            continue;
          }
          subjects.add(subject.value);

          let score: RDFScore[] = [];
          const quads = store.getQuads(subject, null, null, null);
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
              // Is ok
            }

            let { score: quadScore } = await this.mediators.mediatorRdfScore.mediate(action);
            if (!Array.isArray(quadScore)) {
              // Most useful mediators will return an array, but no guarantees
              quadScore = [ quadScore ];
            }

            if (!quadScore.includes(Number.NEGATIVE_INFINITY)) {
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
              subject: subject.value,
              quads,
            });
          }
        }

        rankedSubjects.sort(compareResults);
        resolve({
          subjects,
          rankedSubjects: rankedSubjects.slice(0, 10),
        });
      });
    });

    return result;
  }
}
