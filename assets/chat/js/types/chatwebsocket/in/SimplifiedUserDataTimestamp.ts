import Data from './Data';
import SimplifiedUser from './SimplifiedUser';
import Timestamp from './Timestamp';

interface SimplifiedUserDataTimestamp extends SimplifiedUser, Data, Timestamp {}

export default SimplifiedUserDataTimestamp;
