import Chat from '../chat';
import { ChatUserMessage } from '../messages';

export default class SuspostFormatter {
  format(chat: Chat, str: string, message: ChatUserMessage | null = null) {
    const u = message?.user;
    if ((u?.isPrivileged() || u?.isSubscriber()) && str.indexOf('ඞ') === 0) {
      return `<span class="sus">${str}</span>`;
    }

    return str;
  }
}
