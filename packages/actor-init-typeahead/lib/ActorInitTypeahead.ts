import { Readable } from 'stream';
import type { IActionInit, IActorOutputInit } from '@comunica/bus-init';
import type { IActorInitTypeaheadArgs } from './ActorInitTypeaheadBrowser';
import { ActorInitTypeaheadBrowser } from './ActorInitTypeaheadBrowser';
import type IResult from './interfaces/IResult';
import type ITreeNode from './interfaces/ITreeNode';
import type { TreeValues } from '../../bus-tree-score/lib/ActorTreeScore';

export class ActorInitTypeahead extends ActorInitTypeaheadBrowser {
  public constructor(args: IActorInitTypeaheadArgs) {
    super(args);
  }

  public async run(action: IActionInit): Promise<IActorOutputInit> {
    const [ url, ...rawValues ] = action.argv;

    const readable = new Readable();
    readable._read = () => {
      // Do nothing
    };

    const start = Date.now();

    const expectedValues: string[] = await this.normalizeInput(rawValues);
    const expectedDatatypeValues = {
      'http://www.w3.org/2001/XMLSchema#string': expectedValues,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString': expectedValues,
    };

    const values: TreeValues = {};
    const treeNodes: ITreeNode[] = [{ url, values }];
    const query = {
      numResults: 5,
      treeNodes,
      expectedDatatypeValues,
      expectedPredicateValues: {},
      context: action.context,
    };

    this.query(query)
      .on('data', (result: IResult) => {
        const elapsed = Date.now() - start;
        readable.push(`Partial Result; Finished in ${elapsed} ms\n`);
        readable.push(`# Discovered TREE nodes: ${result.knownTreeNodes.length}\n`);
        let i = 1;
        for (const entry of result.rankedSubjects) {
          readable.push(`[${i}]\n`);
          readable.push(`  Subject: ${entry.subject}\n`);
          readable.push(`  # Matching Quads: ${entry.matchingQuads.length}\n`);
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
        const elapsed = Date.now() - start;
        readable.push(`Finished in ${elapsed} ms`);
      });

    return { stdout: readable };
  }
}
