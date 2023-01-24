import $ from 'jquery';
import { KEYCODES, isKeyCode, getKeyCode } from '../const';
import { BIGSCREENREGEX, LINKREGEX } from '../formatters';
import Caret from './Caret';
import ChatInputSelection from './Selection';
import ChatInputInstanceHistory from './ChatInputInstanceHistory';
import {
  ChatInputEmoteNode,
  ChatInputTextNode,
  ChatInputUserNode,
  ChatInputLinkNode,
} from './nodes';

export default class ChatInput {
  constructor(chat) {
    this.chat = chat;
    this.ui = this.chat.ui.find('#chat-input-control');
    this.bgText = this.ui.attr('placeholder');

    this.urlregex = new RegExp(LINKREGEX, 'i');
    this.embedregex = new RegExp(BIGSCREENREGEX);

    this.caret = new Caret(this.ui);
    this.selection = new ChatInputSelection(this);
    this.history = new ChatInputInstanceHistory();

    this.nodes = [];

    this.oldInputValue = '';
    this.inputValue = '';

    this.ui.on('mouseup', () => {
      this.selection.update();
    });

    this.ui.on('keypress', (e) => {
      if (!isKeyCode(e, KEYCODES.ENTER) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const keycode = getKeyCode(e);
        const char = String.fromCharCode(keycode) || '';
        if (char.length > 0) {
          this.modify(0, char);
        }
      }
    });

    this.ui.on('keydown', (e) => {
      if (isKeyCode(e, KEYCODES.TAB)) e.preventDefault();
      if (isKeyCode(e, KEYCODES.BACKSPACE)) {
        e.preventDefault();
        if (window.getSelection().toString().length > 0) {
          this.selection.remove();
          this.render();
        } else {
          this.modify(-1);
        }
      }

      // const left = isKeyCode(e, KEYCODES.LEFT);
      // const right = isKeyCode(e, KEYCODES.RIGHT);
      // if (left || right) {
      //   e.preventDefault();
      //   const caret = this.caret.get();
      //   if ((left && caret > 0) || (right && caret < this.value.length)) {
      //     if (e.shiftKey) {
      //       let { start, end } = this.caret.getSelectionRange(true);
      //       if (start === end || this.selectBase === -1) {
      //         if (left) {
      //           this.selectBase = start;
      //           start -= 1;
      //         }
      //         if (right) {
      //           this.selectBase = end;
      //           end += 1;
      //         }
      //       } else if (this.selectBase === start) {
      //         if (left) end -= 1;
      //         if (right) end += 1;
      //       } else if (this.selectBase === end) {
      //         if (left) start -= 1;
      //         if (right) start += 1;
      //       }
      //       if (start < 0) start = 0;
      //       if (end > this.value.length) end = this.value.length;
      //       this.caret.setSelectionRange(start, end, this.oldnodes);
      //     } else {
      //       this.selectBase = -1;
      //       const { nodeIndex } = this.caret.getNodeIndex(
      //         caret + (left ? -1 : 1),
      //         this.oldnodes
      //       );
      //       if (this.oldnodes[nodeIndex].type === 'emote') {
      //         const len = this.oldnodes[nodeIndex].value.length + 1;
      //         this.caret.set(caret + (left ? -len : len), this.oldnodes);
      //       } else {
      //         this.caret.set(caret + (left ? -1 : 1), this.oldnodes);
      //       }
      //     }
      //   }
      // }

      // if (e.ctrlKey && isKeyCode(e, 90)) {
      //   if (this.history.undo()) {
      //     this.loadInstance();
      //   }
      // }
      // if (e.ctrlKey && isKeyCode(e, 89)) {
      //   if (this.history.redo()) {
      //     this.loadInstance();
      //   }
      // }
    });

    this.ui.on('keyup', (e) => {
      if (
        (e.ctrlKey && isKeyCode(e, 65)) || // CTRL + A
        isKeyCode(e, KEYCODES.LEFT) ||
        isKeyCode(e, KEYCODES.RIGHT) ||
        isKeyCode(e, KEYCODES.UP) ||
        isKeyCode(e, KEYCODES.DOWN)
      ) {
        this.selection.update();
      }
      // if (
      //   !(e.ctrlKey && isKeyCode(e, 90)) &&
      //   !(e.ctrlKey && isKeyCode(e, 89))
      // ) {
      //   this.history.post(this.value, this.caret.stored, window.getSelection());
      // }
    });

    // this.ui.on('cut', (e) => {
    //   e.preventDefault();
    //   if (window.getSelection().toString().length > 0) {
    //     navigator.clipboard.writeText(window.getSelection().toString());
    //     this.add();
    //     this.render();
    //   }
    // });

    // this.ui.on('paste', (e) => {
    //   e.preventDefault();
    //   const paste = e.originalEvent.clipboardData.getData('text/plain');
    //   if (paste.length > 0) {
    //     this.add(0, paste);
    //     this.render();
    //   }
    // });

    this.render();
  }

