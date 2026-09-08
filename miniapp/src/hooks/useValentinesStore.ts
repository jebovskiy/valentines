import { create } from 'zustand';
import type { Pair, Valentine, ValentineWithSender, TelegramUser, UserProfile } from '../types';
import { api } from '../api/client';
import { subscribeToValentines, unsubscribeFromValentines } from '../api/supabase';

export const PARTNER_NAME_OVERRIDE_KEY = 'vn_partner_name_override';

function getPartnerOverride(pairId: string): string | null {
  try {
    return localStorage.getItem(`${PARTNER_NAME_OVERRIDE_KEY}:${pairId}`);
  } catch {
    return null;
  }
}

function setPartnerOverride(pairId: string, name: string | null): void {
  try {
    if (name && name.trim()) localStorage.setItem(`${PARTNER_NAME_OVERRIDE_KEY}:${pairId}`, name.trim());
    else localStorage.removeItem(`${PARTNER_NAME_OVERRIDE_KEY}:${pairId}`);
  } catch {
    /* ignore */
  }
}

interface ValentinesState {
  pair: Pair | null;
  valentines: ValentineWithSender[];
  currentUser: TelegramUser | null;
  profile: UserProfile | null;
  partnerProfile: UserProfile | null;
  androidPaired: boolean;
  isLoading: boolean;
  error: string | null;
  realtimeChannel: ReturnType<typeof subscribeToValentines> | null;

  fetchPair: () => Promise<void>;
  checkPair: () => Promise<Pair | null>;
  createInvite: () => Promise<string | null>;
  joinInvite: (code: string) => Promise<boolean>;
  fetchValentines: () => Promise<void>;
  refreshValentines: () => Promise<void>;
  sendValentine: (animationType: string, message: string | null, recipient?: 'partner' | 'self', photoBase64?: string | null) => Promise<ValentineWithSender | null>;
  markSeen: (id: string) => Promise<void>;
  addValentine: (valentine: ValentineWithSender) => void;
  updateValentine: (valentine: ValentineWithSender) => void;
  removeValentine: (id: string) => void;
  setCurrentUser: (user: TelegramUser) => void;
  fetchProfile: () => Promise<void>;
  updateMyName: (name: string) => Promise<boolean>;
  updatePartnerName: (name: string) => void;
  refreshPairingStatus: () => Promise<void>;
  setupRealtime: (pairId: string) => void;
  cleanupRealtime: () => void;
  clearError: () => void;
}

function enrichValentine(valentine: Valentine, pair: Pair | null, currentUserId: number): ValentineWithSender {
  const isOwn = valentine.sender_telegram_id === currentUserId;
  return {
    ...valentine,
    sender_name: isOwn ? 'Вы' : partnerName(pair, currentUserId),
    is_own: isOwn,
  };
}

export function partnerName(pair: Pair | null, currentUserId: number | null): string {
  if (!pair || !currentUserId) return 'Партнер';
  const override = getPartnerOverride(pair.id);
  if (override && override.trim()) return override.trim();
  if (pair.telegram_user_a === currentUserId) return pair.user_b_name || 'Партнер';
  if (pair.telegram_user_b === currentUserId) return pair.user_a_name || 'Партнер';
  return 'Партнер';
}

export function daysTogether(pair: Pair | null): number {
  if (!pair) return 0;
  const start = new Date(pair.created_at).getTime();
  return Math.max(1, Math.floor((Date.now() - start) / 86400000));
}

export const useValentinesStore = create<ValentinesState>((set, get) => ({
  pair: null,
  valentines: [],
  currentUser: null,
  profile: null,
  partnerProfile: null,
  androidPaired: false,
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
    set({
      pair: result.data!.pair,
      androidPaired: result.data!.pairing?.android_paired ?? false,
      isLoading: false,
    });
  },

  checkPair: async () => {
    const result = await api.getMyPair();
    if (result.error) return null;
    const pair = result.data!.pair;
    set({ pair, androidPaired: result.data!.pairing?.android_paired ?? false });
    return pair;
  },

  createInvite: async () => {
    set({ isLoading: true, error: null });
    const result = await api.createInvite();
    if (result.error) {
      set({ error: result.error, isLoading: false });
      return null;
    }
    set({ isLoading: false });
    return result.data!.code;
  },

  joinInvite: async (code) => {
    set({ isLoading: true, error: null });
    const result = await api.joinInvite(code);
    if (result.error) {
      set({ error: result.error, isLoading: false });
      return false;
    }
    const pairResult = await api.getMyPair();
    if (pairResult.error) {
      set({ error: pairResult.error, isLoading: false });
      return false;
    }
    set({
      pair: pairResult.data!.pair,
      androidPaired: pairResult.data!.pairing?.android_paired ?? false,
      isLoading: false,
    });
    return true;
  },

  fetchProfile: async () => {
    const result = await api.getMyProfile();
    if (result.error) return;
    set({
      profile: result.data!.me,
      partnerProfile: result.data!.partner,
    });
  },

  updateMyName: async (name) => {
    const result = await api.updateMyName(name);
    if (result.error) return false;
    const profile = get().profile;
    if (profile) set({ profile: { ...profile, display_name: result.data!.name } });
    const pair = get().pair;
    if (pair && get().currentUser) {
      if (pair.telegram_user_a === get().currentUser!.id) {
        set({ pair: { ...pair, user_a_name: result.data!.name } });
      } else {
        set({ pair: { ...pair, user_b_name: result.data!.name } });
      }
    }
    return true;
  },

  updatePartnerName: (name) => {
    const pair = get().pair;
    if (!pair) return;
    setPartnerOverride(pair.id, name);
  },

  refreshPairingStatus: async () => {
    const result = await api.getMyPair();
    if (result.error) return;
    set({ androidPaired: result.data!.pairing?.android_paired ?? false });
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
      .map((v) => enrichValentine(v, pair, currentUser.id))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    set({ valentines: enriched, isLoading: false });
  },

  refreshValentines: async () => {
    const { pair, currentUser } = get();
    if (!pair || !currentUser) return;

    const result = await api.getValentines();
    if (result.error) return;

    const enriched = result.data!.valentines
      .map((v) => enrichValentine(v, pair, currentUser.id))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    set({ valentines: enriched });
  },

  sendValentine: async (animationType, message, recipient = 'partner', photoBase64 = null) => {
    const { pair, currentUser } = get();
    if (!pair || !currentUser) return null;

    const result = await api.sendValentine({ animation_type: animationType as any, message, recipient, photo_base64: photoBase64 });
    if (result.error) {
      set({ error: result.error });
      return null;
    }

    const newValentine = enrichValentine(result.data!.valentine, get().pair, currentUser.id);
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
        const enriched = enrichValentine(valentine, get().pair, currentUser.id);
        get().addValentine(enriched);
      },
      (valentine) => {
        const enriched = enrichValentine(valentine, get().pair, currentUser.id);
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