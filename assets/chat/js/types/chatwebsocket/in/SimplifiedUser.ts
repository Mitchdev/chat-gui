import Nick from './Nick';

interface SimplifiedUser extends Nick {
  features: string[];
  createdDate: string;
}

export default SimplifiedUser;
