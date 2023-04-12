import $ from 'jquery';
import Chat from './chat';
import { KEYCODES, getKeyCode } from './const';
import makeSafeForRegex from './regex';
import { AutoCompleteCriteria, AutoCompleteItem } from './types/AutoComplete';

let suggestTimeoutId: NodeJS.Timeout;
const minWordLength = 1;
const maxResults = 20;

function getBucketId(id: string) {
  return ((id.match(/[\S]/) as string[])[0] || '_').toLowerCase();
}

function sortResults(a: AutoCompleteItem, b: AutoCompleteItem) {
  if (!a || !b) return 0;

  // order emotes second
  if (a.isemote !== b.isemote) return a.isemote && !b.isemote ? -1 : 1;

  // order according to recency third
  if (a.weight !== b.weight) return a.weight > b.weight ? -1 : 1;

  // order lexically fourth
  const lowerA = a.data.toLowerCase();
  const lowerB = b.data.toLowerCase();

  if (lowerA === lowerB) return 0;

  return lowerA > lowerB ? 1 : -1;
}

function buildSearchCriteria(str: string, offset: number) {
  let pre = str.substring(0, offset);
  let post = str.substring(offset);
  let startCaret = pre.lastIndexOf(' ') + 1;
  const endCaret = post.indexOf(' ');
  let useronly = false;

  if (startCaret > 0) pre = pre.substring(startCaret);

  if (endCaret > -1) post = post.substring(0, endCaret);

  // Ignore the first char as part of the search and flag as a user only search
  if (pre.lastIndexOf('@') === 0) {
    startCaret += 1;
    pre = pre.substring(1);
    useronly = true;
  }

  return {
    word: pre + post,
    pre,
    post,
    startCaret,
    useronly,
    orig: str,
  } as AutoCompleteCriteria;
}

class ChatAutoComplete {
  chat: Chat | null;
  ui: JQuery;
  container: JQuery;
  buckets: Map<string, Map<string, AutoCompleteItem>>;
  results: AutoCompleteItem[];
  criteria: AutoCompleteCriteria | null;
  selected: number;
  input: JQuery | null;

  constructor() {
    this.ui = $(`<div id="chat-auto-complete"><ul></ul></div>`);
    this.ui.on('click', 'li', (e) =>
      this.select(parseInt(e.currentTarget.getAttribute('data-index'), 10))
    );
    this.chat = null;
    this.container = $(this.ui[0].firstElementChild as HTMLElement);
    this.buckets = new Map();
    this.results = [];
    this.criteria = null;
    this.selected = -1;
    this.input = null;
  }

  bind(chat: Chat) {
    this.chat = chat;
    this.input = chat.input as JQuery;
    this.ui.insertBefore(this.input);
    let originval = '';
    let shiftdown = false;
    let keypressed = false;

    // The reason why this has a bind method, is that the chat relies autocomplete objecting being around
    // Key down for any key, but we cannot get the charCode from it (like keypress).
    this.input.on('keydown', (e) => {
      originval = (this.input as JQuery).val() as string;
      const keycode = getKeyCode(e);
      if (keycode === KEYCODES.TAB) {
        if (this.results.length > 0)
          this.select(
            this.selected >= this.results.length - 1 ? 0 : this.selected + 1
          );
        e.preventDefault();
        e.stopPropagation();
      } else if (shiftdown !== e.shiftKey && this.criteria !== null) {
        shiftdown = !!e.shiftKey;
        this.search(this.criteria, shiftdown);
      }
    });
    // Key press of characters that actually input into the field
    this.input.on('keypress', (e) => {
      const keycode = getKeyCode(e);
      const char = String.fromCharCode(keycode) || '';
      if (keycode === KEYCODES.ENTER) {
        this.promoteIfSelected();
        this.reset();
      } else if (char.length > 0) {
        this.promoteIfSelected();
        const str = (this.input as JQuery).val() as string;
        const offset =
          ((this.input as JQuery)[0] as HTMLTextAreaElement).selectionStart + 1;
        const pre = str.substring(0, offset);
        const post = str.substring(offset);
        const criteria = buildSearchCriteria(pre + char + post, offset);
        this.search(criteria);
        // If the first result is exact, highlight it.
        if (this.results.length > 0 && this.results[0].data === criteria.word) {
          this.selected = 0;
          this.selectHelper();
          this.updateHelpers();
        }
        keypressed = true;
      }
    });
    // Key up, we handle things like backspace if the keypress never found a char.
    this.input.on('keyup', (e) => {
      const keycode = getKeyCode(e);
      if (keycode !== KEYCODES.TAB && keycode !== KEYCODES.ENTER) {
        const str = (this.input as JQuery).val() as string;
        if (str.trim().length === 0) this.reset();
        // If a key WAS pressed, but keypress event did not fire
        // Check if the value changed between the key down, and key up
        // Keys like `backspace`
        else if (!keypressed && str !== originval) {
          const offset = ((this.input as JQuery)[0] as HTMLTextAreaElement)
            .selectionStart;
          const criteria = buildSearchCriteria(str, offset);
          this.search(criteria);
        } else if (shiftdown !== e.shiftKey && this.criteria !== null) {
          shiftdown = !!e.shiftKey;
          this.search(this.criteria, shiftdown);
        }
      }
      keypressed = false;
      originval = '';
    });
    // Mouse down, if there is no text selection search the word from where the caret is
    this.input.on('mouseup', () => {
      if (
        ((this.input as JQuery)[0] as HTMLTextAreaElement).selectionStart !==
        ((this.input as JQuery)[0] as HTMLTextAreaElement).selectionEnd
      ) {
        this.reset();
        return;
      }
      const needle = (this.input as JQuery).val() as string;
      const offset = ((this.input as JQuery)[0] as HTMLTextAreaElement)
        .selectionStart;
      const criteria = buildSearchCriteria(needle, offset);
      this.search(criteria);
    });
  }

