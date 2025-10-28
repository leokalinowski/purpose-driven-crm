import '@testing-library/jest-dom';

// Mock IntersectionObserver
// @ts-ignore - Test mock
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
};

// Mock ResizeObserver
// @ts-ignore - Test mock
global.ResizeObserver = class ResizeObserver {
  constructor(cb: ResizeObserverCallback) {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage
const localStorageMock: Storage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  length: 0,
  key: (index: number) => null,
};

// @ts-ignore - Test mock
global.localStorage = localStorageMock;

// Mock URL.createObjectURL
global.URL.createObjectURL = () => 'mock-url';

// Mock URL.revokeObjectURL
global.URL.revokeObjectURL = () => {};
