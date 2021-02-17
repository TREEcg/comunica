import type IRankedTreeNode from '../interfaces/IRankedTreeNode';

export default function compareTreeNodes(first: IRankedTreeNode, second: IRankedTreeNode): number {
  if (first.treeScore.length < second.treeScore.length) {
    // Longer scores are assumed to be better;
    // The missing entries are assumed to be `null`
    return 1;
  }
  if (second.treeScore.length < first.treeScore.length) {
    return -1;
  }

  for (let i = 0; i < first.treeScore.length; i++) {
    const e1 = first.treeScore[i];
    const e2 = second.treeScore[i];

    if (e1 === null || e2 === null) {
      continue;
    }

    if (e1 < e2) {
      // Higher is better
      return 1;
    }
    if (e2 < e1) {
      return -1;
    }
  }

  return 0;
}
