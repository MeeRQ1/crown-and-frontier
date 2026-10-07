// Saving into a used slot never silently discards the save that was there: it is
// kept one generation back and listed under its own label.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { SaveStore, slotLabel } from '../src/ui/storage';

describe('manual save slots', () => {
  it('keep the save they replace, and say which is which', async () => {
    const store = new SaveStore();
    await store.init();
    expect(store.mode).toBe('memory');
    const sim = createGame({ scenario: 'reach', seed: 2, playerNation: null });
    const first = serialize(sim);
    expect(await store.putKeepingPrevious('slot-1', first)).toBe(false);
    step(sim);
    const second = serialize(sim);
    expect(await store.putKeepingPrevious('slot-1', second)).toBe(true);
    expect(await store.get('slot-1')).toBe(second);
    expect(await store.get('prev-slot-1')).toBe(first);
    // saving the same campaign again replaces nothing
    expect(await store.putKeepingPrevious('slot-1', second)).toBe(false);
    expect(await store.get('prev-slot-1')).toBe(first);
    expect((await store.list()).map((s) => slotLabel(s.key))).toEqual(['Slot 1 (the save it replaced)', 'Slot 1']);
    expect(slotLabel('autosave-b')).toBe('Autosave');
  });
});
