import Image from './Image';

interface Flair {
  name: string;
  label: string;
  description: string;
  color: string;
  rainbowColor: boolean;
  hidden: boolean;
  priority: number;
  image: Image[];
}

export default Flair;
