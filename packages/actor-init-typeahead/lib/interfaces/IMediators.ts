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
import type { IActorTest, Mediator } from '@comunica/core';
import type {
  ActorLiteralNormalize,
  IActionLiteralNormalize,
  IActorLiteralNormalizeOutput,
  IActorLiteralNormalizeTest,
} from '@hdelva/bus-literal-normalize';
import type {
  IActionRdfScore,
  IActorRdfScoreOutput,
  ActorRdfScore,
} from '@hdelva/bus-rdf-score';
import type {
  ActorTreeScore,
  IActionTreeScore,
  IActorTreeScoreOutput,
  IActorTreeScoreTest,
} from '@hdelva/bus-tree-score';

export default interface IMediators {
  mediatorRdfDereference: Mediator<ActorRdfDereference, IActionRdfDereference,
  IActorTest, IActorRdfDereferenceOutput>;

  mediatorRdfScore: Mediator<ActorRdfScore<any>, IActionRdfScore<any>,
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
