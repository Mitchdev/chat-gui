interface Ban {
  nick: string;
  reason: string;
  ispermanent?: boolean;
  duration?: number;
  banip?: boolean;
}

export default Ban;
