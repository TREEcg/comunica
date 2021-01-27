import { Readable } from 'stream';
import type { IActionInit, IActorOutputInit } from '@comunica/bus-init';
import { ActorInit } from '@comunica/bus-init';
import type { IActionRdfDereference, IActorRdfDereferenceOutput } from '@comunica/bus-rdf-dereference';
import type { ActorRdfMetadata, IActionRdfMetadata, IActorRdfMetadataOutput } from '@comunica/bus-rdf-metadata';
import type {
  ActorRdfMetadataExtract,
  IActionRdfMetadataExtract,
  IActorRdfMetadataExtractOutput,
} from '@comunica/bus-rdf-metadata-extract';
import type { IActorRdfParseOutput } from '@comunica/bus-rdf-parse';
import type {
  ActorRdfResolveHypermediaLinks,
  IActionRdfResolveHypermediaLinks,
  IActorRdfResolveHypermediaLinksOutput,
  ILink,
} from '@comunica/bus-rdf-resolve-hypermedia-links';
import type { ActionContext, Actor, IActorArgs, IActorTest, Mediator } from '@comunica/core';
import type {
  ActorLiteralNormalize,
  IActionLiteralNormalize,
  IActorLiteralNormalizeOutput,
  IActorLiteralNormalizeTest,
} from '@hdelva/bus-literal-normalize';
import type {
  IActionRdfScore,
  IActorRdfScoreTest,
  IActorRdfScoreOutputSingle,
  IActorRdfScoreOutput,
  IExpectedValues,
  RDFScore,
} from '@hdelva/bus-rdf-score';
import type {
  ActorTreeScore,
  IActionTreeScore,
  IActorTreeScoreOutput,
  IActorTreeScoreTest,
  TreeValues,
} from '@hdelva/bus-tree-score';
import * as N3 from 'n3';
import { DataFactory } from 'rdf-data-factory';
import type * as RDF from 'rdf-js';

const TinyQueue = require('tinyqueue');

type DereferenceActor = Actor<IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>;
type ScoreActor<T> = Actor<IActionRdfScore<T>, IActorRdfScoreTest, IActorRdfScoreOutputSingle>;

interface ITreeNode {
  url: string;
  values: TreeValues;
}

const DF: RDF.DataFactory = new DataFactory();

export class ActorInitTypeahead extends ActorInit implements IActorInitTypeaheadArgs {
  public readonly mediatorRdfDereference: Mediator<DereferenceActor, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  public readonly mediatorRdfScore: Mediator<ScoreActor<any>, IActionRdfScore<any>,
  IActorRdfScoreTest, IActorRdfScoreOutput>;

  public readonly mediatorLiteralNormalize: Mediator<ActorLiteralNormalize<any>, IActionLiteralNormalize<any>,
  IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<any>>;

  public readonly mediatorMetadata: Mediator<ActorRdfMetadata, IActionRdfMetadata,
  IActorTest, IActorRdfMetadataOutput>;

  public readonly mediatorMetadataExtract: Mediator<ActorRdfMetadataExtract, IActionRdfMetadataExtract,
  IActorTest, IActorRdfMetadataExtractOutput>;

  public readonly mediatorHypermediaLinks: Mediator<ActorRdfResolveHypermediaLinks, IActionRdfResolveHypermediaLinks,
  IActorTest, IActorRdfResolveHypermediaLinksOutput>;

  public readonly mediatorTreeScore: Mediator<ActorTreeScore, IActionTreeScore,
  IActorTreeScoreTest, IActorTreeScoreOutput>;

  public constructor(args: IActorInitTypeaheadArgs) {
    super(args);
  }

  public async test(action: IActionInit): Promise<IActorTest> {
    return true;
  }

  public async run(action: IActionInit): Promise<IActorOutputInit> {
    const [ url, ...rawValues ] = action.argv;

    const readable = new Readable();
    readable._read = () => {
      // Do nothing
    };

    const start = new Date();

    let expectedValues: string[] = [];
    for (const rawValue of rawValues) {
      try {
        const result = await this.mediatorLiteralNormalize.mediate({ data: rawValue });
        expectedValues = [ ...expectedValues, ...result.result ];
      } catch {
        expectedValues.push(rawValue);
      }
    }

    const expectedDatatypeValues = {
      'http://www.w3.org/2001/XMLSchema#string': expectedValues,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString': expectedValues,
    };

    const query = {
      urls: [ url ],
      expectedDatatypeValues,
      expectedPredicateValues: {},
      context: action.context,
    };

    for await (const rankedResults of this.query(query)) {
      const elapsed = new Date().getTime() - start.getTime();
      readable.push(`Partial Result; Finished in ${elapsed} ms\n`);
      let i = 1;
      for (const result of rankedResults) {
        readable.push(`[${i}]\n`);
        readable.push(`  Subject: ${result.subject}\n`);
        readable.push(`  Score:   ${JSON.stringify(result.score)}\n`);
        for (const quad of result.quads) {
          readable.push(`    ${quad.predicate.value}\n`);
          readable.push(`      ${quad.object.value}\n`);
        }
        i += 1;
      }
      readable.push('\n');
    }

    const elapsed = new Date().getTime() - start.getTime();
    readable.push(`Finished in ${elapsed} ms`);

    return { stdout: readable };
  }

