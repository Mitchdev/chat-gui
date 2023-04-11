import Data from './Data';
import Nick from './Nick';
import Timestamp from './Timestamp';

interface SubOnly extends Nick, Data, Timestamp {}

export default SubOnly;
