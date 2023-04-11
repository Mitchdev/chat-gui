import $ from 'jquery';
import { throttle } from 'throttle-debounce';
import ChatMessage from './ChatMessage';
import MessageTypes from './MessageTypes';
import { EmoteFormatter } from '../formatters';
import Chat from '../chat';

// eslint-disable-next-line no-use-before-define
function ChatEmoteMessageCount(message: ChatEmoteMessage) {
  if (!message || !message.combo) return;
  let stepClass = '';
  if (message.emotecount >= 50) stepClass = ' x50';
  else if (message.emotecount >= 30) stepClass = ' x30';
  else if (message.emotecount >= 20) stepClass = ' x20';
  else if (message.emotecount >= 10) stepClass = ' x10';
  else if (message.emotecount >= 5) stepClass = ' x5';
  message.combo.attr('class', `chat-combo${stepClass}`);
  (message.combo_count as JQuery).text(`${message.emotecount}`);
  (message.ui as HTMLDivElement).append(
    (message.text as JQuery).detach().get(0) as HTMLElement,
    message.combo.detach().get(0) as HTMLElement
  );
}

const ChatEmoteMessageCountThrottle = throttle(63, ChatEmoteMessageCount);

export default class ChatEmoteMessage extends ChatMessage {
  emotecount: number;
  emoteFormatter: EmoteFormatter;
  text: JQuery | null;
  combo: JQuery | null;
  combo_count: JQuery | null;
  combo_x: JQuery | null;
  combo_hits: JQuery | null;
  combo_txt: JQuery | null;

  constructor(emote: string, timestamp: number | null, count = 1) {
    super(emote, timestamp, MessageTypes.EMOTE);
    this.emotecount = count;
    this.emoteFormatter = new EmoteFormatter();

    this.text = null;
    this.combo = null;
    this.combo_count = null;
    this.combo_x = null;
    this.combo_hits = null;
    this.combo_txt = null;
  }

  html(chat: Chat | null = null) {
    this.text = $(
      `<span class="text">${this.emoteFormatter.format(
        chat,
        this.message,
        this
      )}</span>`
    );
    this.combo = $(`<span class="chat-combo"></span>`);
    this.combo_count = $(`<i class="count">${this.emotecount}</i>`);
    this.combo_x = $(`<i class="x">X</i>`);
    this.combo_hits = $(`<i class="hit">Hits</i>`);
    this.combo_txt = $(`<i class="combo">C-C-C-COMBO</i>`);
    return this.wrap(this.buildTime());
  }

  afterRender() {
    (this.combo as JQuery).append(
      this.combo_count as JQuery,
      ' ',
      this.combo_x as JQuery,
      ' ',
      this.combo_hits as JQuery,
      ' ',
      this.combo_txt as JQuery
    );
    (this.ui as HTMLDivElement).append(
      (this.text as JQuery).get(0) as HTMLElement,
      (this.combo as JQuery).get(0) as HTMLElement
    );
  }

  incEmoteCount() {
    this.emotecount += 1;
    ChatEmoteMessageCountThrottle(this);
  }

  completeCombo() {
    ChatEmoteMessageCount(this);
    (this.combo as JQuery).attr(
      'class',
      `${(this.combo as JQuery).attr('class')} combo-complete`
    );
    this.combo = null;
    this.combo_count = null;
    this.combo_x = null;
    this.combo_hits = null;
    this.combo_txt = null;
  }
}
