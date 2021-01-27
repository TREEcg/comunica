import type IRankedSubject from '../interfaces/IRankedSubject';

export default function compareResults(first: IRankedSubject, second: IRankedSubject): number {
  if (first.score.length < second.score.length) {
    // Longer scores are assumed to be better;
    // The missing entries are assumed to be `null`
    return 1;
  }
  if (second.score.length < first.score.length) {
    return -1;
  }

  for (let i = 0; i < first.score.length; i++) {
    const e1 = first.score[i];
    const e2 = second.score[i];

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

  if (first.subject < second.subject) {
    return -1;
  }
  if (second.subject < first.subject) {
    return 1;
  }

  return 0;
}
