import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { initTelegramWebApp, applyTheme, getTelegramUser } from './utils/telegram';
import { useValentinesStore } from './hooks/useValentinesStore';
import { Layout } from './components/Layout';
import { ListScreen } from './screens/ListScreen';
import { SendScreen } from './screens/SendScreen';
import { DetailScreen } from './screens/DetailScreen';
import { PairingScreen } from './screens/PairingScreen';
import { CompanionRedirect } from './screens/CompanionRedirect';
import './styles/global.css';

function App() {
  const { currentUser, fetchPair, fetchValentines, setupRealtime, cleanupRealtime, pair } = useValentinesStore();

  useEffect(() => {
    initTelegramWebApp();
    applyTheme();

    const user = getTelegramUser();
    if (user) {
      useValentinesStore.getState().setCurrentUser(user);
      fetchPair();
    }

    window.addEventListener('themechange', applyTheme);
    return () => {
      window.removeEventListener('themechange', applyTheme);
      cleanupRealtime();
    };
  }, []);

  useEffect(() => {
    if (pair && currentUser) {
      fetchValentines();
      setupRealtime(pair.id);
    }
  }, [pair, currentUser]);

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'linear-gradient(135deg, #e91e63, #ff6b9d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Загрузка...</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Инициализация Telegram Mini App</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ListScreen />} />
          <Route path="send" element={<SendScreen />} />
          <Route path="valentine/:id" element={<DetailScreen />} />
          <Route path="pairing" element={<PairingScreen />} />
        </Route>
        <Route path="/c/:token" element={<CompanionRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;