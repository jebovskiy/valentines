import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { hideMainButton, setBackButton, applyTheme } from '../utils/telegram';

export function Layout() {
  useEffect(() => {
    applyTheme();
    hideMainButton();
    setBackButton(false);
  }, []);

  return <Outlet />;
}