import $ from 'jquery';
import Chat from '../chat';
import ChatMenuFloating from './ChatMenuFloating';

export default class ChatEmoteTooltip extends ChatMenuFloating {
  emoteImage: JQuery;
  emoteName: JQuery;
  emoteCreator: JQuery;
  emoteTier: JQuery;

  constructor(ui: JQuery, btn: JQuery, chat: Chat) {
    super(ui, btn, chat);

    this.emoteImage = this.ui.find('.emote-image');
    this.emoteName = this.ui.find('.emote-info .name');
    this.emoteCreator = this.ui.find('.emote-info .creator');
    this.emoteTier = this.ui.find('.emote-info .tier');

    (this.chat.output as JQuery).on(
      'contextmenu',
      '.msg-chat .text .emote',
      (e) => {
        const emote = $(e.currentTarget).closest('.emote')[0].innerText;
        const { creator, minimumSubTier } =
          this.chat.emoteService.getEmote(emote) ?? {};

        this.emote = emote;
        this.creator = creator as string;
        this.tier = minimumSubTier as number;

        this.position(e);
        this.show();
        return false;
      }
    );

    this.emoteImage.on('click', '.emote', (e) => {
      const value = ((this.chat.input as JQuery).val() as string).trim();
      (this.chat.input as JQuery)
        .val(
          `${value + (value === '' ? '' : ' ') + e.currentTarget.innerText} `
        )
        .trigger('focus');
    });
  }

  set emote(emote: string) {
    this.emoteName.text(emote);
    this.emoteImage.html(`<div class="emote ${emote}">${emote}</div>`);
  }

  set creator(creator: string) {
    this.emoteCreator.text(creator);
    this.emoteCreator[creator ? 'show' : 'hide']();
  }

  set tier(minimumSubTier: number) {
    this.emoteTier.text(`Tier ${minimumSubTier}`);
    this.emoteTier[minimumSubTier > 0 ? 'show' : 'hide']();
  }
}
