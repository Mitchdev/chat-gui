export enum PollType {
  Normal,
  Weighted,
}

interface Poll {
  canVote: boolean;
  myVote: number;
  type: PollType;
  start: Date;
  offset: number;
  time: number;
  question: string;
  options: string[];
  totals: number[];
  user: string;
  votesCast: number;
}

export default Poll;
