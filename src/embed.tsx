import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';
import './embed.css';

// Polyfill Node.js globals for browser (required by mermaid)
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = { env: {}, cwd: () => '/', platform: 'linux' };
}

let root: Root | null = null;

export interface SysvizMountOptions {
  dataPath?: string;
  glmPath?: string;
}

export function mountSysviz(container: HTMLElement, options: SysvizMountOptions = {}) {
  if (root) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'sysviz-container';
  container.appendChild(wrapper);
  root = createRoot(wrapper);
  root.render(React.createElement(App, options));
}

export function unmountSysviz() {
  if (root) {
    root.unmount();
    root = null;
  }
}

// Expose on window for IIFE bundle
(window as any).SysViz = { mountSysviz, unmountSysviz };