  search(criteria: AutoCompleteCriteria, useronly = false) {
    this.selected = -1;
    this.results = [];
    this.criteria = criteria;
    if (criteria.word.length >= minWordLength) {
      const bucket = this.buckets.get(getBucketId(criteria.word)) || new Map();
      const regex = new RegExp(`^${makeSafeForRegex(criteria.pre)}`, 'i');
      this.results = [...bucket.values()]
        // filter exact matches
        // .filter(a => a.data !== criteria.word)
        // filter users if user search
        .filter(
          (a) =>
            (!a.isemote || !(criteria.useronly || useronly)) &&
            regex.test(a.data)
        )
        .sort(sortResults)
        .slice(0, maxResults);
    }
    this.buildHelpers();
    this.updateHelpers();
    this.timeoutHelpers();
  }

  reset() {
    this.criteria = null;
    this.results = [];
    this.selected = -1;
    this.updateHelpers();
  }

  add(str: string, isemote = false, weight = 1) {
    const id = getBucketId(str);
    const bucket = (this.buckets.get(id) ||
      this.buckets.set(id, new Map()).get(id)) as Map<string, AutoCompleteItem>;
    const data = Object.assign(bucket.get(str) || {}, {
      data: str,
      weight,
      isemote,
    });
    bucket.set(str, data);
    return data;
  }

  remove(str: string, userOnly = false) {
    const bucket = this.buckets.get(getBucketId(str));
    if (bucket && bucket.has(str)) {
      const a = bucket.get(str) as AutoCompleteItem;
      if ((userOnly && !a.isemote) || !userOnly) {
        bucket.delete(str);
      }
    }
  }

  select(index: number) {
    this.selected = Math.min(index, this.results.length - 1);
    const result = this.results[this.selected];
    if (!result) return;

    const pre = (this.criteria as AutoCompleteCriteria).orig.substr(
      0,
      (this.criteria as AutoCompleteCriteria).startCaret
    );
    let post = (this.criteria as AutoCompleteCriteria).orig.substr(
      (this.criteria as AutoCompleteCriteria).startCaret +
        (this.criteria as AutoCompleteCriteria).word.length
    );

    // always add a space after our completion if there isn't one since people
    // would usually add one anyway
    if (post[0] !== ' ' || post.length === 0) post = ` ${post}`;
    (this.input as JQuery).trigger('focus').val(pre + result.data + post);

    // Move the caret to the end of the replacement string + 1 for the space
    const s = pre.length + result.data.length + 1;
    ((this.input as JQuery)[0] as HTMLTextAreaElement).setSelectionRange(s, s);

    // Update selection gui
    this.selectHelper();
    this.updateHelpers();
  }

  promoteIfSelected() {
    if (this.selected >= 0 && this.results[this.selected]) {
      this.results[this.selected].weight = Date.now();
    }
  }

  buildHelpers() {
    if (this.results.length > 0) {
      this.container[0].innerHTML = this.results
        .map((res, k) => `<li data-index="${k}">${res.data}</li>`)
        .join('');
    }
  }

  timeoutHelpers() {
    if (suggestTimeoutId) clearTimeout(suggestTimeoutId);
    suggestTimeoutId = setTimeout(() => this.reset(), 15000, this);
  }

  updateHelpers() {
    ((this.chat as Chat).ui as JQuery).toggleClass(
      'chat-autocomplete-in',
      this.results.length > 0
    );
    this.ui.toggleClass('active', this.results.length > 0);
  }

  selectHelper() {
    // Positioning
    if (this.selected !== -1 && this.results.length > 0) {
      const list = this.ui.find(`li`).get();
      const offset = this.container.position().left;
      const maxwidth = this.ui.width() as number;
      $(list[this.selected + 3]).each((i, e) => {
        const right =
          $(e).position().left + offset + ($(e).outerWidth() as number);
        if (right > maxwidth)
          this.container.css('left', offset + maxwidth - right);
      });
      $(list[Math.max(0, this.selected - 2)]).each((i, e) => {
        const left = $(e).position().left + offset;
        if (left < 0) this.container.css('left', -$(e).position().left);
      });
      list.forEach((e, i) => $(e).toggleClass('active', i === this.selected));
    }
  }
}

export default ChatAutoComplete;
