import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { setMainButton, hideMainButton, setBackButton, applyTheme } from '../utils/telegram';

export function Layout() {
  useEffect(() => {
    applyTheme();
    hideMainButton();
    setBackButton(false);
  }, []);

  return <Outlet />;
}