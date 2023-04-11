import $ from 'jquery';
import { debounce } from 'throttle-debounce';
// eslint-disable-next-line import/no-unresolved
import 'overlayscrollbars/overlayscrollbars.css';
import { OverlayScrollbars } from 'overlayscrollbars';

const isTouchDevice =
  'ontouchstart' in window || // works on most browsers
  navigator.maxTouchPoints; // works on IE10/11 and Surface

class ChatScrollPlugin {
  viewport: HTMLDivElement | null;
  target: JQuery;
  scroller: OverlayScrollbars;
  wasPinned: boolean;
  resizeObserver: ResizeObserver | null;

  constructor(viewport: HTMLDivElement, target: HTMLDivElement | null = null) {
    this.resizeObserver = null;
    this.viewport = $(viewport).get(0) as HTMLDivElement | null;

    if (target == null) {
      this.target = $(viewport);
    } else {
      this.target = $(target);
    }

    this.scroller = OverlayScrollbars(
      {
        target: this.target.get(0) as HTMLDivElement,
        elements: {
          viewport: this.viewport,
        },
      },
      {
        overflow: {
          x: 'hidden',
          y: 'scroll',
        },
        scrollbars: {
          theme: 'dgg-scroller-theme',
          autoHide: isTouchDevice ? 'never' : 'move',
          autoHideDelay: 1000,
        },
      }
    );

    this.wasPinned = true;
    if (this.target.find('.chat-scroll-notify').length > 0) {
      this.setupResize();

      this.scroller.on('scroll', () => {
        this.wasPinned = this.pinned;
        this.target.toggleClass('chat-unpinned', !this.wasPinned);
      });

      this.target.on('click', '.chat-scroll-notify', () => {
        this.scrollBottom();
        return false;
      });
    }
  }

  setupResize() {
    let resizing = false;
    let pinnedBeforeResize = this.wasPinned;
    const onResizeComplete = debounce(
      100,
      () => {
        resizing = false;
        this.update(pinnedBeforeResize);
      },
      { atBegin: false }
    );
    this.resizeObserver = new ResizeObserver(() => {
      if (!resizing) {
        resizing = true;
        pinnedBeforeResize = this.pinned;
      }
      onResizeComplete();
    });
    if (this.viewport) {
      this.resizeObserver.observe(this.viewport);
    }
  }

  get pinned() {
    // 30 is used to allow the scrollbar to be just offset, but still count as scrolled to bottom
    if (this.viewport) {
      const { scrollTop, scrollHeight, clientHeight } = this.viewport;
      return scrollTop >= scrollHeight - clientHeight - 30;
    }
    return true;
  }

  scrollBottom() {
    if (this.viewport) {
      this.viewport.scrollTo(0, this.viewport.scrollHeight);
    }
  }

  update(forcePin: boolean) {
    if (this.wasPinned || forcePin) this.scrollBottom();
  }

  reset() {
    this.scroller.update();
  }

  destroy() {
    this.scroller.destroy();
  }
}

export default ChatScrollPlugin;
