import type { IActorArgs } from '@comunica/core';
import { ActorLiteralNormalize } from '@treecg/bus-literal-normalize';
import type {
  IActionLiteralNormalize,
  IActorLiteralNormalizeOutput,
  IActorLiteralNormalizeTest,
} from '@treecg/bus-literal-normalize';
import type { Quad } from 'rdf-js';

export class ActorLiteralNormalizeNFKD extends ActorLiteralNormalize<string> {
  public readonly regex: RegExp;
  public readonly whitespace: RegExp;

  public constructor(
    args: IActorArgs<IActionLiteralNormalize<string>, IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<string>>,
  ) {
    super(args);
    this.regex = /[^\p{L}\p{N}\p{Z}]/gu;
    this.whitespace = /[\p{Z}]+/gu;
  }

  public async test(action: IActionLiteralNormalize<string>): Promise<IActorLiteralNormalizeTest> {
    const suitable = this.isValidQuad(action.data) || this.isValidLiteral(action.data);
    if (!suitable) {
      throw new Error('That ain\'t a string');
    }
    return { suitable };
  }

  public async run(action: IActionLiteralNormalize<string>): Promise<IActorLiteralNormalizeOutput<string>> {
    let input: string | undefined;
    if (this.isValidQuad(action.data)) {
      input = action.data.object.value;
    } else if (this.isValidLiteral(action.data)) {
      input = action.data;
    }

    if (input !== undefined) {
      // Get rid of whitespace
      input = input.trim();
      input = input.toLowerCase();
      // Normalize diacritics
      input = input.normalize('NFKD');
      input = input.replace(this.regex, '');
      return { result: input.split(this.whitespace) };
    }

    return { result: []};
  }

  protected isValidQuad(data: string | Quad): data is Quad {
    if (typeof data === 'object' && 'object' in data) {
      const quadObject = data.object;
      if (quadObject.termType === 'Literal') {
        const dataType = quadObject.datatype.value;
        if (
          dataType === 'http://www.w3.org/2001/XMLSchema#string' ||
          dataType === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
        ) {
          return true;
        }
      }
    }

    return false;
  }

  protected isValidLiteral(data: string | Quad): data is string {
    return typeof data === 'string';
  }
}
