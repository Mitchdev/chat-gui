import $ from 'jquery';
import Chat from './chat';

/**
 * Handles the dimming of the chat when you click on a username
 * within the chat GUI
 */
class ChatUserFocus {
  chat: Chat;
  css: CSSStyleSheet;
  focused: string[];

  constructor(chat: Chat, css: CSSStyleSheet) {
    this.chat = chat;
    this.css = css;
    this.focused = [];
    (this.chat.output as JQuery).on('click', (e) =>
      this.toggleElement(e.target)
    );
  }

  toggleElement(target: HTMLElement) {
    const t = $(target);
    if (t.hasClass('chat-user')) {
      if (!this.chat.settings.get('focusmentioned'))
        this.toggleFocus(t.closest('.msg-user').data('username'), false, true);
      this.toggleFocus(t.text());
    } else if (t.hasClass('user')) {
      this.toggleFocus(t.text());
    } else if (t.hasClass('flair')) {
      this.toggleFocus(t.data('flair'), true);
    } else if (this.focused.length > 0) {
      this.clearFocus();
    }
  }

  toggleFocus(value = '', isFlair = false, onlyAdd = false) {
    const normalized = value.toLowerCase();
    const index = this.focused.indexOf(normalized);
    const focused = index !== -1;

    if (!focused) {
      this.addCssRule(normalized, isFlair);
    } else if (!onlyAdd) {
      this.removeCssRule(index);
    }

    return this;
  }

  addCssRule(value: string, isFlair: boolean) {
    let rule;
    if (isFlair) {
      rule = `.msg-user.${value}{opacity:1 !important;}`;
    } else if (this.chat.settings.get('focusmentioned')) {
      rule = `.msg-pinned[data-username="${value}"],.msg-pinned[data-mentioned~="${value}"],.msg-user[data-username="${value}"],.msg-user[data-mentioned~="${value}"]{opacity:1 !important;}`;
    } else {
      rule = `.msg-pinned[data-username="${value}"],.msg-user[data-username="${value}"]{opacity:1 !important;}`;
    }
    this.css.insertRule(rule, this.focused.length); // max 4294967295
    this.focused.push(value);
    this.redraw();
  }

  removeCssRule(index: number) {
    this.css.deleteRule(index);
    this.focused.splice(index, 1);
    this.redraw();
  }

  clearFocus() {
    this.focused.forEach(() => this.css.deleteRule(0));
    this.focused = [];
    this.redraw();
  }

  redraw() {
    (this.chat.ui as JQuery).toggleClass('focus', this.focused.length > 0);
  }
}

export default ChatUserFocus;
