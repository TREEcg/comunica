import { Readable } from 'stream';
import type { IActionInit, IActorOutputInit } from '@comunica/bus-init';
import { ActorInit } from '@comunica/bus-init';
import type { IActionRdfDereference, IActorRdfDereferenceOutput } from '@comunica/bus-rdf-dereference';
import type { IActorRdfParseOutput } from '@comunica/bus-rdf-parse';
import type { Actor, IActorArgs, IActorTest, Mediator } from '@comunica/core';
import type {
  IActionRdfScore,
  IActorRdfScoreTest,
  IActorRdfScoreOutputSingle,
  IActorRdfScoreOutput,
  IExpectedValues,
  RDFScore,
} from '@hdelva/bus-rdf-score';
import * as N3 from 'n3';
import type * as RDF from 'rdf-js';

type DereferenceActor = Actor<IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>;
type ScoreActor = Actor<IActionRdfScore<any>, IActorRdfScoreTest, IActorRdfScoreOutputSingle>;

export class ActorInitTypeahead extends ActorInit implements IActorInitTypeaheadArgs {
  public readonly mediatorRdfDereference: Mediator<DereferenceActor, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  public readonly mediatorRdfScore: Mediator<ScoreActor, IActionRdfScore<any>,
  IActorRdfScoreTest, IActorRdfScoreOutput>;

  public readonly url: string;
  public readonly value: string;

  public constructor(args: IActorInitTypeaheadArgs) {
    super(args);
  }

  public async test(action: IActionInit): Promise<IActorTest> {
    return true;
  }

  public async run(action: IActionInit): Promise<IActorOutputInit> {
    const dereference: IActionRdfDereference = {
      context: action.context,
      url: action.argv.length > 0 ? action.argv[0] : this.url ?? '',
    };

    const expectedValue = action.argv.length > 1 ? action.argv[1] : this.value ?? '';
    const expectedDatatypeValues = {
      'http://www.w3.org/2001/XMLSchema#string': [ expectedValue ],
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString': [ expectedValue ],
    };

    if (!dereference.url) {
      throw new Error('A URL must be given either in the config or as CLI arg');
    }
    const parsedQuads: IActorRdfParseOutput = await this.mediatorRdfDereference.mediate(dereference);

    const readable = new Readable();
    readable._read = () => {
      // Do nothing
    };

    const rankedResults = await this.processPage(parsedQuads, [], expectedDatatypeValues);
    for (const result of rankedResults) {
      readable.push(result.subject);
      readable.push('\n');
      readable.push(JSON.stringify(result.score));
      readable.push('\n');
      for (const quad of result.quads) {
        readable.push(`${quad.object.value}\n`);
      }
    }

    return { stdout: readable };
  }

  protected processPage(
    parsedQuads: IActorRdfParseOutput,
    previousResults: IRankedResult[],
    expectedDatatypeValues: IExpectedValues,
  ): Promise<IRankedResult[]> {
    const buffer: IRankedResult[] = [ ...previousResults ];

    const store = new N3.Store();
    store.import(parsedQuads.quads);

    const result: Promise<IRankedResult[]> = new Promise(resolve => {
      parsedQuads.quads.on('end', async() => {
        for (const subject of store.getSubjects(null, null, null)) {
          let score: RDFScore[] = [];
          const quads = store.getQuads(subject, null, null, null);
          for (const quad of quads) {
            // TODO
            // Send these to a NormalizeMediator
            // NormalizeActors know which values they can handle
            if (quad.object.termType === 'Literal') {
              const literalValue = normalize(quad.object.value).split(/\s/u);
              const action = {
                quad,
                literalValue,
                expectedDatatypeValues,
              };

              let { score: quadScore } = await this.mediatorRdfScore.mediate(action);
              if (!Array.isArray(quadScore)) {
                quadScore = [ quadScore ];
              }

              if (score.length === 0) {
                score = quadScore;
              } else {
                score = updateScores(score, quadScore);
              }
            }
          }

          if (score.length > 0 && !score.includes(null)) {
            const cast: number[] = <number[]> score;
            buffer.push({
              score: cast,
              subject: subject.value,
              quads,
            });
          }
        }

        buffer.sort(compareResults);
        resolve(buffer.slice(0, 10));
      });
    });

    return result;
  }
}

export interface IRankedResult {
  score: number[];
  subject: string;
  quads: RDF.Quad[];
}

export interface IActorInitTypeaheadArgs extends IActorArgs<IActionInit, IActorTest, IActorOutputInit> {

  mediatorRdfDereference: Mediator<DereferenceActor, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  mediatorRdfScore: Mediator<ScoreActor, IActionRdfScore<any>,
  IActorTest, IActorRdfScoreOutput>;

  url: string;
  value: string;
}

const characterRegex = /[^\p{L}\p{N}\p{Z}]/gu;
function normalize(input: string): string {
  // Get rid of whitespace
  input = input.trim();
  input = input.toLowerCase();
  // Normalize diacritics
  input = input.normalize('NFKD');
  input = input.replace(characterRegex, '');
  return input;
}

function compareResults(first: IRankedResult, second: IRankedResult): number {
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

    if (e1 === null && e2 === null) {
      continue;
    }

    if (e1 === null) {
      return 1;
    }
    if (e2 === null) {
      return -1;
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

function updateScores(original: RDFScore[], newScores: RDFScore[]): RDFScore[] {
  let i = 0;
  let better = false;
  for (const newElement of newScores) {
    const originalElement = original[i];

    if (newElement !== null) {
      if (originalElement === null) {
        // This is the first valid value
        original[i] = newElement;
      } else if (newElement > originalElement || better) {
        // This is an improvement over the previous value
        better = true;
        original[i] = newElement;
      } else if (originalElement > newElement && !better) {
        break;
      }
    } else {
      break;
    }
    i += 1;
  }

  return original;
}
