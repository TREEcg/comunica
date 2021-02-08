import type { TreeValues } from '@treecg/bus-tree-score';

export default interface IRankedTreeNode {
  score: number[];
  url: string;
  values: TreeValues;
}
