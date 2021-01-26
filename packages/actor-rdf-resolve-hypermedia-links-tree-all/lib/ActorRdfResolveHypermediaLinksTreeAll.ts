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
    if (!action.metadata.next && !action.metadata.treeProperties) {
      throw new Error(`Actor ${this.name} requires a 'next' or a 'treeProperties' metadata entry.`);
    }
    return true;
  }

  public async run(action: IActionRdfResolveHypermediaLinks): Promise<IActorRdfResolveHypermediaLinksOutput> {
    const urls = [];
    if (action.metadata.next) {
      urls.push(action.metadata.next);
    }
    if (action.metadata.treeProperties) {
      for (const [ _, relation ] of action.metadata.treeProperties.relations) {
        urls.push(relation['tree:node']);
      }
    }
    return { urls };
  }
}
