import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { hideMainButton, applyTheme } from '../utils/telegram';
import { NavSheet } from './NavSheet';

export function Layout() {
  useEffect(() => {
    applyTheme();
    hideMainButton();
    // Кнопку «назад» не гасим навсегда: главный экран сам навешивает
    // «закрыть на мини-апп» (см. BackCloseHandler в App.tsx), а экраны —
    // свой обработчик через setBackButton.
  }, []);

  return (
    <>
      <Outlet />
      <NavSheet />
    </>
  );
}