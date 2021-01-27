import type { TreeValues } from '@hdelva/bus-tree-score';

export default interface IRankedTreeNode {
  score: number[];
  url: string;
  values: TreeValues;
}
