import type { TreeValues } from '@treecg/bus-tree-score';

export default interface IRankedTreeNode {
  treeScore: number[];
  url: string;
  values: TreeValues;
}
