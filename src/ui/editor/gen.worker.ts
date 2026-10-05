// Map generation off the main thread. Profiling (docs/expansion/PLAN.md, Stage D)
// measured 2–10 s to generate a map of 110–550 provinces, long enough to
// freeze the page, so the editor's "New map" runs the generator here.

import { buildProceduralMap, type ProceduralParams } from '../../maps/gen/procedural';

const port = self as unknown as { onmessage: ((e: MessageEvent<ProceduralParams>) => void) | null; postMessage(m: unknown): void };

port.onmessage = (e) => {
  const t0 = performance.now();
  try {
    const r = buildProceduralMap(e.data);
    port.postMessage({ ok: true, pkg: r.pkg, warnings: r.check.warnings, ms: Math.round(performance.now() - t0), attempts: r.attempts });
  } catch (err) {
    port.postMessage({ ok: false, message: (err as Error).message ?? String(err) });
  }
};
