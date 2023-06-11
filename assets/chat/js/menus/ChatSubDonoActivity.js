import { MessageBuilder } from '../messages';
import ChatUser from '../user';
import ChatMenu from './ChatMenu';

export default class ChatSubDonoActivity extends ChatMenu {
  constructor(ui, btn, chat) {
    super(ui, btn, chat);

    this.activity = this.ui.find('.content');

    this.activity.on('click', '.user', (e) =>
      this.chat.userfocus.toggleFocus(e.currentTarget.innerText)
    );

    this.chat.source.on('SUBSCRIPTION', (data) => this.addSub(data));
    this.chat.source.on('GIFTSUB', (data) => this.addGiftedSub(data));
    this.chat.source.on('MASSGIFT', (data) => this.addMassGiftedSub(data));
    this.chat.source.on('DONATION', (data) => this.addDonation(data));

    // TODO:
    // Limit size of list
    // Join MassGift
    // FIX:
    // Overlays whisper number
  }

  addSub(data) {
    const user =
      this.chat.users.get(data.nick.toLowerCase()) ?? new ChatUser(data.nick);
    const html = MessageBuilder.subscription(
      data.data,
      user,
      data.tier,
      data.tierlabel,
      data.streak,
      data.timestamp
    ).html(this.chat);
    this.activity.prepend(html);
  }

  addGiftedSub(data) {
    const user =
      this.chat.users.get(data.nick.toLowerCase()) ?? new ChatUser(data.nick);
    const html = MessageBuilder.gift(
      data.data,
      user,
      data.tier,
      data.tierlabel,
      data.giftee,
      data.timestamp
    ).html(this.chat);
    this.activity.prepend(html);
  }

  addMassGiftedSub(data) {
    const user =
      this.chat.users.get(data.nick.toLowerCase()) ?? new ChatUser(data.nick);
    const html = MessageBuilder.massgift(
      data.data,
      user,
      data.tier,
      data.tierlabel,
      data.quantity,
      data.timestamp
    ).html(this.chat);
    this.activity.prepend(html);
  }

  addDonation(data) {
    const user =
      this.chat.users.get(data.nick.toLowerCase()) ?? new ChatUser(data.nick);
    const html = MessageBuilder.donation(
      data.data,
      user,
      data.amount,
      data.timestamp
    ).html(this.chat);
    this.activity.prepend(html);
  }
}
