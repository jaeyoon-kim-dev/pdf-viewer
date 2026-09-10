import type { Rect } from './model';
export type ReaderAnchor = {
  getBoundingClientRect: () => DOMRect;
  contextElement?: Element;
};
export function elementAnchor(element: Element): ReaderAnchor {
  return {
    getBoundingClientRect: () => element.getBoundingClientRect(),
    contextElement: element,
  };
}
export function rectAnchor(element: Element, rect: Rect): ReaderAnchor {
  return {
    contextElement: element,
    getBoundingClientRect: () => {
      const box = element.getBoundingClientRect();
      return new DOMRect(
        box.x + rect.x * box.width,
        box.y + rect.y * box.height,
        rect.w * box.width,
        rect.h * box.height,
      );
    },
  };
}
