import { debounce } from 'throttle-debounce';
import Chat from '../chat';
import ChatMenu from './ChatMenu';

export default class ChatEmoteMenu extends ChatMenu {
  searchterm: string;
  emoteMenuContent: JQuery;
  searchinput: JQuery;

  constructor(ui: JQuery, btn: JQuery, chat: Chat) {
    super(ui, btn, chat);
    this.searchterm = '';
    this.emoteMenuContent = this.ui.find('.content');
    this.searchinput = this.ui.find(
      '#chat-emote-list-search .form-control:first'
    );
    this.ui.on('click', '.emote', (e) => {
      if (!e.currentTarget.classList.contains('disabled')) {
        ChatMenu.closeMenus(chat);
        this.selectEmote(e.currentTarget.innerText);
      }
    });
    this.searchinput.on(
      'keyup',
      debounce(
        100,
        () => {
          this.searchterm = this.searchinput.val() as string;
          this.buildEmoteMenu();
        },
        { atBegin: false }
      )
    );
  }

  show() {
    super.show();
    this.searchinput.trigger('focus');
    this.buildEmoteMenu();
  }

  buildEmoteMenu() {
    this.emoteMenuContent.empty();

    this.chat.emoteService.tiers.forEach((tier) => {
      const emotes = this.chat.emoteService.emotePrefixesForTier(tier);
      if (!emotes.length) return;

      const title = tier === 0 ? 'All Users' : `Tier ${tier} Subscribers`;
      const locked =
        tier > this.chat.user.subTier && !this.chat.user.isPrivileged();
      this.emoteMenuContent.append(
        this.buildEmoteMenuSection(title, emotes, locked)
      );
    });

    const twitchEmotes = this.chat.emoteService.twitchEmotePrefixes;
    if (twitchEmotes.length) {
      this.emoteMenuContent.append(
        this.buildEmoteMenuSection('Twitch Subscribers', twitchEmotes)
      );
    }
  }

  buildEmoteMenuSection(title: string, emotes: string[], disabled = false) {
    const emotesStr = emotes
      .map((e) => this.buildEmoteItem(e, disabled))
      .join('');
    if (emotesStr !== '') {
      return `<div>
              <div id="emote-subscribe-note">${
                disabled ? '<i class="lock"></i>' : ''
              }${title}</div>
              <div class="emote-group${
                disabled ? ' disabled' : ''
              }">${emotesStr}</div>
          </div>`;
    }
    return '';
  }

  buildEmoteItem(emote: string, disabled: boolean) {
    if (this.searchterm && this.searchterm.length > 0) {
      if (emote.toLowerCase().indexOf(this.searchterm.toLowerCase()) >= 0) {
        return `<div class="emote-item"><span title="${emote}" class="emote ${emote}${
          disabled ? ' disabled' : ''
        }">${emote}</span></div>`;
      }
      return '';
    }
    return `<div class="emote-item"><span title="${emote}" class="emote ${emote}${
      disabled ? ' disabled' : ''
    }">${emote}</span></div>`;
  }

  selectEmote(emote: string) {
    const value = ((this.chat.input as JQuery).val() as string).trim();
    (this.chat.input as JQuery)
      .val(`${value + (value === '' ? '' : ' ') + emote} `)
      .trigger('focus');
  }
}
