import type IRankedSubject from './IRankedSubject';
import type ITreeNode from './ITreeNode';

export default interface IResult {
  subjects: Set<string>;
  knownTreeNodes: ITreeNode[];
  rankedSubjects: IRankedSubject[];
}
