/**
 * PanelResizer — §249 divider resize + §220 keyboard-accessible alternative.
 *
 * Shared by the left navigation rail (§195 sidebar width) and the right work
 * surface (§94/§249). Drag works with pointer events; the identical outcome is
 * reachable from the keyboard alone (§220 — WCAG dragging-movements):
 *   Arrow keys widen/narrow relative to the panel's side of the center pane;
 *   Home snaps to the minimum, End to the maximum.
 * The hit area is ≥24 CSS px wide (§221) while only a hairline is painted.
 */
import React, { useRef } from 'react';
import { cn } from '@/design-system/utils';

export interface PanelResizerProps {
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  /** Which side of the center pane the resized panel is docked against. */
  side: 'left' | 'right';
  label: string;
  className?: string;
}

const KEYBOARD_STEP = 16;

export function PanelResizer({
  width,
  min,
  max,
  onResize,
  side,
  label,
  className,
}: PanelResizerProps) {
  const draggingRef = useRef(false);

  const clamp = (w: number) => Math.min(Math.max(w, min), max);
  /** Positive delta always widens the panel, regardless of its side. */
  const widen = (delta: number) => {
    const sign = side === 'left' ? 1 : -1;
    onResize(clamp(width + delta * sign));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    // Left-docked panels widen when dragged right; right-docked widen when
    // dragged left — matching the physical divider under the cursor.
    widen(side === 'left' ? e.movementX : -e.movementX);
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        switch (e.key) {
          case 'ArrowLeft':
            widen(-KEYBOARD_STEP);
            break;
          case 'ArrowRight':
            widen(KEYBOARD_STEP);
            break;
          case 'Home':
            onResize(min);
            break;
          case 'End':
            onResize(max);
            break;
          default:
            return;
        }
        e.preventDefault();
      }}
      // §221: invisible 24px-wide hit strip centered on the painted hairline.
      className={cn(
        'group relative z-10 flex w-6 shrink-0 cursor-col-resize select-none touch-none items-stretch justify-center outline-none focus-visible:shadow-[var(--md-focus-ring)] rounded-full transition-colors duration-micro ease-emphasized motion-reduce:transition-none',
        '-mx-[10px]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="h-full w-px bg-outline-variant rounded-full transition-all duration-micro ease-emphasized motion-reduce:transition-none group-hover:w-[3px] group-hover:bg-primary group-focus-visible:w-[3px] group-focus-visible:bg-primary group-active:bg-primary"
      />
    </div>
  );
}
