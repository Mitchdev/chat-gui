export interface AutoCompleteItem {
  data: string;
  weight: number;
  isemote: boolean;
}

export interface AutoCompleteCriteria {
  word: string;
  pre: string;
  post: string;
  startCaret: number;
  useronly: boolean;
  orig: string;
}
