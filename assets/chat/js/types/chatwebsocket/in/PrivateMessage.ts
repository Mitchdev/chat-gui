import Data from './Data';
import Nick from './Nick';
import Timestamp from './Timestamp';

interface PrivateMessage extends Nick, Data, Timestamp {
  messageid?: number;
}

export default PrivateMessage;
