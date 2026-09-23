import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useValentinesStore } from '../hooks/useValentinesStore';

export function MenuRootScreen() {
  const { menuResult, menuLoading, fetchLatestMenu } = useValentinesStore();

  useEffect(() => {
    void fetchLatestMenu();
  }, [fetchLatestMenu]);

  if (menuLoading && !menuResult) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span style={{ color: 'var(--ash)', fontSize: 14 }}>Загружаем сохранённое меню…</span>
      </div>
    );
  }

  if (menuResult) {
    return <Navigate to="/menu/result" replace />;
  }
  return <Navigate to="/menu/store" replace />;
}