  loadInstance() {
    // const data = this.history.get();
    // this.previousValueLength = this.value.length;
    // this.value = data.value;
    // this.render();
    // this.caret.set(data.caret, this.oldnodes);
    // const range = new Range();
    // const selection = window.getSelection();
    // range.setStart(data.selection.start.node, data.selection.start.offset);
    // range.setEnd(data.selection.end.node, data.selection.end.offset);
    // selection.removeAllRanges();
    // selection.addRange(range);
  }

  modify(modifier = 0, value = '') {
    const caret = this.caret.get();
    if (this.nodes.length === 0) {
      const element = $('<span>').appendTo(this.ui);
      this.nodes = [new ChatInputTextNode(this, element, '')];
    }
    const { nodeIndex, offset } = this.getCurrentNode();
    if (value === ' ' && this.nodes[nodeIndex].type !== 'text') {
      const element = $('<span>').insertAfter(this.nodes[nodeIndex].element);
      this.nodes.splice(
        nodeIndex + 1,
        0,
        new ChatInputTextNode(this, element, ' ')
      );
    } else {
      this.nodes[nodeIndex].modify(offset, modifier, value);
    }

    if (window.getSelection().toString().length === 0) {
      this.value =
        this.value.substring(0, caret + modifier) +
        value +
        this.value.substring(caret);
    } else {
      this.value =
        this.value.substring(
          0,
          caret - window.getSelection().toString().length
        ) +
        value +
        this.value.substring(caret);
    }
    this.checkCurrentWord();
  }

  checkValid(caret) {
    const { nodeIndex } = this.getCurrentNode(caret - 1);
    if (this.nodes[nodeIndex].type === 'text') return;

    const valid = this.nodes[nodeIndex].isValid();
    if (!valid) {
      const { value } = this.nodes[nodeIndex];
      if (nodeIndex === 0 || this.nodes[nodeIndex - 1].type !== 'text') {
        const element = $('<span>').insertBefore(this.nodes[nodeIndex].element);
        this.nodes.splice(
          nodeIndex,
          0,
          new ChatInputTextNode(this, element, value)
        );
        this.nodes[nodeIndex + 1].value = '';
      } else {
        this.nodes[nodeIndex - 1].modify(
          this.nodes[nodeIndex - 1].value.length,
          0,
          value
        );
        this.nodes[nodeIndex].value = '';
      }
    }
  }

