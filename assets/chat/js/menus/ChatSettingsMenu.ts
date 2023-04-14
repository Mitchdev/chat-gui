import $ from 'jquery';
import 'whatwg-fetch';
import ChatMenu from './ChatMenu';
import { isKeyCode, KEYCODES } from '../const';
import { Notification } from '../notification';
import Chat from '../chat';

export default class ChatSettingsMenu extends ChatMenu {
  notificationEl: JQuery;

  constructor(ui: JQuery, btn: JQuery, chat: Chat) {
    super(ui, btn, chat);
    this.notificationEl = this.ui.find(
      '#chat-settings-notification-permissions'
    );
    this.ui.on('change', 'input[type="checkbox"],select', (e) =>
      this.onSettingsChange(e)
    );
    this.ui.on('keypress blur', 'textarea[name="customhighlight"]', (e) =>
      this.onCustomHighlightChange(e)
    );
  }

  onCustomHighlightChange(e: JQuery.TriggeredEvent) {
    if (e.type === 'focusout' || isKeyCode(e, KEYCODES.ENTER)) {
      const data = ($(e.target).val() as string)
        .split(',')
        .map((s) => s.trim());
      this.chat.settings.set('customhighlight', [...new Set(data)]);
      this.chat.applySettings(false);
      this.chat.commitSettings();
    }
  }

  onSettingsChange(e: JQuery.ChangeEvent) {
    const val = this.getSettingValue(e.target);
    const name = e.target.getAttribute('name');
    if (val !== undefined) {
      switch (name) {
        case 'profilesettings':
          if (!val && this.chat.authenticated)
            fetch(`${this.chat.config.api.base}/api/chat/me/settings`, {
              credentials: 'include',
              method: 'DELETE',
            }).catch();
          break;
        case 'notificationwhisper':
        case 'notificationhighlight':
          if (val)
            this.notificationPermission().then(() => this.updateNotification());
          break;
        default:
          break;
      }
      this.chat.settings.set(name, val);
      this.chat.applySettings(false);
      this.chat.commitSettings();
    }
  }

  show() {
    if (!this.visible) {
      this.ui
        .find('input,select')
        .get()
        .filter((e) => this.chat.settings.has(e.getAttribute('name') as string))
        .forEach((e) =>
          this.setSettingValue(
            e,
            this.chat.settings.get(e.getAttribute('name') as string) as string
          )
        );
      this.ui
        .find('textarea[name="customhighlight"]')
        .val((this.chat.settings.get('customhighlight') as string[]) || '');
      this.updateNotification();
    }
    super.show();
  }

  updateNotification() {
    const perm =
      Notification.permission === 'default'
        ? 'required'
        : Notification.permission;
    this.notificationEl.text(`(Permission ${perm})`);
  }

  notificationPermission() {
    return new Promise((resolve, reject) => {
      switch (Notification.permission) {
        case 'default':
          Notification.requestPermission((permission) => {
            switch (permission) {
              case 'granted':
                resolve(permission);
                break;
              default:
                reject(permission);
            }
          });
          break;
        case 'granted':
          resolve(Notification.permission);
          break;
        case 'denied':
        default:
          reject(Notification.permission);
          break;
      }
    });
  }

  getSettingValue(e: HTMLElement) {
    if (e.getAttribute('type') === 'checkbox') {
      const val = $(e).is(':checked');
      return Boolean(e.hasAttribute('data-opposite') ? !val : val);
    }
    if (
      e.getAttribute('type') === 'text' ||
      e.nodeName.toLocaleLowerCase() === 'select'
    ) {
      return $(e).val();
    }
    return undefined;
  }

  setSettingValue(e: HTMLElement, val: string) {
    if (e.getAttribute('type') === 'checkbox') {
      $(e).prop(
        'checked',
        Boolean(e.hasAttribute('data-opposite') ? !val : val)
      );
    } else if (
      e.getAttribute('type') === 'text' ||
      e.nodeName.toLocaleLowerCase() === 'select'
    ) {
      $(e).val(val);
    }
  }
}
