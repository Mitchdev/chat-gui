import UserObject from './UserObject';

interface MessageObject extends UserObject {
  data: string,
  timestamp: number;
}

export default MessageObject;