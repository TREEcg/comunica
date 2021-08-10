import type { TreeValues } from '@treecg/bus-tree-score';
import compareTreeNodes from './functions/compareTreeNodes';

let TinyQueue = require('tinyqueue');
if (typeof TinyQueue !== 'function' && TinyQueue.default && typeof TinyQueue.default === 'function') {
  TinyQueue = TinyQueue.default;
}

/**
 * Wrapper class to hide the ugly lack of types in tinyqueue.
 * Also useful for adding debug logging
 */
export default class TreeNodeQueue {
  protected readonly queue: any;
  protected ticker: number;

  public constructor() {
    this.queue = new TinyQueue([], compareTreeNodes);
    this.ticker = 0;
  }

  public push(treeScore: number[], url: string, values: TreeValues): void {
    this.queue.push({
      treeScore,
      url,
      values,
    });
  }

  public pop(): string {
    const { url } = this.queue.pop();
    return url;
  }

  public size(): number {
    return this.queue.length;
  }
}
