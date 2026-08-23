import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom lacks ResizeObserver / matchMedia used by Radix + CSS
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Tooltip provider needs scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

// Pointer events helpers for Radix (pointer capture)
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);