  checkCurrentWord() {
    const { nodeIndex } = this.getCurrentNode();
    const word = this.getCurrentWord();

    if (!word || word === ' ' || this.nodes[nodeIndex].type !== 'text') {
      this.render();
      return;
    }

    const emote = this.chat.emoteService.getEmote(word, false);
    if (emote) {
      const element = $('<span>').insertAfter(this.nodes[nodeIndex].element);
      this.insertNode(new ChatInputEmoteNode(this, element, emote.prefix));
      this.render();
      return;
    }

    const username = word.startsWith('@')
      ? word.substring(1).toLowerCase()
      : word.toLowerCase();
    const user = this.chat.users.get(username);
    if (user) {
      const element = $('<span>').insertAfter(this.nodes[nodeIndex].element);
      this.insertNode(new ChatInputUserNode(this, element, word));
      this.render();
      return;
    }

    const embed = this.embedregex.test(word);
    const url = this.urlregex.test(word);
    if (embed || url) {
      const element = $('<span>').insertAfter(this.nodes[nodeIndex].element);
      this.insertNode(new ChatInputLinkNode(this, element, word));
      this.render();
      return;
    }

    this.render();
  }

  joinTextNodes(index) {
    if (index <= 0) return;
    const left = this.nodes[index - 1];
    const right = this.nodes[index];
    if (left.type === 'text' && right.type === 'text') {
      this.nodes[index - 1].modify(
        this.nodes[index - 1].value.length,
        0,
        right.value
      );

      this.nodes[index].element.remove();
      this.nodes.splice(index, 1);
    }
    this.joinTextNodes(index - 1);
  }

  insertNode(node) {
    const { nodeIndex, offset } = this.getCurrentNode();
    const split = this.nodes[nodeIndex].removeAndSplit(offset);
    if (split !== '') {
      const element = $('<span>').insertAfter(node.element);
      this.nodes.splice(
        nodeIndex + 1,
        0,
        new ChatInputTextNode(this, element, split)
      );
    }
    this.nodes.splice(nodeIndex + 1, 0, node);
  }

  // TODO: implement format over whole input.
  val(value = null) {
    if (!value) return this.value;

    this.value = value;
    this.ui.empty();
    this.nodes = [];

    // if (value !== '') {
    //   const words = [...this.value.split(' ')]
    //     .filter((v) => v !== '')
    //     .forEach((word) => {
    //       console.log(word);
    //     });
    // }

    // this.render();
    return this;
  }

  get value() {
    return this.inputValue;
  }

  set value(val) {
    this.oldInputValue = this.inputValue;
    this.inputValue = val;
  }

  get placeholder() {
    return this.bgText;
  }

  set placeholder(placeholder) {
    this.bgText = placeholder;
    this.ui.attr('placeholder', this.bgText);
  }

  render(prevCaret = this.caret.get()) {
    if (this.nodes.length > 0) {
      this.checkValid(prevCaret);

      for (let index = this.nodes.length - 1; index >= 0; index--) {
        if (this.nodes[index].value === '') {
          this.nodes[index].element.remove();
          this.nodes.splice(index, 1);
        }
      }
      this.joinTextNodes(this.nodes.length - 1);

      this.ui.toggleClass(
        'green',
        this.value.startsWith('>') || this.value.startsWith('/me >')
      );
      this.ui.toggleClass('italic', this.value.startsWith('/me '));

      [...this.nodes].forEach((node) => node.render());
    }

    this.ui.attr('data-input', this.value);
    const difference = this.value.length - this.oldInputValue.length;
    this.caret.set(prevCaret + difference, this.nodes);
    this.chat.adjustInputHeight();
  }

  getCurrentNode(caret = this.caret.get()) {
    return this.caret.getNodeIndex(
      caret,
      [...this.nodes].map((node) => node.value)
    );
  }

  getCurrentWord() {
    if (this.nodes.length === 0) return '';
    const { nodeIndex, offset } = this.getCurrentNode();

    return this.nodes[nodeIndex].getWord(offset);
  }

  focus() {
    this.ui.focus();
    this.caret.set(this.caret.stored, this.nodes);
    return this;
  }

  // passthrough functions.
  on(...args) {
    return this.ui.on(...args);
  }

  css(...args) {
    return this.ui.css(...args);
  }

  prop(...args) {
    return this.ui.prop(...args);
  }

  is(...args) {
    return this.ui.is(...args);
  }
}