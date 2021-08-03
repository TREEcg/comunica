import { ActorRdfMetadataExtract } from '@comunica/bus-rdf-metadata-extract';
import type { IActionRdfMetadataExtract, IActorRdfMetadataExtractOutput } from '@comunica/bus-rdf-metadata-extract';
import type { IActorTest } from '@comunica/core';

import { extractMetadata } from '@treecg/tree-metadata-extraction';

/**
 * A comunica actor to extract the tree metadata from RDF sources
 */
export class ActorRdfMetadataExtractTree extends ActorRdfMetadataExtract {
  public async test(action: IActionRdfMetadataExtract): Promise<IActorTest> {
    return true;
  }

  public async run(action: IActionRdfMetadataExtract): Promise<IActorRdfMetadataExtractOutput> {
    const quadArray: Promise<any[]> = new Promise((resolve, reject) => {
      const quads: any[] = [];
      action.metadata.on('error', reject);
      action.metadata.on('data', quad => {
        quads.push(quad);
      });
      action.metadata.on('end', () => {
        resolve(quads);
      });
    });
    const extractedMetadata = await extractMetadata(await quadArray);

    const metadata = { treeMetadata: extractedMetadata };
    return { metadata };
  }
}