  protected gatherExpectedTreeValues(args: IActorInitTypeaheadQueryArgs): RDF.Literal[] {
    // FIXME: this function makes strings out of everything
    const result: RDF.Literal[] = [];
    for (const [ dataType, values ] of Object.entries(args.expectedDatatypeValues)) {
      if (
        dataType === 'http://www.w3.org/2001/XMLSchema#string' ||
        dataType === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
      ) {
        for (const value of values) {
          result.push(DF.literal(value, DF.namedNode(dataType)));
        }
      }
    }
    for (const [ values ] of Object.entries(args.expectedPredicateValues)) {
      for (const value of values) {
        result.push(DF.literal(value.toString()));
      }
    }
    return result;
  }

  public async * query(args: IActorInitTypeaheadQueryArgs): AsyncGenerator<IRankedSubject[]> {
    let results: IResult = {
      subjects: new Set(),
      rankedSubjects: [],
    };
    const currentTreeValues: TreeValues = {};
    const expectedTreeValues: TreeValues = {
      'https://w3id.org/tree#SubstringRelation': this.gatherExpectedTreeValues(args),
    };

    let { score } = await this.mediatorTreeScore.mediate({
      values: {},
      expectedValues: expectedTreeValues,
    });
    if (!Array.isArray(score)) {
      score = [ score ];
    }

    const queue = new TinyQueue([], compareTree);
    for (const url of args.urls) {
      queue.push({
        score,
        url,
        values: currentTreeValues,
      });
    }

    while (queue.length > 0) {
      const aaa = queue.pop();
      if (!aaa) {
        break;
      }
      const { url } = aaa;
      const dereference: IActionRdfDereference = {
        context: args.context,
        url,
      };

      const rdfDereferenceOutput: IActorRdfParseOutput = await this.mediatorRdfDereference.mediate(dereference);

      // Determine the metadata
      const rdfMetadataOuput: IActorRdfMetadataOutput = await this.mediatorMetadata.mediate(
        { url, quads: rdfDereferenceOutput.quads, triples: rdfDereferenceOutput.triples },
      );
      const { metadata } = await this.mediatorMetadataExtract
        .mediate({ url, metadata: rdfMetadataOuput.metadata });

      const treeNodes = this.extractTreeNodes(metadata);
      const { urls } = await this.mediatorHypermediaLinks.mediate({ metadata });

      for (const childNode of urls) {
        const values = this.assignValueToLink(childNode, currentTreeValues, treeNodes);
        let { score: treeScore } = await this.mediatorTreeScore.mediate({
          values,
          expectedValues: expectedTreeValues,
        });

        if (!Array.isArray(treeScore)) {
          treeScore = [ treeScore ];
        }

        const sum = treeScore.reduce((acc, cur) => acc + cur, 0);
        if (sum > 0) {
          queue.push({
            treeScore,
            url: <string> childNode,
            values,
          });
        }
      }

      results = await this.processPage(rdfMetadataOuput.data, results, args.expectedDatatypeValues);
      yield results.rankedSubjects;
    }
  }

  protected assignValueToLink(
    link: string | ILink,
    currentValues: TreeValues,
    treeNodes: Record<string, ITreeNode>,
  ): TreeValues {
    let url: string;
    if (typeof link === 'string' || link instanceof String) {
      url = <string> link;
    } else {
      url = link.url;
    }

    if (url in treeNodes) {
      return { ...currentValues, ...treeNodes[url].values };
    }
    return currentValues;
  }

  protected extractTreeNodes(metadata: Record<string, any>): Record<string, ITreeNode> {
    const result: Record<string, ITreeNode> = {};
    if ('treeMetadata' in metadata) {
      for (const [ _, relation ] of metadata.treeMetadata.relations) {
        for (const node of relation.node) {
          const url = node['@id'];

          if (!(url in result)) {
            result[url] = {
              url,
              values: {},
            };
          }

          const treeNode: ITreeNode = result[url];
          for (const type of relation['@type']) {
            // Always overwrite
            treeNode.values[type] = [];

            for (const value of relation.value) {
              treeNode.values[type].push(DF.literal(value['@value'], value['@type']));
            }
          }
        }
      }
    }
    return result;
  }

