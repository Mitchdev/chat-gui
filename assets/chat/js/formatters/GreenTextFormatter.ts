import Chat from '../chat';
import { ChatUserMessage } from '../messages';

export default class GreenTextFormatter {
  format(chat: Chat, str: string, message: ChatUserMessage | null = null) {
    if (message?.user && str.indexOf('&gt;') === 0) {
      return `<span class="greentext">${str}</span>`;
    }

    return str;
  }
}
