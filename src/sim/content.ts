// Startup validation of data-driven content (technologies, policies,
// personalities, events). Returns problems; createGame() refuses to start
// with invalid content so broken data never reaches a campaign.

import { EVENTS } from './data/events';
import { PERSONALITIES } from './data/personalities';
import { POLICIES, POLICY_LIST } from './data/policies';
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
  for (const p of POLICY_LIST) for (const k of Object.keys(p.effects)) if (!(k in MOD_LABELS)) errs.push(`policy ${p.id} has unknown effect ${k}`);
  for (const [id, p] of Object.entries(PERSONALITIES)) {
    for (const pol of p.policies) if (!POLICIES[pol]) errs.push(`personality ${id} prefers unknown policy ${pol}`);
    const c = p.composition;
    if (Math.abs(c.foot + c.horse + c.guns - 1) > 1e-6) errs.push(`personality ${id} composition does not sum to 1`);
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
