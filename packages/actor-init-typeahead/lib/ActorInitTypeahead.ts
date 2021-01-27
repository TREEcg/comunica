import { Readable } from 'stream';
import type { IActionInit, IActorOutputInit } from '@comunica/bus-init';
import { ActorInit } from '@comunica/bus-init';
import type {
  ActorRdfDereference,
  IActionRdfDereference,
  IActorRdfDereferenceOutput,
} from '@comunica/bus-rdf-dereference';
import type { ActorRdfMetadata, IActionRdfMetadata, IActorRdfMetadataOutput } from '@comunica/bus-rdf-metadata';
import type {
  ActorRdfMetadataExtract,
  IActionRdfMetadataExtract,
  IActorRdfMetadataExtractOutput,
} from '@comunica/bus-rdf-metadata-extract';
import type {
  ActorRdfResolveHypermediaLinks,
  IActionRdfResolveHypermediaLinks,
  IActorRdfResolveHypermediaLinksOutput,
} from '@comunica/bus-rdf-resolve-hypermedia-links';
import type { ActionContext, IActorArgs, IActorTest, Mediator } from '@comunica/core';
import type {
  ActorLiteralNormalize,
  IActionLiteralNormalize,
  IActorLiteralNormalizeOutput,
  IActorLiteralNormalizeTest,
} from '@hdelva/bus-literal-normalize';
import type {
  IActionRdfScore,
  IActorRdfScoreTest,
  IActorRdfScoreOutput,
  IExpectedValues,
  ActorRdfScore,
} from '@hdelva/bus-rdf-score';
import type {
  ActorTreeScore,
  IActionTreeScore,
  IActorTreeScoreOutput,
  IActorTreeScoreTest,
  TreeValues,
} from '@hdelva/bus-tree-score';

import { DataFactory } from 'rdf-data-factory';
import type * as RDF from 'rdf-js';
import type IMediators from './interfaces/IMediators';
import type IResult from './interfaces/IResult';
import type ITreeNode from './interfaces/ITreeNode';
import ResultsIterator from './ResultsIterator';

const DF: RDF.DataFactory = new DataFactory();

export class ActorInitTypeahead extends ActorInit implements IActorInitTypeaheadArgs {
  public readonly mediatorRdfDereference: Mediator<ActorRdfDereference, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  public readonly mediatorRdfScore: Mediator<ActorRdfScore<any>, IActionRdfScore<any>,
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

    this.query(query)
      .on('data', (result: IResult) => {
        const elapsed = new Date().getTime() - start.getTime();
        readable.push(`Partial Result; Finished in ${elapsed} ms\n`);
        let i = 1;
        for (const entry of result.rankedSubjects) {
          readable.push(`[${i}]\n`);
          readable.push(`  Subject: ${entry.subject}\n`);
          readable.push(`  Score:   ${JSON.stringify(entry.score)}\n`);
          for (const quad of entry.quads) {
            readable.push(`    ${quad.predicate.value}\n`);
            readable.push(`      ${quad.object.value}\n`);
          }
          i += 1;
        }
        readable.push('\n');
      })
      .on('end', () => {
        const elapsed = new Date().getTime() - start.getTime();
        readable.push(`Finished in ${elapsed} ms`);
      });

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
    for (const values of Object.values(args.expectedPredicateValues)) {
      for (const value of values) {
        result.push(DF.literal(value.toString()));
      }
    }
    return result;
  }

  public query(args: IActorInitTypeaheadQueryArgs): ResultsIterator {
    const expectedTreeValues: TreeValues = {
      'https://w3id.org/tree#SubstringRelation': this.gatherExpectedTreeValues(args),
    };

    const nodes: ITreeNode[] = [];
    for (const url of args.urls) {
      nodes.push({ url, values: {}});
    }

    const mediators: IMediators = {
      mediatorRdfDereference: this.mediatorRdfDereference,
      mediatorRdfScore: this.mediatorRdfScore,
      mediatorLiteralNormalize: this.mediatorLiteralNormalize,
      mediatorMetadata: this.mediatorMetadata,
      mediatorMetadataExtract: this.mediatorMetadataExtract,
      mediatorHypermediaLinks: this.mediatorHypermediaLinks,
      mediatorTreeScore: this.mediatorTreeScore,
    };

    return new ResultsIterator(
      nodes,
      mediators,
      expectedTreeValues,
      args.expectedDatatypeValues,
      args.expectedPredicateValues,
    );
  }
}

export interface IActorInitTypeaheadArgs extends IActorArgs<IActionInit, IActorTest, IActorOutputInit>, IMediators {

}

export interface IActorInitTypeaheadQueryArgs {
  // Todo, add tree relation data
  urls: string[];

  expectedDatatypeValues: IExpectedValues;
  expectedPredicateValues: IExpectedValues;

  context?: ActionContext;
}
