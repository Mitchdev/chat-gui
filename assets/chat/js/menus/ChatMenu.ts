import ChatScrollPlugin from '../scroll';
import EventEmitter from '../emitter';
import Chat from '../chat';

export default class ChatMenu extends EventEmitter {
  ui: JQuery;
  btn: JQuery;
  chat: Chat;

  visible: boolean;
  shown: boolean;

  scrollplugin!: ChatScrollPlugin;

  constructor(ui: JQuery, btn: JQuery, chat: Chat) {
    super();
    this.ui = ui;
    this.btn = btn;
    this.chat = chat;
    this.visible = false;
    this.shown = false;
    this.ui.find('.scrollable').each((_, e) => {
      this.scrollplugin = new ChatScrollPlugin(
        e.querySelector('.content') as HTMLDivElement,
        e as HTMLDivElement
      );
    });
    this.ui.on('click', '.close,.chat-menu-close', this.hide.bind(this));
    this.btn.on('click', () => {
      if (this.visible) (chat.input as JQuery).trigger('focus');
      this.toggle();
      return false;
    });
  }

  show() {
    if (!this.visible) {
      this.visible = true;
      this.shown = true;
      this.btn.addClass('active');
      this.ui.addClass('active');
      this.redraw();
      this.emit('show');
    }
  }

  hide() {
    if (this.visible) {
      this.visible = false;
      this.btn.removeClass('active');
      this.ui.removeClass('active');
      this.emit('hide');
    }
  }

  toggle() {
    const wasVisible = this.visible;
    ChatMenu.closeMenus(this.chat);
    if (!wasVisible) this.show();
  }

  redraw() {
    if (this.visible && this.scrollplugin) this.scrollplugin.reset();
  }

  static closeMenus(chat: Chat) {
    chat.menus.forEach((m) => m.hide());
  }
}
