export default class ChatInputCaret {
  constructor(input) {
    this.input = input;
    this.stored = 0;
  }

  get() {
    let caretOffset = 0;
    if (window.getSelection().rangeCount > 0) {
      const range = window.getSelection().getRangeAt(0);
      const preCaretRange = range.cloneRange();

      preCaretRange.selectNodeContents(this.input.ui[0]);
      preCaretRange.setEnd(range.endContainer, range.endOffset);

      caretOffset = preCaretRange.toString().length;
    }

    this.stored = caretOffset;
    return caretOffset;
  }

  set(startIndex) {
    if (startIndex >= 0) {
      if (this.input.ui[0].childNodes.length > 0) {
        const range = new Range();
        const selection = window.getSelection();

        const parent = this.getNodeIndex(startIndex);

        const { node, offset } = this.getTextNode(
          this.input.ui[0].childNodes[parent.nodeIndex],
          parent.offset
        );

        if (node) {
          range.setStart(node, offset);
          range.collapse(true);

          selection.removeAllRanges();
          selection.addRange(range);

          this.stored = startIndex;
        }
      }
    }
  }

  setEnd() {
    const range = new Range();
    const selection = window.getSelection();

    const lastNode =
      this.input.ui[0].childNodes[this.input.ui[0].childNodes.length - 1];
    const node = this.getTextNode(lastNode);

    range.setStart(node, node.length);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    this.get();
  }

  getNodeIndex(index, nodes = [...this.input.nodes].map((node) => node.value)) {
    let previousLen = 0;
    let len = 0;
    for (let n = 0; n < nodes.length; n++) {
      previousLen = len;
      len += nodes[n].length;
      if (index <= len) {
        return {
          nodeIndex: n,
          offset: index - previousLen,
        };
      }
    }
    return { nodeIndex: 0, offset: 0 };
  }

  getTextNode(node, index = 0) {
    if (!node) return { node: null, offset: index };
    if (node.nodeName === '#text') return { node, offset: index };
    if (node.childNodes.length === 0) return { node: null, offset: index };
    if (node.childNodes.length === 1)
      return this.getTextNode(node.childNodes[0], index);
    if (node.childNodes.length > 1) {
      const { nodeIndex, offset } = this.getNodeIndex(
        index,
        [...node.childNodes].map((n) =>
          n.nodeValue ? n.nodeValue : n.innerText
        )
      );
      return this.getTextNode(node.childNodes[nodeIndex], offset);
    }

    return { node: null, offset: index };
  }

  getParent(node, n = 0) {
    if (n === 5) return null;
    if (node.parentElement.id === this.input.ui[0].id) return node;
    return this.getParent(node.parentElement, n + 1);
  }

  getRawIndex(node, offset, nodeIndex = -1) {
    const childNodes = [...this.input.ui[0].childNodes];
    let index = offset;

    for (
      let i = 0;
      i < (nodeIndex >= 0 ? nodeIndex : childNodes.indexOf(node));
      i++
    ) {
      index += this.getTextNode(childNodes[i]).length;
    }
    return index;
  }

  isAtStart() {
    return this.stored === 0;
  }

  isAtEnd() {
    return this.stored === this.input.value;
  }
}
