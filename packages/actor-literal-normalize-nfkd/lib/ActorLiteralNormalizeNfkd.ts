import type { IActorArgs } from '@comunica/core';
import { ActorLiteralNormalize } from '@hdelva/bus-literal-normalize';
import type {
  IActionLiteralNormalize,
  IActorLiteralNormalizeOutput,
  IActorLiteralNormalizeTest,
} from '@hdelva/bus-literal-normalize';

export class ActorLiteralNormalizeNFKD extends ActorLiteralNormalize<string> {
  public readonly regex: RegExp;
  public readonly whitespace: RegExp;

  public constructor(
    args: IActorArgs<IActionLiteralNormalize, IActorLiteralNormalizeTest, IActorLiteralNormalizeOutput<string>>,
  ) {
    super(args);
    this.regex = /[^\p{L}\p{N}\p{Z}]/gu;
    this.whitespace = /\p{Z}/gu;
  }

  public async test(action: IActionLiteralNormalize): Promise<IActorLiteralNormalizeTest> {
    const quadObject = action.quad.object;
    if (quadObject.termType === 'Literal') {
      const dataType = quadObject.datatype.value;
      if (
        dataType === 'http://www.w3.org/2001/XMLSchema#string' ||
        dataType === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
      ) {
        return { suitable: true };
      }
    }

    return { suitable: false };
  }

  public async run(action: IActionLiteralNormalize): Promise<IActorLiteralNormalizeOutput<string>> {
    if (action.quad.object.termType === 'Literal') {
      let input = action.quad.object.value;
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
}
