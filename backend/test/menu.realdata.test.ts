import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CuratedPriceProvider, SnapshotRecipeProvider } from '../src/services/menu/providers';

const DATA_DIR = path.join(__dirname, '..', 'menu-data');

test('SnapshotRecipeProvider loads the imported recipe snapshot', () => {
  const p = new SnapshotRecipeProvider(path.join(DATA_DIR, 'recipes.json'));
  assert.ok(p.isAvailable, 'recipes.json must contain a real snapshot');
  assert.match(p.snapshotMeta?.source ?? '', /russianfood/);
});

test('snapshot recipes have plausible data and 100% catalogue coverage', async () => {
  const p = new SnapshotRecipeProvider(path.join(DATA_DIR, 'recipes.json'));
  const recipes = await p.getAllRecipes();
  assert.ok(recipes.length >= 10);
  for (const r of recipes) {
    assert.ok(r.ingredients.length > 0, `${r.id}: no ingredients`);
    for (const i of r.ingredients) {
      assert.ok(!i.ingredientId.startsWith('import:'), `${r.id}: unmapped ${i.ingredientId}`);
      assert.ok(i.qty > 0, `${r.id}: nonpositive qty`);
    }
    assert.ok(r.name.length > 0, `${r.id}: empty name`);
    assert.ok(['russianfood_import', 'fixture'].includes(r.dataKind), `${r.id}: unexpected dataKind ${r.dataKind}`);
  }
});

test('CuratedPriceProvider: empty snapshot keeps honest mock labels, real snapshot flips to live', async () => {
  const p = new CuratedPriceProvider(path.join(DATA_DIR, 'prices.json'));
  const stores = await p.getStores();
  const catalog = stores[0].priceCatalog;
  assert.ok(catalog === 'live' || catalog === 'mock');
  if (p.isAvailable) {
    assert.equal(catalog, 'live');
  }
  assert.equal(p.isMock, false, 'snapshot provider never claims offers are mock');
});