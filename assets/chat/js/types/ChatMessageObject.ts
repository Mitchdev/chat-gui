import ChatUserObject from './ChatUserObject';

interface ChatMessageObject extends ChatUserObject {
  data: string;
  timestamp: number;
}

export default ChatMessageObject;
