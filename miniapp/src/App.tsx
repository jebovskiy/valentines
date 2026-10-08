import { shallow } from 'zustand/shallow';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { applyTheme, getTelegramUser, webApp, setBackButton } from './utils/telegram';
import { useValentinesStore } from './hooks/useValentinesStore';
import { Layout } from './components/Layout';
import { ListScreen } from './screens/ListScreen';
import { SendScreen } from './screens/SendScreen';
import { StreakScreen } from './screens/StreakScreen';
import { NotesScreen } from './screens/NotesScreen';
import { MoviesScreen } from './screens/MoviesScreen';
import { TasteProfileScreen } from './screens/TasteProfileScreen';
import { DetailScreen } from './screens/DetailScreen';
import { PairingScreen } from './screens/PairingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CompanionRedirect } from './screens/CompanionRedirect';
import { DeepValentineScreen } from './screens/DeepValentineScreen';
import { DatePlacesScreen } from './screens/DatePlacesScreen';
import { SkyScreen } from './screens/SkyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RecapScreen } from './screens/RecapScreen';
import { GamesScreen } from './screens/GamesScreen';
import { GamePlayScreen } from './screens/GamePlayScreen';
import { MenuStoreStep, MenuPeopleStep, MenuComponentsStep, MenuBudgetStep, MenuCookwareStep, MenuAllergensStep } from './screens/menu/MenuSteps';
import { MenuGeneratingScreen } from './screens/MenuGeneratingScreen';
import { MenuResultScreen } from './screens/MenuResultScreen';
import { MenuReplaceScreen } from './screens/MenuReplaceScreen';
import { MenuHistoryScreen } from './screens/MenuHistoryScreen';
import { MenuRootScreen } from './screens/MenuRootScreen';
import { MenuLeftoversScreen } from './screens/MenuLeftoversScreen';
import { ShoppingListScreen } from './screens/ShoppingListScreen';
import './styles/global.css';

function App() {
  const { currentUser, fetchPair, fetchValentines, setupRealtime, cleanupRealtime, pair } = useValentinesStore(
    (s) => ({ currentUser: s.currentUser, fetchPair: s.fetchPair, fetchValentines: s.fetchValentines, setupRealtime: s.setupRealtime, cleanupRealtime: s.cleanupRealtime, pair: s.pair }),
    shallow,
  );
  const [initialPath, setInitialPath] = useState<string | null>(null);

  useEffect(() => {
    // ready()/expand() и запрос полного экрана уже выполнены в main.tsx.
    applyTheme();

    const user = getTelegramUser();
    if (user) {
      useValentinesStore.getState().setCurrentUser(user);
      fetchPair();
      useValentinesStore.getState().fetchProfile();
    }

    const startParam = (window.Telegram?.WebApp as any)?.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('v_')) {
      setInitialPath(`/v/${startParam.slice(2)}`);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <BackCloseHandler />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ListScreen />} />
          <Route path="send" element={<SendScreen />} />
          <Route path="valentine/:id" element={<DetailScreen />} />
          <Route path="pairing" element={<PairingScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="streak" element={<StreakScreen />} />
          <Route path="notes" element={<NotesScreen />} />
          <Route path="movies" element={<MoviesScreen />} />
          <Route path="movies/taste" element={<TasteProfileScreen />} />
          <Route path="date" element={<DatePlacesScreen />} />
          <Route path="sky" element={<SkyScreen />} />
          <Route path="games" element={<GamesScreen />} />
          <Route path="games/play" element={<GamePlayScreen />} />
          <Route path="menu" element={<MenuRootScreen />} />
          <Route path="menu/store" element={<MenuStoreStep />} />
          <Route path="menu/people" element={<MenuPeopleStep />} />
          <Route path="menu/components" element={<MenuComponentsStep />} />
          <Route path="menu/budget" element={<MenuBudgetStep />} />
          <Route path="menu/cookware" element={<MenuCookwareStep />} />
          <Route path="menu/allergens" element={<MenuAllergensStep />} />
          <Route path="menu/generating" element={<MenuGeneratingScreen />} />
          <Route path="menu/result" element={<MenuResultScreen />} />
          <Route path="menu/replace" element={<MenuReplaceScreen />} />
          <Route path="menu/history" element={<MenuHistoryScreen />} />
          <Route path="menu/shopping" element={<ShoppingListScreen />} />
          <Route path="menu/leftovers" element={<MenuLeftoversScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
<Route path="recap" element={<RecapScreen />} />
        </Route>
        <Route path="/c/:token" element={<CompanionRedirect />} />
        <Route path="/v/:id" element={<DeepValentineScreen />} />
        <Route
          path="*"
          element={initialPath ? <Navigate to={initialPath} replace /> : <Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

function BackCloseHandler() {
  const location = useLocation();

  useEffect(() => {
    const isHome = location.pathname === '/';
    if (!isHome) return;

    // На главном экране нажатие «назад» должно закрывать мини-апп, а не
    // откатывать browser history (это выглядит как «отмена действия»).
    if (window.history.length > 1) {
      window.history.pushState(null, '', window.location.href);
    }

    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
      webApp?.close();
    };
    window.addEventListener('popstate', onPopState);
    setBackButton(true, () => webApp?.close());

    return () => {
      window.removeEventListener('popstate', onPopState);
      setBackButton(false);
    };
  }, [location.pathname]);

  return null;
}

export default App;