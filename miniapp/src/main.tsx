import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFullscreen } from './lib/telegramFullscreen';
import './styles/index.css';

// Полный экран запрашиваем до первого рендера: иначе на телефоне мимо Safe Area
// «поедет» первый кадр. Вне Telegram — no-op.
initFullscreen();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);