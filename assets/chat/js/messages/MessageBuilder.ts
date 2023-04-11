import MessageTypes from './MessageTypes';
import ChatUIMessage from './ChatUIMessage';
import ChatMessage from './ChatMessage';
import ChatUserMessage from './ChatUserMessage';
import ChatEmoteMessage from './ChatEmoteMessage';
import PinnedMessage from './PinnedMessage';
import ChatUser from '../user';

export default class MessageBuilder {
  static element(message: string, classes = []) {
    return new ChatUIMessage(message, classes);
  }

  static status(message: string, timestamp: number | null = null) {
    return new ChatMessage(message, timestamp, MessageTypes.STATUS);
  }

  static error(message: string, timestamp: number | null = null) {
    return new ChatMessage(message, timestamp, MessageTypes.ERROR);
  }

  static info(message: string, timestamp: number | null = null) {
    return new ChatMessage(message, timestamp, MessageTypes.INFO);
  }

  static broadcast(message: string, timestamp: number | null = null) {
    return new ChatMessage(message, timestamp, MessageTypes.BROADCAST);
  }

  static command(message: string, timestamp: number | null = null) {
    return new ChatMessage(message, timestamp, MessageTypes.COMMAND);
  }

  static message(
    message: string,
    user: ChatUser,
    timestamp: number | null = null
  ) {
    return new ChatUserMessage(message, user, timestamp);
  }

  static emote(emote: string, timestamp: number | null, count = 1) {
    return new ChatEmoteMessage(emote, timestamp, count);
  }

  static whisper(
    message: string,
    user: ChatUser,
    target: string,
    timestamp: number | null = null,
    id: number | null = null
  ) {
    const m = new ChatUserMessage(message, user, timestamp);
    m.id = id;
    m.target = target;
    return m;
  }

  static historical(
    message: string,
    user: ChatUser,
    timestamp: number | null = null
  ) {
    const m = new ChatUserMessage(message, user, timestamp);
    m.historical = true;
    return m;
  }

  static pinned(
    message: string,
    user: ChatUser,
    timestamp: number | null,
    uuid: string
  ) {
    return new PinnedMessage(message, user, timestamp, uuid);
  }
}
