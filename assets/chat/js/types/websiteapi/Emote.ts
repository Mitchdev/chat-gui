import Image from './Image';

interface Emote {
  prefix: string;
  creator: string;
  theme: number;
  minimumSubTier: number;
  twitch: boolean;
  image: Image[];
}

export default Emote;