  protected processPage(
    quadStream: RDF.Stream,
    previousResults: IResult,
    expectedDatatypeValues: IExpectedValues,
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
            };

            try {
              const literalValue = await this.mediatorLiteralNormalize.mediate({ data: quad });
              action.literalValue = literalValue.result;
            } catch {
              // Is ok
            }

            let { score: quadScore } = await this.mediatorRdfScore.mediate(action);
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
                score = this.updateScores(score, quadScore);
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

  /**
   * Function to combine scores from different RDF statements
   * @param original the current score array
   * @param newScores a score array with potential updates
   */
  protected updateScores(original: RDFScore[], newScores: RDFScore[]): RDFScore[] {
    let i = 0;
    let better = false;
    for (const newElement of newScores) {
      const originalElement = original[i];

      if (newElement === null) {
        continue;
      } else if (originalElement === null) {
        // We have no valid score from actor i yet
        original[i] = newElement;
      } else if (newElement > originalElement || better) {
        // This is an improvement over the previous value
        better = true;
        original[i] = newElement;
      } else if (originalElement > newElement && !better) {
        // The current score is better; abort
        break;
      }
      i += 1;
    }

    return original;
  }
}

export interface IRankedSubject {
  score: number[];
  subject: string;
  quads: RDF.Quad[];
}

export interface IResult {
  subjects: Set<string>;
  rankedSubjects: IRankedSubject[];
}

export interface IRankedTreeNode {
  score: number[];
  url: string;
  values: TreeValues;
}

export interface IActorInitTypeaheadArgs extends IActorArgs<IActionInit, IActorTest, IActorOutputInit> {
  mediatorRdfDereference: Mediator<DereferenceActor, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  mediatorRdfScore: Mediator<ScoreActor<any>, IActionRdfScore<any>,
  IActorTest, IActorRdfScoreOutput>;

  mediatorLiteralNormalize: Mediator<ActorLiteralNormalize<any>, IActionLiteralNormalize<any>,
  IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<any>>;

  mediatorMetadata: Mediator<ActorRdfMetadata, IActionRdfMetadata,
  IActorTest, IActorRdfMetadataOutput>;

  mediatorMetadataExtract: Mediator<ActorRdfMetadataExtract, IActionRdfMetadataExtract,
  IActorTest, IActorRdfMetadataExtractOutput>;

  mediatorHypermediaLinks: Mediator<ActorRdfResolveHypermediaLinks, IActionRdfResolveHypermediaLinks,
  IActorTest, IActorRdfResolveHypermediaLinksOutput>;

  mediatorTreeScore: Mediator<ActorTreeScore, IActionTreeScore,
  IActorTreeScoreTest, IActorTreeScoreOutput>;
}

export interface IActorInitTypeaheadQueryArgs {
  // Todo, add tree relation data
  urls: string[];

  expectedDatatypeValues: IExpectedValues;
  expectedPredicateValues: IExpectedValues;

  context?: ActionContext;
}

function compareResults(first: IRankedSubject, second: IRankedSubject): number {
  if (first.score.length < second.score.length) {
    // Longer scores are assumed to be better;
    // The missing entries are assumed to be `null`
    return 1;
  }
  if (second.score.length < first.score.length) {
    return -1;
  }

  for (let i = 0; i < first.score.length; i++) {
    const e1 = first.score[i];
    const e2 = second.score[i];

    if (e1 === null || e2 === null) {
      continue;
    }

    if (e1 < e2) {
      // Higher is better
      return 1;
    }
    if (e2 < e1) {
      return -1;
    }
  }

  if (first.subject < second.subject) {
    return -1;
  }
  if (second.subject < first.subject) {
    return 1;
  }

  return 0;
}

function compareTree(first: IRankedTreeNode, second: IRankedTreeNode): number {
  if (first.score.length < second.score.length) {
    // Longer scores are assumed to be better;
    // The missing entries are assumed to be `null`
    return 1;
  }
  if (second.score.length < first.score.length) {
    return -1;
  }

  for (let i = 0; i < first.score.length; i++) {
    const e1 = first.score[i];
    const e2 = second.score[i];

    if (e1 === null || e2 === null) {
      continue;
    }

    if (e1 < e2) {
      // Higher is better
      return 1;
    }
    if (e2 < e1) {
      return -1;
    }
  }

  return 0;
}
