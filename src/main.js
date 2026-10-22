import { mount } from 'svelte';
import './styles.css';
import App from './App.svelte';

// Registered only where supported, with a relative path so it works under the GitHub Pages sub-path.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker non registrato', err));
}

mount(App, { target: document.getElementById('app') });
