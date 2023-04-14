import Chat from '../chat';
import ChatStore from '../store';
import ChatUser from '../user';
import ChatWindow from '../window';
import ChatUserMessage from './ChatUserMessage';
import MessageTypes from './MessageTypes';

export function checkIfPinWasDismissed(uuid: string) {
  return ChatStore.read('chat.pinnedmessage')?.[uuid];
}

function dismissPin(uuid: string) {
  const pinnedMessageStored = ChatStore.read('chat.pinnedmessage') ?? {};
  pinnedMessageStored[uuid] = true;
  ChatStore.write('chat.pinnedmessage', pinnedMessageStored);
}

export default class PinnedMessage extends ChatUserMessage {
  uuid: string;

  constructor(
    message: string,
    user: ChatUser,
    timestamp: number | null,
    uuid: string
  ) {
    super(message, user, timestamp);
    this.uuid = uuid;
    this.type = MessageTypes.PINNED;
  }

  set visible(state: boolean) {
    (this.ui as HTMLDivElement).classList.toggle('hidden', !state);
    document
      .getElementById('chat-pinned-show-btn')
      ?.classList.toggle('active', !state);
  }

  unpin() {
    dismissPin(this.uuid);

    const frame = document.getElementById(
      'chat-pinned-frame'
    ) as HTMLDivElement;
    frame.classList.toggle('active', false);
    frame.replaceChildren();

    return null;
  }

  pin(chat: Chat, visibility = true) {
    if (!this.ui || !chat) return this;

    this.ui.id = 'msg-pinned';
    this.ui.classList.toggle('msg-pinned', true);
    this.visible = visibility;
    (
      this.ui.querySelector('span.features') as HTMLSpanElement
    ).classList.toggle('hidden', true);
    (chat.mainwindow as ChatWindow).update();

    if (chat.user.hasModPowers()) {
      const unpinMessage = document.createElement('a');
      const unpinMessageIcon = document.createElement('i');
      unpinMessageIcon.classList.add('btn-icon');
      unpinMessage.append(unpinMessageIcon);

      unpinMessage.id = 'unpin-btn';
      unpinMessage.classList.add('chat-tool-btn');
      unpinMessage.title = 'Unpin Message';

      unpinMessage.addEventListener('click', () => {
        chat.cmdUNPIN();
      });

      this.ui.prepend(unpinMessage);
    }

    const showPin = document.createElement('div');
    const showPinIcon = document.createElement('i');
    showPinIcon.classList.add('btn-icon');
    showPin.append(showPinIcon);

    showPin.id = 'chat-pinned-show-btn';
    showPin.classList.toggle('active', !visibility);
    showPin.title = 'Show Pinned Message';

    showPin.addEventListener('click', () => {
      this.visible = true;
    });

    const closePin = document.createElement('a');
    const closePinIcon = document.createElement('i');
    closePinIcon.classList.add('btn-icon');
    closePin.append(closePinIcon);

    closePin.id = 'close-pin-btn';
    closePin.classList.add('chat-tool-btn');
    closePin.title = 'Close Pinned Message';

    closePin.addEventListener('click', () => {
      dismissPin(this.uuid);
      this.visible = false;
    });

    this.ui.prepend(closePin);

    const pinnedFrame = document.getElementById(
      'chat-pinned-frame'
    ) as HTMLDivElement;
    pinnedFrame.classList.toggle('active', true);
    pinnedFrame.prepend(this.ui);
    pinnedFrame.prepend(showPin);

    return this;
  }
}
