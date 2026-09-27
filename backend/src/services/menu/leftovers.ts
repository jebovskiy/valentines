import { supabase } from '../../utils/supabase';
import type { ExistingStock } from './costing';

export interface StoredLeftover {
  pair_id: string;
  ingredient_id: string;
  qty: number;
  unit: string;
  updated_at: string;
}

export async function listLeftoversForPair(pairId: string): Promise<StoredLeftover[]> {
  const { data, error } = await supabase
    .from('leftovers')
    .select('*')
    .eq('pair_id', pairId)
    .order('ingredient_id', { ascending: true });
  if (error) throw error;
  return (data as StoredLeftover[]) ?? [];
}

/** Leftovers ready to feed into buildShoppingList (qty/unit in canonical units). */
export async function getExistingStockForPair(pairId: string): Promise<ExistingStock[]> {
  const rows = await listLeftoversForPair(pairId);
  return rows.map((r) => ({
    ingredientId: r.ingredient_id,
    qty: Number(r.qty),
    unit: r.unit as ExistingStock['unit'],
  }));
}

/** Replaces the pair's leftovers set (idempotent upsert per ingredient). */
export async function setLeftoversForPair(
  pairId: string,
  items: { ingredientId: string; qty: number; unit: string }[]
): Promise<void> {
  if (items.length === 0) {
    const { error } = await supabase.from('leftovers').delete().eq('pair_id', pairId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('leftovers').upsert(
    items.map((i) => ({ pair_id: pairId, ingredient_id: i.ingredientId, qty: i.qty, unit: i.unit })),
    { onConflict: 'pair_id,ingredient_id' }
  );
  if (error) throw error;
}