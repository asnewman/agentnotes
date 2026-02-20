import type { PreloadApi } from './types';

declare global {
  interface Window {
    api: PreloadApi;
  }
}

export {};
