/**
 * Caret geometry for composer-anchored pickers (FE §60).
 *
 * The mention picker must track the caret, stay within the viewport, avoid
 * covering the composer where possible, and reposition on resize. This
 * module owns the math in two halves:
 *
 *   1. getCaretLineBox(textarea, position) — mirror-div measurement of the
 *      caret's line box in VIEWPORT coordinates (accounts for the
 *      textarea's own scroll).
 *   2. computePickerPosition(caretLine, viewport, picker) — placement:
 *      above the caret by default (never covering it), flipping below when
 *      there is no headroom, clamped so the picker never leaves the viewport.
 */

export interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MIRROR_STYLE_PROPERTIES = [
  'boxSizing',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'whiteSpace',
  'wordSpacing',
  'wordBreak',
  'overflowWrap',
] as const;

function parsePx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classic mirror-div caret measurement: clone the textarea's typography into
 * an offscreen div, copy text up to the caret, and read where an inline
 * marker span lands — then translate into viewport space using the
 * textarea's own rect minus its scroll offsets.
 */
export function getCaretLineBox(
  textarea: HTMLTextAreaElement,
  position: number,
): RectBox {
  const computed = window.getComputedStyle(textarea);
  const doc = textarea.ownerDocument;

  const mirror = doc.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  const style = mirror.style;
  for (const prop of MIRROR_STYLE_PROPERTIES) {
    // Dynamic CSSOM assignment across a fixed property list.
    (style as unknown as Record<string, string>)[prop] =
      computed[prop as unknown as number] as string;
  }
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.width = `${textarea.clientWidth}px`;
  style.height = '';
  style.overflow = 'hidden';

  mirror.textContent = textarea.value.substring(0, position);
  const marker = doc.createElement('span');
  // Trailing "\u200b" keeps an empty final line measurable.
  marker.textContent = `${textarea.value.substring(position)}\u200b`;
  mirror.appendChild(marker);

  const body = doc.body ?? doc.documentElement;
  body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const spanRect = marker.getBoundingClientRect();
  body.removeChild(mirror);

  const lineHeight =
    parsePx(computed.lineHeight) || spanRect.height || Math.round(parsePx(computed.fontSize) * 1.4) || 16;

  // Marker offset inside the mirror == offset from the textarea border-box
  // (borders/padding were cloned). Scroll shifts the content, so remove it.
  const left = textarea.getBoundingClientRect().left + (spanRect.left - mirrorRect.left) - textarea.scrollLeft;
  const top = textarea.getBoundingClientRect().top + (spanRect.top - mirrorRect.top) - textarea.scrollTop;

  return { left, top, right: left + 1, bottom: top + lineHeight };
}

export interface PickerPlacement {
  left: number;
  top: number;
  /** Which side of the caret the picker ended up on. */
  placement: 'above' | 'below';
}

const VIEWPORT_MARGIN = 8;
/** Gap between the caret line and the picker edge. */
const CARET_GAP = 6;

/**
 * Viewport-space placement for a picker anchored to a caret line.
 * Prefers ABOVE the caret (so it never slides down over the composer);
 * flips BELOW only when there is no headroom above; horizontal position
 * tracks the caret but is clamped inside the viewport.
 */
export function computePickerPosition(
  /** Caret line in VIEWPORT coordinates. */
  caretLine: RectBox,
  viewport: { width: number; height: number },
  picker: { width: number; height: number },
): PickerPlacement {
  const headroomNeeded = Math.min(picker.height, 160);
  const placement: 'above' | 'below' =
    caretLine.top - CARET_GAP >= headroomNeeded ? 'above' : 'below';

  const rawTop =
    placement === 'above'
      ? caretLine.top - picker.height - CARET_GAP
      : caretLine.bottom + CARET_GAP;
  const maxTop = viewport.height - picker.height - VIEWPORT_MARGIN;
  const top = Math.min(Math.max(rawTop, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, maxTop));

  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - picker.width - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(caretLine.left, VIEWPORT_MARGIN), maxLeft);

  return { left, top, placement };
}
