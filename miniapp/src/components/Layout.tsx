import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { hideMainButton, applyTheme } from '../utils/telegram';
import { useValentinesStore } from '../hooks/useValentinesStore';
import { AddToHomeBanner } from './AddToHomeBanner';
import { NavSheet } from './NavSheet';

export function Layout() {
  const pair = useValentinesStore((state) => state.pair);

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
      {/* Ярлык на рабочий стол предлагаем только после успешного пейринга. */}
      <AddToHomeBanner visible={!!pair} />
      <NavSheet />
    </>
  );
}