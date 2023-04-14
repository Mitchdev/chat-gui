import Chat from '../chat';
import ChatWindow from '../window';
import MessageTypes from './MessageTypes';

export default class ChatUIMessage {
  type: MessageTypes;
  message: string;
  classes: string[];
  ui: HTMLDivElement | null;

  constructor(message: string, classes: string[] = []) {
    this.type = MessageTypes.UI;
    this.message = message;
    this.classes = classes;
    this.ui = null;
  }

  into(chat: Chat, window: ChatWindow | null = null) {
    chat.addMessage(this, window);
    return this;
  }

  wrap(
    content: string,
    classes: string[] = [],
    attr: { [key: string]: string } = {}
  ) {
    classes.push(...this.classes);
    classes.unshift(`msg-${this.type.toLowerCase()}`);
    classes.unshift(`msg-chat`);

    const wrapped = document.createElement('div');
    wrapped.className = classes.join(' ');
    Object.entries(attr).forEach(([key, value]) =>
      wrapped.setAttribute(key, value)
    );
    wrapped.innerHTML = content;
    return wrapped;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  html(chat: Chat) {
    return this.wrap(this.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  afterRender(chat: Chat) {}
}
