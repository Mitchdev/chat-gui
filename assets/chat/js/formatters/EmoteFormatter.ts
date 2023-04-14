import Chat from '../chat';
import { ChatUserMessage } from '../messages';
import ChatEmoteMessage from '../messages/ChatEmoteMessage';

export default class EmoteFormatter {
  format(
    chat: Chat,
    str: string,
    message: ChatEmoteMessage | ChatUserMessage | null = null
  ) {
    const regex =
      !message || !(message as ChatUserMessage).user
        ? chat.emoteService.systemEmoteRegex
        : chat.emoteService.emoteRegexForUser(
            (message as ChatUserMessage).user
          );

    if (regex != null) {
      return str.replace(regex, '$1<div title="$2" class="emote $2">$2 </div>');
    }
    return str;
  }
}
