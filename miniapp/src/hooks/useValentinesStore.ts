import { create } from 'zustand';
import type { Pair, Valentine, ValentineWithSender, TelegramUser } from '../types';
import { api } from '../api/client';
import { subscribeToValentines, unsubscribeFromValentines } from '../api/supabase';

interface ValentinesState {
  pair: Pair | null;
  valentines: ValentineWithSender[];
  currentUser: TelegramUser | null;
  isLoading: boolean;
  error: string | null;
  realtimeChannel: ReturnType<typeof subscribeToValentines> | null;

  fetchPair: () => Promise<void>;
  fetchValentines: () => Promise<void>;
  sendValentine: (animationType: string, message: string | null) => Promise<ValentineWithSender | null>;
  markSeen: (id: string) => Promise<void>;
  addValentine: (valentine: ValentineWithSender) => void;
  updateValentine: (valentine: ValentineWithSender) => void;
  removeValentine: (id: string) => void;
  setCurrentUser: (user: TelegramUser) => void;
  setupRealtime: (pairId: string) => void;
  cleanupRealtime: () => void;
  clearError: () => void;
}

function enrichValentine(valentine: Valentine, currentUserId: number): ValentineWithSender {
  const isOwn = valentine.sender_telegram_id === currentUserId;
  return {
    ...valentine,
    sender_name: isOwn ? 'Вы' : 'Партнер',
    is_own: isOwn,
  };
}

export const useValentinesStore = create<ValentinesState>((set, get) => ({
  pair: null,
  valentines: [],
  currentUser: null,
  isLoading: false,
  error: null,
  realtimeChannel: null,

  fetchPair: async () => {
    set({ isLoading: true, error: null });
    const result = await api.getMyPair();
    if (result.error) {
      set({ error: result.error, isLoading: false });
      return;
    }
    set({ pair: result.data!.pair, isLoading: false });
  },

  fetchValentines: async () => {
    const { pair, currentUser } = get();
    if (!pair || !currentUser) return;

    set({ isLoading: true, error: null });
    const result = await api.getValentines();
    if (result.error) {
      set({ error: result.error, isLoading: false });
      return;
    }

    const enriched = result.data!.valentines
      .map((v) => enrichValentine(v, currentUser.id))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    set({ valentines: enriched, isLoading: false });
  },

  sendValentine: async (animationType, message) => {
    const { pair, currentUser } = get();
    if (!pair || !currentUser) return null;

    const result = await api.sendValentine({ animation_type: animationType as any, message });
    if (result.error) {
      set({ error: result.error });
      return null;
    }

    const newValentine = enrichValentine(result.data!.valentine, currentUser.id);
    set((state) => ({ valentines: [newValentine, ...state.valentines] }));
    return newValentine;
  },

  markSeen: async (id) => {
    await api.markSeen(id);
    set((state) => ({
      valentines: state.valentines.map((v) =>
        v.id === id ? { ...v, seen_at: new Date().toISOString() } : v
      ),
    }));
  },

  addValentine: (valentine) =>
    set((state) => ({ valentines: [valentine, ...state.valentines] })),

  updateValentine: (valentine) =>
    set((state) => ({
      valentines: state.valentines.map((v) => (v.id === valentine.id ? valentine : v)),
    })),

  removeValentine: (id) =>
    set((state) => ({ valentines: state.valentines.filter((v) => v.id !== id) })),

  setCurrentUser: (user) => set({ currentUser: user }),

  setupRealtime: (pairId) => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      unsubscribeFromValentines(realtimeChannel);
    }

    const { currentUser } = get();
    if (!currentUser) return;

    const channel = subscribeToValentines(
      pairId,
      (valentine) => {
        const enriched = enrichValentine(valentine, currentUser.id);
        get().addValentine(enriched);
      },
      (valentine) => {
        const enriched = enrichValentine(valentine, currentUser.id);
        get().updateValentine(enriched);
      },
      (valentine) => {
        get().removeValentine(valentine.id);
      }
    );

    set({ realtimeChannel: channel });
  },

  cleanupRealtime: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      unsubscribeFromValentines(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  clearError: () => set({ error: null }),
}));