class EventEmitter {
  listeners: Map<string, CallableFunction[]>;

  constructor() {
    this.listeners = new Map();
  }

  on(name: string, fn: (data: unknown) => void) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }
    (this.listeners.get(name) as CallableFunction[]).push(fn);
    return this;
  }

  emit(name: string, ...args: unknown[]) {
    const listeners = this.listeners.get(name);
    if (listeners && listeners.length) {
      listeners.forEach((listener) => listener(...args));
      return true;
    }
    return false;
  }
}

export default EventEmitter;
