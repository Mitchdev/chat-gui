import Nick from './Nick';

interface PollStart extends Nick {
  canvote: boolean;
  myvote: number;
  weighted: boolean;
  start: string;
  now: string;
  time: number;
  question: string;
  options: string[];
  totals: number[];
  totalvotes: number;
}

export default PollStart;
