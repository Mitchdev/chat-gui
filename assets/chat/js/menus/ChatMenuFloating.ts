import Chat from '../chat';
import ChatMenu from './ChatMenu';

export default class ChatMenuFloating extends ChatMenu {
  draggable: JQuery | null;

  mousedown: boolean;
  x1: number;
  x2: number;
  y1: number;
  y2: number;

  constructor(
    ui: JQuery,
    btn: JQuery,
    chat: Chat,
    draggable: JQuery | null = null
  ) {
    super(ui, btn, chat);

    this.draggable = draggable;
    this.mousedown = false;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;

    if (this.draggable?.length) {
      this.draggable[0].style.cursor = 'grab';
      this.draggable.on('mouseup', (e) => {
        e.preventDefault();
        this.mousedown = false;
      });
      this.draggable.on('mousedown', (e) => {
        e.preventDefault();
        this.mousedown = true;
        this.x1 = e.clientX;
        this.y1 = e.clientY;
      });
      (this.chat.output as JQuery).on('mousemove', (e) => {
        this.drag(e);
      });
      this.ui.on('mousemove', (e) => {
        this.drag(e);
      });
    }
  }

  drag(e: JQuery.MouseMoveEvent) {
    if (this.mousedown) {
      this.x2 = this.x1 - e.clientX;
      this.y2 = this.y1 - e.clientY;
      this.x1 = e.clientX;
      this.y1 = e.clientY;

      (this.draggable as JQuery)[0].style.cursor = 'grabbing';
      this.ui[0].style.left = `${this.ui[0].offsetLeft - this.x2}px`;
      this.ui[0].style.top = `${this.ui[0].offsetTop - this.y2}px`;
    } else {
      (this.draggable as JQuery)[0].style.cursor = 'grab';
    }
  }

  position(e: JQuery.ContextMenuEvent) {
    this.mousedown = false;
    const rect = (this.chat.output as JQuery)[0].getBoundingClientRect();
    // calculating floating window location (if it doesn't fit on screen, adjusting it a bit so it does)
    const x =
      (this.ui.width() as number) + e.clientX > rect.width
        ? e.clientX -
          rect.left +
          (rect.width - ((this.ui.width() as number) + e.clientX))
        : e.clientX - rect.left;
    const y =
      (this.ui.height() as number) + e.clientY > rect.height
        ? e.clientY -
          rect.top +
          (rect.height - ((this.ui.height() as number) + e.clientY)) -
          12
        : e.clientY - rect.top - 12;

    this.ui[0].style.left = `${x}px`;
    this.ui[0].style.top = `${y}px`;
  }
}
