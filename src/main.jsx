import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from './utils/swUtils.js';

// Register the service worker after the page loads.
// registerSW sets up update detection and dispatches 'sw-update-available'
// events — it never touches localStorage.
window.addEventListener('load', () => registerSW());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
