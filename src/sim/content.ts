// Startup validation of data-driven content (technologies, focus trees,
// personalities, events). Returns problems; createGame() refuses to start
// with invalid content so broken data never reaches a campaign.

import { EVENTS } from './data/events';
import { PERSONALITIES } from './data/personalities';
import { FOCUS_BRANCHES, GENERIC_FOCUSES, type FocusDef } from './data/focus';
import { TECH_LIST, TECHS } from './data/techs';
import { MOD_LABELS } from './modifiers';
import type { ScenarioDef } from './types';

export function validateContent(s: ScenarioDef): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const t of TECH_LIST) {
    if (ids.has(t.id)) errs.push(`duplicate tech ${t.id}`);
    ids.add(t.id);
    for (const r of t.requires) if (!TECHS[r]) errs.push(`tech ${t.id} requires unknown ${r}`);
    for (const k of Object.keys(t.effects)) if (!(k in MOD_LABELS)) errs.push(`tech ${t.id} has unknown effect ${k}`);
    if (!(t.cost > 0)) errs.push(`tech ${t.id} has no cost`);
  }
  // prerequisite cycles
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      errs.push(`tech prerequisite cycle at ${id}`);
      return;
    }
    visiting.add(id);
    for (const r of TECHS[id]?.requires ?? []) visit(r);
    visiting.delete(id);
    done.add(id);
  };
  for (const t of TECH_LIST) visit(t.id);
  errs.push(...validateFocuses(GENERIC_FOCUSES));
  for (const [id, p] of Object.entries(PERSONALITIES)) {
    for (const b of Object.keys(FOCUS_BRANCHES)) if (!(p.focus[b as keyof typeof p.focus] > 0)) errs.push(`personality ${id} has no weight for focus branch ${b}`);
    const sum = Object.values(p.composition).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-6) errs.push(`personality ${id} composition does not sum to 1`);
  }
  const evIds = new Set<string>();
  for (const e of EVENTS) {
    if (evIds.has(e.id)) errs.push(`duplicate event ${e.id}`);
    evIds.add(e.id);
    if (!e.choices.length) errs.push(`event ${e.id} has no choices`);
    if (!e.choices.some((c) => !c.problem)) errs.push(`event ${e.id} has no always-available choice`);
  }
  for (const n of s.nations) if (!PERSONALITIES[n.personality]) errs.push(`nation ${n.id} has unknown personality ${n.personality}`);
  return errs;
}

/**
 * Checks a focus tree: unique ids, known prerequisites and exclusions (which
 * must be mutual), known effects, positive durations and no prerequisite cycles.
 */
export function validateFocuses(list: FocusDef[]): string[] {
  const errs: string[] = [];
  const by = new Map<string, FocusDef>();
  for (const d of list) {
    if (by.has(d.id)) errs.push(`duplicate focus ${d.id}`);
    by.set(d.id, d);
  }
  for (const d of list) {
    for (const r of [...d.requires, ...(d.requiresAny ?? [])]) if (!by.has(r)) errs.push(`focus ${d.id} requires unknown ${r}`);
    for (const x of d.excludes ?? []) {
      if (!by.has(x)) errs.push(`focus ${d.id} excludes unknown ${x}`);
      else if (!by.get(x)!.excludes?.includes(d.id)) errs.push(`focus ${d.id} excludes ${x}, but not the other way round`);
    }
    for (const k of Object.keys(d.effects)) if (!(k in MOD_LABELS)) errs.push(`focus ${d.id} has unknown effect ${k}`);
    if (!(d.months > 0)) errs.push(`focus ${d.id} has no duration`);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      errs.push(`focus prerequisite cycle at ${id}`);
      return;
    }
    visiting.add(id);
    const d = by.get(id);
    for (const r of [...(d?.requires ?? []), ...(d?.requiresAny ?? [])]) visit(r);
    visiting.delete(id);
    done.add(id);
  };
  for (const d of list) visit(d.id);
  return errs;
}
