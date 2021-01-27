import type { RDFScore } from '@hdelva/bus-rdf-score';

/**
 * Function to combine scores from different RDF statements
 * @param original the current score array
 * @param newScores a score array with potential updates
 */
export default function mergeScores(original: RDFScore[], newScores: RDFScore[]): RDFScore[] {
  let i = 0;
  let better = false;
  for (const newElement of newScores) {
    const originalElement = original[i];

    if (newElement === null) {
      continue;
    } else if (originalElement === null) {
      // We have no valid score from actor i yet
      original[i] = newElement;
    } else if (newElement > originalElement || better) {
      // This is an improvement over the previous value
      better = true;
      original[i] = newElement;
    } else if (originalElement > newElement && !better) {
      // The current score is better; abort
      break;
    }
    i += 1;
  }

  return original;
}
