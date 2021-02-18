import { Readable } from 'stream';
import type { IActionInit, IActorOutputInit } from '@comunica/bus-init';
import type { IActorInitTypeaheadArgs } from './ActorInitTypeaheadBrowser';
import { ActorInitTypeaheadBrowser } from './ActorInitTypeaheadBrowser';
import type IResult from './interfaces/IResult';

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
        const elapsed = Date.now() - start;
        readable.push(`Partial Result; Finished in ${elapsed} ms\n`);
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
