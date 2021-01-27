import type { IActionRdfResolveHypermediaLinks,
  IActorRdfResolveHypermediaLinksOutput } from '@comunica/bus-rdf-resolve-hypermedia-links';
import { ActorRdfResolveHypermediaLinks } from '@comunica/bus-rdf-resolve-hypermedia-links';
import type { IActorArgs, IActorTest } from '@comunica/core';

/**
 * A comunica TREE RDF Resolve Hypermedia Links Actor.
 */
export class ActorRdfResolveHypermediaLinksTreeAll extends ActorRdfResolveHypermediaLinks {
  public constructor(args: IActorArgs<IActionRdfResolveHypermediaLinks,
  IActorTest, IActorRdfResolveHypermediaLinksOutput>) {
    super(args);
  }

  public async test(action: IActionRdfResolveHypermediaLinks): Promise<IActorTest> {
    if (!action.metadata.next && !action.metadata.treeMetadata) {
      throw new Error(`Actor ${this.name} requires a 'next' or a 'treeMetadata' metadata entry.`);
    }
    return true;
  }

  public async run(action: IActionRdfResolveHypermediaLinks): Promise<IActorRdfResolveHypermediaLinksOutput> {
    const urls = [];
    if (action.metadata.next) {
      urls.push(action.metadata.next);
    }
    if (action.metadata.treeMetadata) {
      for (const [ _, relation ] of action.metadata.treeMetadata.relations) {
        for (const node of relation.node) {
          urls.push(node['@id']);
        }
      }
    }
    return { urls };
  }
}
