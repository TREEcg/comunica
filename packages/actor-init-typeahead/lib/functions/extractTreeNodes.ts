import { DataFactory } from 'rdf-data-factory';
import type * as RDF from 'rdf-js';
import type ITreeNode from '../interfaces/ITreeNode';

const DF: RDF.DataFactory = new DataFactory();

export default function extractTreeNodes(metadata: Record<string, any>): Record<string, ITreeNode> {
  const result: Record<string, ITreeNode> = {};
  if ('treeMetadata' in metadata) {
    for (const [ _, relation ] of metadata.treeMetadata.relations) {
      for (const node of relation.node) {
        const url = node['@id'];

        if (!(url in result)) {
          result[url] = {
            url,
            values: {},
          };
        }

        const treeNode: ITreeNode = result[url];
        for (const type of relation['@type']) {
          // Always overwrite
          treeNode.values[type] = [];

          for (const value of relation.value) {
            treeNode.values[type].push(DF.literal(value['@value'], value['@type']));
          }
        }
      }
    }
  }
  return result;
}
