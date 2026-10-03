import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFullscreen } from './lib/telegramFullscreen';
import { initKeyboardViewport } from './lib/keyboardViewport';
import './styles/index.css';

// Полный экран запрашиваем до первого рендера: иначе на телефоне мимо Safe Area
// «поедет» первый кадр. Вне Telegram — no-op.
initFullscreen();
// Подписка на высоту вьюпорта нужна сразу: fixed-шторки с полями ввода должны
// знать про клавиатуру уже на первом кадре.
initKeyboardViewport();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);