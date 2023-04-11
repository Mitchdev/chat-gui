import $ from 'jquery';
import { throttle } from 'throttle-debounce';
import ChatScrollPlugin from './scroll';
import EventEmitter from './emitter';
import Chat from './chat';
import { ChatUIMessage } from './messages';

const tagcolors = [
  'green',
  'yellow',
  'orange',
  'purple',
  'blue',
  'sky',
  'lime',
  'pink',
];

class ChatWindow extends EventEmitter {
  name: string;
  label: string;
  maxlines: number;
  linecount: number;
  locks: number;
  scrollplugin: ChatScrollPlugin | null;
  visible: boolean;
  tag: string | null;
  lastmessage: ChatUIMessage | null;
  ui: JQuery;
  lines: HTMLDivElement;

  constructor(name: string, type = '', label = '') {
    super();
    this.name = name;
    this.label = label;
    this.maxlines = 0;
    this.linecount = 0;
    this.locks = 0;
    this.scrollplugin = null;
    this.visible = false;
    this.tag = null;
    this.lastmessage = null;
    this.ui = $(
      `<div id="chat-win-${name}" class="chat-output ${type}" style="display: none;">` +
        `<div class="chat-lines"></div>` +
        `<div class="chat-scroll-notify">More messages below</div>` +
        `</div>`
    );
    this.lines = (this.ui.get(0) as HTMLDivElement).querySelector(
      '.chat-lines'
    ) as HTMLDivElement;
  }

  destroy() {
    this.ui.remove();
    if (this.scrollplugin) {
      this.scrollplugin.destroy();
    }
    return this;
  }

  into(chat: Chat) {
    const normalized = this.name.toLowerCase();
    this.maxlines = chat.settings.get('maxlines') as number;
    this.scrollplugin = new ChatScrollPlugin(
      this.lines,
      this.lines.parentElement as HTMLDivElement
    );
    this.tag =
      chat.taggednicks.get(normalized) ||
      tagcolors[Math.floor(Math.random() * tagcolors.length)];
    if (chat.output) {
      chat.output.append(this.ui);
    }
    chat.addWindow(normalized, this);
    return this;
  }

  show() {
    if (!this.visible) {
      this.visible = true;
      this.emit('show');
      this.ui.show();
    }
  }

  hide() {
    if (this.visible) {
      this.visible = false;
      this.emit('hide');
      this.ui.hide();
    }
  }

  addMessage(chat: Chat, message: ChatUIMessage) {
    message.ui = message.html(chat) as HTMLDivElement;
    message.afterRender(chat);
    this.lastmessage = message;
    this.lines.append(message.ui);
    this.linecount += 1;
    this.cleanupThrottle();
  }

  getlines(sel: string) {
    return this.lines.querySelectorAll(sel);
  }

  removelines(sel: string) {
    const remove = this.lines.querySelectorAll(sel);
    this.linecount -= remove.length;
    remove.forEach((element) => {
      element.remove();
    });
  }

  update(forcePin = false) {
    if (this.scrollplugin) {
      this.scrollplugin.update(forcePin);
    }
  }

  // Rid excess chat lines if the chat is pinned
  // Get the scroll position before adding the new line / removing old lines
  cleanup() {
    if (this.scrollplugin && this.scrollplugin.wasPinned) {
      const lines = [...this.lines.children];
      if (lines.length >= this.maxlines) {
        const remove = lines.slice(0, lines.length - this.maxlines);
        this.linecount -= remove.length;
        remove.forEach((element) => {
          element.remove();
        });
      }
    }
  }

  cleanupThrottle = throttle(50, this.cleanup);
}

export default ChatWindow;
