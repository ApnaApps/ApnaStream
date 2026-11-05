// Ensure window.fetch has both getter and setter for test/executor scripts
try {
  let _currentFetch = window.fetch;
  const getFetch = () => _currentFetch;
  const setFetch = (fn: typeof window.fetch) => { _currentFetch = fn; };

  try {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get: getFetch,
      set: setFetch
    });
  } catch (_) {}

  try {
    if (typeof Window !== 'undefined' && Window.prototype) {
      Object.defineProperty(Window.prototype, 'fetch', {
        configurable: true,
        enumerable: true,
        get: getFetch,
        set: setFetch
      });
    }
  } catch (_) {}
} catch (_) {}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
