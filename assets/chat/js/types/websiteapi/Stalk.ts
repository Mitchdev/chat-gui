interface Stalk {
  nick: string;
  lines: {
    text: string;
    timestamp: number;
  }[];
}

export default Stalk;
