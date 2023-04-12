declare global {
  interface Window {
    MozWebSocket: unknown;
    showLoginModal: () => void | undefined;
  }
}

export {};
