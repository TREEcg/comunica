import type { ILink } from '@comunica/bus-rdf-resolve-hypermedia-links';
import type { TreeValues } from '@treecg/bus-tree-score';
import type ITreeNode from '../interfaces/ITreeNode';

export default function assignValueToLink(
  link: string | ILink,
  currentValues: TreeValues,
  treeNodes: Record<string, ITreeNode>,
): TreeValues {
  let url: string;
  if (typeof link === 'string' || link instanceof String) {
    url = <string>link;
  } else {
    url = link.url;
  }

  if (url in treeNodes) {
    return { ...currentValues, ...treeNodes[url].values };
  }
  return currentValues;
}
