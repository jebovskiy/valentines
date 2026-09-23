import { supabase } from '../../utils/supabase';
import type { MenuRequest, MenuResult, StoreId } from './types';

export interface StoredMenu {
  id: string;
  pair_id: string;
  store_id: StoreId;
  params: MenuRequest;
  result: MenuResult;
  created_at: string;
}

export async function createStoredMenu(
  pairId: string,
  params: MenuRequest,
  result: MenuResult
): Promise<StoredMenu> {
  const { data, error } = await supabase
    .from('menus')
    .insert({ id: result.id, pair_id: pairId, store_id: params.storeId, params, result })
    .select()
    .single();
  if (error) throw error;
  return data as StoredMenu;
}

export async function getStoredMenuForPair(menuId: string, pairId: string): Promise<StoredMenu | null> {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', menuId)
    .eq('pair_id', pairId)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredMenu) ?? null;
}

/** The most recently created stored menu for a pair (the saved week plan). */
export async function getLatestStoredMenuForPair(pairId: string): Promise<StoredMenu | null> {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredMenu) ?? null;
}

/** Persists a refreshed result (e.g. after picking a subset of recipes). */
export async function updateStoredMenuResult(menuId: string, pairId: string, result: MenuResult): Promise<void> {
  const { error } = await supabase
    .from('menus')
    .update({ result })
    .eq('id', menuId)
    .eq('pair_id', pairId);
  if (error) throw error;
}