// How to Play: a field manual. A contents index beside one short article at a
// time; each article opens with what matters most, keeps the finer rules in
// expandable notes, and links to the ledger where the thing is done. Figures
// come from the game's own configuration so the manual follows the rules.

import { C, TERRAIN } from '../../sim/config';
import { TECH_EARLY_COST, TECH_LEAD_YEARS } from '../../sim/progression';
import { MODES } from '../map/modes';
import type { App } from '../app';
import { h, type Child } from '../dom';
import { icon, type IconName } from '../icons';
import type { LedgerTab } from '../panels/ledgers';

interface Article {
  id: string;
  title: string;
  icon: IconName;
  group: string;
  /** the one thing to know, first */
  lead: string;
  points: Child[];
  /** finer rules, folded */
  more?: Child[];
  example?: string;
  links?: Array<[LedgerTab, string]>;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function articles(): Article[] {
  const t = C.trade;
  return [
    {
      id: 'start',
      title: 'The campaign',
      icon: 'compass',
      group: 'Basics',
      lead: 'You lead one realm from the 1870s. Each week passes on its own; you set priorities and the realm carries them out until they are done or no longer possible.',
      points: [
        'Read the world (map modes, ledgers), choose a priority, commit crowns, materiel, resources and men, then watch the consequences and adapt.',
        'The game pauses whenever a decision needs you; Settings choose which ones.',
        'Every realm, AI or not, plays by the same rules, costs and formulas, and sees exactly what you see.',
      ],
      links: [['victory', 'How a campaign is won']],
    },
    {
      id: 'controls',
      title: 'Controls',
      icon: 'keyboard',
      group: 'Basics',
      lead: 'Click or tap to select; drag to pan; wheel or pinch to zoom. Right-click or long-press moves the selected army or fleet.',
      points: [
        h('span', null, h('kbd', null, 'Space'), ' pause · ', h('kbd', null, '1'), '–', h('kbd', null, '4'), ' speed · ', h('kbd', null, 'Esc'), ' close or deselect'),
        h('span', null, 'Ledgers: ', h('kbd', null, 'B'), ' Realm, ', h('kbd', null, 'I'), ' Industry, ', h('kbd', null, 'M'), ' Military, ', h('kbd', null, 'T'), ' Research, ', h('kbd', null, 'P'), ' Focus, ', h('kbd', null, 'D'), ' Diplomacy, ', h('kbd', null, 'W'), ' Wars, ', h('kbd', null, 'V'), ' Victory, ', h('kbd', null, 'L'), ' Chronicle, ', h('kbd', null, 'H'), ' Help'),
        h('span', null, h('kbd', null, 'G'), ' set a destination · ', h('kbd', null, 'N'), ' next army (', h('kbd', null, 'Shift'), '+', h('kbd', null, 'N'), ' next group) · ', h('kbd', null, 'C'), ' centre the selection · ', h('kbd', null, 'F'), ' fit the world · ', h('kbd', null, 'Home'), ' capital · ', h('kbd', null, 'K'), ' next battle · ', h('kbd', null, 'J'), ' jump to an alert'),
        h('span', null, 'Map modes: ', h('kbd', null, 'Shift'), '+', h('kbd', null, '1'), '…', h('kbd', null, String(MODES.length)), ` (${MODES.map((m) => m.label.toLowerCase()).join(', ')}); `, h('kbd', null, 'O'), ' cycles them. Arrow keys pan; ', h('kbd', null, '+'), ' and ', h('kbd', null, '−'), ' zoom.'),
        'In the Research and Focus plans, the arrow keys move between nodes.',
      ],
    },
    {
      id: 'map',
      title: 'Reading the map',
      icon: 'layers',
      group: 'Basics',
      lead: 'The map is an atlas: each mode colours the provinces by one question, and its legend says what every colour, line and mark means.',
      points: MODES.map((m) => h('span', null, h('b', null, `${m.label}: `), m.explain)),
    },
    {
      id: 'frontier',
      title: 'Frontier integration',
      icon: 'settle',
      group: 'Realm',
      lead: 'A province gives its full tax, recruits and supply only once integrated (0–100). New conquests start at 10, or 25 with a claim; settled land at 20.',
      points: ['Low integration means little tax, few recruits, no development, no supply source and more unrest.', 'Roads, garrisons, claims, charters and frontier focuses speed it up.', 'Too much raw frontier at once overextends the administration: integration slows, unrest rises and research slows until it is absorbed.'],
      links: [['realm', 'Administration in Realm & Budget']],
    },
    {
      id: 'budget',
      title: 'Crowns and the budget',
      icon: 'treasury',
      group: 'Realm',
      lead: 'Income comes from development and population (scaled by integration and unrest), trade and surplus manufactures; armies, fleets, forts, envoys and research funding cost upkeep.',
      points: [
        'Realm & Budget sets last month beside a projection of the next, line by line, with each cost linked to the ledger that causes it.',
        `Research funding costs ${C.economy.fundingCost.map((v) => pct(v)).join(' / ')} of gross income for minimal, standard, generous and lavish research.`,
        `A treasury below zero is debt and pays ${pct(C.economy.interestRate)} interest a month. Debt beyond ${C.economy.creditMonths} months of income is bankruptcy: debts are repudiated, construction halts, regiments desert, morale is halved and income falls by 25% for ${C.economy.bankruptcyMonths / 12} years.`,
        'The Runway figure says how many months the treasury lasts at the current deficit.',
      ],
      links: [['realm', 'Open Realm & Budget']],
    },
    {
      id: 'industry',
      title: 'Resources and industry',
      icon: 'factory',
      group: 'Economy',
      lead: 'Deposits yield coal, iron, oil, rubber and nitrates; factories burn coal to make materiel, which equips and reinforces regiments.',
      points: [
        `Each realm keeps a reserve of ${pct(C.resources.keepShare)} of its stockpile cap before it sells; stock above the cap is lost.`,
        'Running short of a resource has a named effect: factories without coal run at 30%, armour without oil fights at reduced strength, guns without nitrates lack shells in war.',
        'Industry & Trade shows each good’s stock, reserved amounts, output, need and actual flows, and marks the bottleneck.',
      ],
      links: [['industry', 'Open Industry & Trade']],
    },
    {
      id: 'trade',
      title: 'Trade contracts',
      icon: 'trade',
      group: 'Economy',
      lead: 'Goods move between realms only under contracts signed with a trade partner: a good, a quantity a month, a price per unit and a term.',
      points: [
        `Terms: ${t.minQty}–${t.maxQty} units a month, ${pct(t.priceMin)}–${pct(t.priceMax)} of the list price, for ${t.terms.join(', ')} months. A realm may hold ${t.maxContracts} contracts at once.`,
        'Contracted goods are reserved: the seller ships them before its own use. Payment is on delivery, so no crown changes hands for goods not delivered.',
        `Overland goods arrive the month they are shipped; by sea they arrive ${t.seaLag} month later, and a blockade holds back its share.`,
        'Before you sign, the forecast draws your stock month by month with and without the contract, from the same simulation; the other side’s acceptance comes with its reasons.',
      ],
      more: [
        `Cancelling early costs a fee of ${t.cancelFeeMonths} month’s value, ${t.cancelTrust} trust and opinion ${t.cancelOpinion}. Ending the trade agreement ends its contracts at the canceller’s cost.`,
        `A seller short, or a buyer unable to pay, for ${t.missLimit} settlements in a row defaults: ${t.defaultTrust} trust and opinion ${t.defaultOpinion}. A buyer in debt is not shipped to.`,
        'War between the parties ends their contracts; goods under way return to the seller unpaid.',
        `A partner supplying ${pct(t.dependence)} or more of a good we use is a dependence: it is a reason to keep ties, and the AI weighs it before declaring war. Inside a trade bloc the default price is 20% below list.`,
      ],
      example: 'Short of coal? Open Industry & Trade, choose Coal, pick a partner with a surplus and draft a contract: the chart shows whether the shortfall months disappear before you send it.',
      links: [['industry', 'Open Industry & Trade']],
    },
    {
      id: 'armies',
      title: 'Armies, orders and supply',
      icon: 'army',
      group: 'War',
      lead: 'Select an army and right-click a destination. The order holds until it arrives; the army card says why it is stalled when it is.',
      points: [
        'Reasons an order stalls: enemy troops in the province (pinned), no access along the route, a strait closed by enemy ships, a battle, a retreat.',
        `Supply reaches ${C.supply.range} steps from a supply source through friendly land. Strained supply stops reinforcement and costs 10% in battle; unsupplied armies lose 2% a week and fight at −25%.`,
        `An army that holds still digs in: +${pct(C.army.entrenchBonus[0])} after ${C.army.entrenchWeeks[0]} weeks, +${pct(C.army.entrenchBonus[1])} after ${C.army.entrenchWeeks[1]}; engineers dig twice as fast.`,
        'The army card’s Readiness lists what its composition, the ground, its supply and its condition mean for a fight here.',
      ],
      links: [['military', 'Open Military']],
    },
    {
      id: 'battle',
      title: 'Battles',
      icon: 'battle',
      group: 'War',
      lead: 'Terrain, forts, entrenchment, supply, composition, morale and technology decide a battle. A forecast before attacking shows three outcomes.',
      points: [
        `Frontage: only so many line regiments fight at once (plains ${TERRAIN.plains.frontage}, hills ${TERRAIN.hills.frontage}, forest ${TERRAIN.forest.frontage}, mountains ${TERRAIN.mountains.frontage}); the rest wait in reserve and replace losses.`,
        'Artillery and engineers support from behind: at most half the frontage of them can fire, and without enough line regiments to screen them they fire at half strength.',
        `Cavalry making up ${pct(C.combat.flankCavalryShare)} of the line flanks on open ground (+${pct(C.combat.flankBonus)}); woods, marsh and mountains hamper cavalry and armour.`,
        'Winning a battle does not take land: standing in a province besieges it. Battle reports in the Chronicle list the factors that decided each fight.',
      ],
    },
    {
      id: 'navy',
      title: 'Navy and air',
      icon: 'ship',
      group: 'War',
      lead: 'Fleets sail between sea zones, fight hostile fleets they meet and carry armies; air wings fly missions over provinces.',
      points: [
        'Ships are built in ports; each port level is a slipway. Guns hit surface ships; submarines torpedo big ships and only torpedo boats and cruisers can hunt them; carriers strike from the air.',
        'Enemy warships that outgun ours in a zone close its straits to our armies and supply; a coast whose zones all hold enemy warships is blockaded and loses a quarter of its crowns and its sea trade.',
        'Transports carry two regiments each: select an army on a coast with a fleet offshore and choose Ship by sea. Troops landing on an enemy coast fight at a disadvantage that week.',
        'With Aviation, build airfields and raise wings for superiority, ground support, interdiction, strategic bombing and reconnaissance. Holding 1.5× the enemy’s air power over a province holds the sky there.',
      ],
      links: [['military', 'Open Military']],
    },
    {
      id: 'diplomacy',
      title: 'Diplomacy',
      icon: 'diplomacy',
      group: 'Diplomacy',
      lead: 'Opinion is what a realm thinks of you; trust is your record for keeping your word; alarm is fear of your expansion. Every proposal shows the other side’s reasons before you send it.',
      points: [
        'Envoys raise opinion. Non-aggression pacts forbid war; trade agreements allow contracts and earn commerce; alliances are defensive calls to arms.',
        'Rapid conquest raises alarm, and so does a visible bid for territorial or economic victory; alarmed neighbours form coalitions.',
        'Depending on a realm for a good it supplies is a reason both sides weigh when you propose closer ties.',
      ],
      links: [['diplomacy', 'Open Diplomacy']],
    },
    {
      id: 'influence',
      title: 'Influence, spheres and blocs',
      icon: 'envoy',
      group: 'Diplomacy',
      lead: 'Influence (0–100) is what you hold over another realm; at 40, and 1.25× any rival’s, a smaller realm enters your sphere.',
      points: [
        'Envoys, trade, loans, guarantees, alliances and leading a trade bloc build it each month; it fades slowly, and fast in war.',
        'A realm in your sphere thinks better of you, will not ally or join a coalition against you, and you defend it when it is attacked.',
        'A guarantee calls you to arms when that realm is attacked; refusing ends it and costs trust. A loan of at least 50 crowns is repaid over two years with 20% interest; war repudiates it.',
        'A trade bloc (up to six members) buys from its members 20% below list and earns them 50% more commerce from each other; members share what blockades cost.',
      ],
      links: [['diplomacy', 'Open Diplomacy']],
    },
    {
      id: 'peace',
      title: 'War goals and peace',
      icon: 'wars',
      group: 'Diplomacy',
      lead: 'Declare war over a claim (no trust cost) or for conquest (costs trust, alarms neighbours). Peace is settled by the war leaders with demands priced in war score.',
      points: [
        'War score (−100…100) counts occupied land on both sides, battles (±30) and the war goal (±25).',
        'Demands: provinces, crowns, reparations, disarmament, renounced claims, or entry into a sphere. The other leader accepts when the war has gone badly enough for it; if not, the conference shows the part it would accept.',
        'Declaring war ends every contract between the two sides, and goods under way return unpaid.',
        'Wars end in a white peace after eight years, or three of stalemate; a side holding 90 for a year dictates terms. Peace brings a five-year truce.',
      ],
      links: [['wars', 'Open Wars & Peace']],
    },
    {
      id: 'research',
      title: 'Research',
      icon: 'research',
      group: 'Growth',
      lead: 'One technology at a time, in a tree of eras and branches. Points come from integrated development, funding and modifiers.',
      points: [
        `Each technology has a horizon year: researching it earlier costs ${pct(TECH_EARLY_COST)} more per year early, and it cannot be started more than ${TECH_LEAD_YEARS} years before it.`,
        'Points carry over when you switch; with nothing chosen, up to 60 points are banked and the rest is lost.',
        'The plan shows what each technology needs and leads to; select one to see its cost, time and effect before choosing it.',
      ],
      links: [['research', 'Open Research']],
    },
    {
      id: 'focus',
      title: 'National focus',
      icon: 'policy',
      group: 'Growth',
      lead: 'A focus is a national programme worked on for months; a finished one is permanent. Choose one at a time.',
      points: [
        'The national branch is made for your realm from the map: claims on neighbouring regions, its home region, its deposits, its coast and an ambition.',
        'Some focuses rule each other out (tied with a dashed bracket in the plan); some wait for a year or need a coast.',
        'Switching loses the work done on the current focus; the plan says how much before you confirm.',
      ],
      links: [['focus', 'Open National Focus']],
    },
    {
      id: 'victory',
      title: 'Victory and score',
      icon: 'victory',
      group: 'Growth',
      lead: 'Three routes win: territorial, economic and diplomatic. Each needs its conditions held for a run of months; the campaign score decides at the time limit.',
      points: [
        `A route’s timer runs only while every condition holds. The first month one fails it pauses; each further month in a row costs ${C.victory.streakDecay} months, unless the realm is within ${Math.round((1 - C.victory.nearMiss) * 100)}% of the main measure.`,
        'The Victory ledger shows each condition’s measure against its threshold and what next month will do to each timer.',
      ],
      links: [['victory', 'Open Victory']],
    },
    {
      id: 'saves',
      title: 'Saves and your data',
      icon: 'save',
      group: 'Utility',
      lead: 'The game autosaves every few months and when the tab is hidden. Saves live in this browser only.',
      points: [
        'They do not sync across devices or sites, and private browsing or managed-device policies can erase them. Use Menu → Export to keep a copy, and Import to restore it.',
        'A save made on another map, or by an older version, is checked before loading: an older save is upgraded and told what changed; one that cannot be read is refused with the reason, never loaded under the wrong map.',
        'Imports are data only: nothing in a save or a map file is ever run.',
      ],
    },
    {
      id: 'information',
      title: 'What everyone can see',
      icon: 'eye',
      group: 'Utility',
      lead: 'There is no fog of war: all information is public, and AI realms see exactly what you see.',
      points: ['Battle reports and explanations use only that public information; no realm’s plans or intentions are shown.'],
    },
  ];
}

export function helpLedger(app: App): HTMLElement {
  const list = articles();
  const cur = list.find((a) => a.id === app.ui.helpTopic) ?? list[0];
  const groups = [...new Set(list.map((a) => a.group))];
  const pick = (id: string) => {
    app.ui.helpTopic = id;
    app.refresh();
    requestAnimationFrame(() => (document.querySelector('.manual-article h3') as HTMLElement | null)?.focus({ preventScroll: true }));
  };
  const index = h(
    'nav',
    { class: 'manual-index', 'aria-label': 'Contents' },
    groups.map((g) =>
      h(
        'div',
        { class: 'mi-group' },
        h('div', { class: 'eyebrow' }, g),
        list
          .filter((a) => a.group === g)
          .map((a) => h('button', { type: 'button', class: `mi-item ${a.id === cur.id ? 'selected' : ''}`, 'aria-current': a.id === cur.id ? 'page' : null, 'data-fk': `help:${a.id}`, onclick: () => pick(a.id) }, icon(a.icon), a.title)),
      ),
    ),
  );
  const i = list.indexOf(cur);
  const art = h(
    'article',
    { class: 'manual-article', 'aria-labelledby': 'manual-title' },
    h('div', { class: 'eyebrow' }, cur.group),
    h('h3', { id: 'manual-title', tabindex: '-1' }, cur.title),
    h('p', { class: 'lead' }, cur.lead),
    h('ul', { class: 'notes' }, cur.points.map((p) => h('li', null, p))),
    cur.example ? h('div', { class: 'callout info small' }, h('div', null, h('b', null, 'Example. '), cur.example)) : null,
    cur.more?.length ? h('details', { class: 'more' }, h('summary', null, 'The finer rules'), h('ul', { class: 'notes' }, cur.more.map((p) => h('li', null, p)))) : null,
    cur.links?.length ? h('div', { class: 'row', style: 'margin-top:12px;gap:8px' }, cur.links.map(([tab, label]) => h('button', { type: 'button', class: 'btn small', onclick: () => app.openLedger(tab) }, label))) : null,
    h(
      'div',
      { class: 'manual-pager' },
      i > 0 ? h('button', { type: 'button', class: 'btn quiet small', onclick: () => pick(list[i - 1].id) }, `← ${list[i - 1].title}`) : h('span'),
      i < list.length - 1 ? h('button', { type: 'button', class: 'btn quiet small', onclick: () => pick(list[i + 1].id) }, `${list[i + 1].title} →`) : null,
    ),
  );
  return h('div', { class: 'manual' }, index, art);
}
