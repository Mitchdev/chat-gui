import Chat from '../chat';

const el = document.createElement('div');

export default class HtmlTextFormatter {
  format(chat: Chat, str: string) {
    el.textContent = str;
    return el.innerHTML;
  }
}
