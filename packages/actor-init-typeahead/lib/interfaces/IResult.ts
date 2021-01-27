import type IRankedSubject from './IRankedSubject';

export default interface IResult {
  subjects: Set<string>;
  rankedSubjects: IRankedSubject[];
}
