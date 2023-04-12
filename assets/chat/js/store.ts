/* eslint-disable @typescript-eslint/no-empty-function */
const localStorage = window.localStorage || {
  setItem: () => {},
  getItem: () => {},
};
const { JSON } = window;

class ChatStore {
  static write(name: string, obj: unknown) {
    let str = '';
    try {
      str = JSON.stringify(
        obj instanceof Map || obj instanceof Set ? [...obj] : obj
      );
    } catch {} // eslint-disable-line no-empty
    localStorage.setItem(name, str);
  }

  static read(name: string) {
    let data = null;
    try {
      const item = localStorage.getItem(name);
      if (item) data = JSON.parse(item);
    } catch {} // eslint-disable-line no-empty
    return data;
  }

  static remove(name: string) {
    try {
      localStorage.removeItem(name);
    } catch {} // eslint-disable-line no-empty
  }
}

export default ChatStore;
