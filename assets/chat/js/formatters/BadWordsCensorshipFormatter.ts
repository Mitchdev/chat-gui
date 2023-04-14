import Chat from '../chat';

export default class BadWordsCensorshipFormatter {
  badWordsRegex =
    /(fuck|shit|cunt|whore|bitch|faggot|fag|nigger|nigga|gusano|cracker|rape)/gi;

  format(chat: Chat, str: string) {
    if (chat.settings.get('censorbadwords')) {
      return str.replace(this.badWordsRegex, (match) =>
        '*'.repeat(match.length)
      );
    }

    return str;
  }
}
