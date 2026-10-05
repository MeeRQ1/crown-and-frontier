// Fictional place and realm names for generated maps. Each culture is a small
// sound inventory (onsets, middles, endings) with its own flavour; names are
// drawn deterministically from a seeded generator, so a map's seed always
// gives the same names. Every name is checked for length and awkward letter
// runs, and is unique (as written and as an id) within a map.

import { mulberry } from './core';

export interface Culture {
  id: string;
  /** realm titles that suit the culture */
  titles: string[];
  onsets: string[];
  middles: string[];
  endings: string[];
  /** adjective suffixes, tried in order */
  adjective: string[];
  /** endings for realm and region stems ("Vostmark", "Kalmaria") */
  stems: string[];
}

export const CULTURES: Culture[] = [
  {
    id: 'norse',
    titles: ['Jarldom', 'Kingdom', 'Free Towns'],
    onsets: ['Bjor', 'Skal', 'Hraf', 'Thor', 'Ulf', 'Ey', 'Frey', 'Grim', 'Svar', 'Ar', 'Kald', 'Vig', 'Rav', 'Ost', 'Hal', 'Sig', 'Tor', 'Ask', 'Brim', 'Hvit'],
    middles: ['', '', '', 'a', 'e', 'ing', 'ar'],
    endings: ['heim', 'vik', 'fjord', 'by', 'holm', 'stad', 'nes', 'gard', 'sund', 'dal', 'havn', 'oy', 'fell', 'berg'],
    adjective: ['ic', 'ish'],
    stems: ['mark', 'land', 'heim', 'gard', 'vik', 'dal', ''],
  },
  {
    id: 'highland',
    titles: ['Clans', 'Kingdom', 'Lordship'],
    onsets: ['Kil', 'Dun', 'Ard', 'Bal', 'Glen', 'Inver', 'Strath', 'Ach', 'Tull', 'Craig', 'Ben', 'Kin', 'Aber', 'Drum', 'Lochan', 'Car'],
    middles: ['', '', 'a', 'i', 'na'],
    endings: ['more', 'mara', 'lach', 'ness', 'arrow', 'finn', 'lee', 'van', 'ross', 'gal', 'rick', 'ayle', 'lin'],
    adjective: ['ish', 'ian'],
    stems: ['ach', 'ar', 'an', 'more', 'ness', ''],
  },
  {
    id: 'heartland',
    titles: ['Kingdom', 'Duchy', 'Commonwealth'],
    onsets: ['Ash', 'Bel', 'Mont', 'Ros', 'Ver', 'Hol', 'Wes', 'Cor', 'Lor', 'Elm', 'Sor', 'Ham', 'Brack', 'Ather', 'Lang', 'Pem', 'Wil', 'Sand'],
    middles: ['', '', 'e', 'en', 'ing'],
    endings: ['ford', 'mere', 'court', 'vale', 'wick', 'ton', 'by', 'field', 'gate', 'well', 'bury', 'stow', 'leigh', 'mont'],
    adjective: ['ian', 'ish'],
    stems: ['ia', 'land', 'ford', 'mont', 'shire', ''],
  },
  {
    id: 'southern',
    titles: ['Republic', 'Principality', 'League'],
    onsets: ['Al', 'San', 'Val', 'Cas', 'Mon', 'Ver', 'Por', 'Mar', 'Sol', 'Cor', 'Ser', 'Bel', 'Lu', 'Tor', 'Ped', 'Vi', 'Ca', 'Esta'],
    middles: ['', 'a', 'e', 'i', 'o', 'ra'],
    endings: ['ara', 'ena', 'oro', 'ella', 'ano', 'ica', 'ada', 'ino', 'era', 'osa', 'ona', 'ezza', 'ivo', 'aro'],
    adjective: ['ese', 'an'],
    stems: ['ia', 'ona', 'ara', 'ena', 'ezza', ''],
  },
  {
    id: 'eastern',
    titles: ['Grand Duchy', 'Tsardom', 'Voivodeship'],
    onsets: ['Vol', 'Kar', 'Dub', 'Bre', 'Mir', 'Zar', 'Lub', 'Ost', 'Kam', 'Rad', 'Gor', 'Slav', 'Pol', 'Bor', 'Tver', 'Yar', 'Ples'],
    middles: ['', '', 'o', 'e', 'a'],
    endings: ['ovka', 'sk', 'grad', 'ava', 'no', 'ets', 'ik', 'ov', 'ina', 'ice', 'avl', 'mir', 'ez', 'yn'],
    adjective: ['ian', 'ish'],
    stems: ['ia', 'ava', 'ovia', 'in', 'ensk', ''],
  },
  {
    id: 'steppe',
    titles: ['Khanate', 'Horde', 'Confederacy'],
    onsets: ['Ak', 'Kara', 'Ulu', 'Bay', 'Tash', 'Ur', 'Kyz', 'Sar', 'Al', 'Ter', 'Bek', 'Oz', 'Tem', 'Kul', 'Yes', 'Dor', 'Ten'],
    middles: ['', '', 'a', 'i', 'u'],
    endings: ['kul', 'tau', 'bel', 'tai', 'suu', 'kent', 'dar', 'yar', 'sai', 'bek', 'han', 'tash', 'gir', 'ash'],
    adjective: ['i', 'ic'],
    stems: ['tai', 'an', 'ar', 'kul', 'stan', ''],
  },
  {
    id: 'lowland',
    titles: ['Provinces', 'Republic', 'Stadtholderate'],
    onsets: ['Veen', 'Dijk', 'Sluis', 'Moor', 'Wend', 'Reed', 'Holt', 'Gron', 'Zwar', 'Leer', 'Beck', 'Haar', 'Oost', 'Drent', 'Waal', 'Kamp'],
    middles: ['', '', 'e', 'en'],
    endings: ['dam', 'wyk', 'haven', 'mere', 'broek', 'horst', 'um', 'ing', 'sloot', 'veld', 'rode', 'voort', 'hout', 'dorp'],
    adjective: ['ish', 'ic'],
    stems: ['land', 'mark', 'gen', 'dam', ''],
  },
  {
    id: 'classical',
    titles: ['Basileia', 'Archonate', 'League'],
    onsets: ['Ar', 'Kal', 'Mel', 'Dor', 'Ith', 'Kyr', 'Pel', 'Thal', 'Nys', 'Ast', 'Myr', 'Eud', 'Lyk', 'Phar', 'Syr', 'Thes', 'Ago'],
    middles: ['', 'a', 'e', 'i', 'o', 'ra', 'le'],
    endings: ['ion', 'ene', 'os', 'ia', 'ara', 'yra', 'anthe', 'ope', 'is', 'eia', 'ikon', 'ossa', 'aris'],
    adjective: ['ean', 'ian'],
    stems: ['os', 'ia', 'is', 'ene', 'ara', ''],
  },
  {
    id: 'woodland',
    titles: ['Grand Duchy', 'Kingdom', 'Assembly'],
    onsets: ['Kaa', 'Lumi', 'Har', 'Otso', 'Tuu', 'Rev', 'Kal', 'Var', 'Rime', 'Suo', 'Pih', 'Jär', 'Koi', 'Mets', 'Uus', 'Vuo'],
    middles: ['', '', 'a', 'i', 'o'],
    endings: ['ola', 'mos', 'vaara', 'maja', 'likki', 'ari', 'nen', 'joki', 'salo', 'lahti', 'koski', 'mäki', 'harju', 'niemi'],
    adjective: ['ish', 'ian'],
    stems: ['la', 'ia', 'maa', 'nen', 'ri', ''],
  },
];

export const cultureById = (id: string): Culture => CULTURES.find((c) => c.id === id) ?? CULTURES[2];

/** ASCII id of a name (as the map generator derives province ids). */
export function slug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
}

const VOWELS = /[aeiouyäöå]/;

function fine(name: string): boolean {
  if (name.length < 4 || name.length > 13) return false;
  if (/(.)\1\1/.test(name.toLowerCase())) return false; // no triple letters
  if (/[^aeiouyäöå\s'-]{4}/i.test(name)) return false; // no four consonants in a row
  if (/[aeiouyäöå]{3}/i.test(name)) return false; // no three vowels in a row
  return VOWELS.test(name.toLowerCase());
}

/** A deterministic name source for one map: unique names and ids across all cultures. */
export class NameBook {
  private rnd: () => number;
  private used = new Set<string>();
  private usedIds = new Set<string>();

  constructor(seed: number) {
    this.rnd = mulberry(seed);
  }

  private pick<T>(xs: T[]): T {
    return xs[Math.floor(this.rnd() * xs.length)];
  }

  /** Marks a name (and its id) as taken. */
  reserve(name: string): void {
    this.used.add(name);
    this.usedIds.add(slug(name));
  }

  private fresh(make: () => string, tries = 200): string {
    for (let t = 0; t < tries; t++) {
      const n = make();
      if (!fine(n) || this.used.has(n) || this.usedIds.has(slug(n))) continue;
      this.reserve(n);
      return n;
    }
    // fall back to a numbered name rather than fail
    let k = 2;
    const base = make();
    while (this.used.has(`${base} ${roman(k)}`) || this.usedIds.has(slug(`${base}${roman(k)}`))) k++;
    const n = `${base} ${roman(k)}`;
    this.reserve(n);
    return n;
  }

  /** A place name in a culture. */
  place(c: Culture): string {
    return this.fresh(() => {
      const raw = this.pick(c.onsets) + this.pick(c.middles) + this.pick(c.endings);
      return raw[0].toUpperCase() + raw.slice(1).toLowerCase();
    });
  }

  /** Many place names at once. */
  places(c: Culture, n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(this.place(c));
    return out;
  }

  /** A short realm or region stem (two parts, no ending), e.g. "Kalmar". */
  stem(c: Culture): string {
    return this.fresh(() => {
      const end = this.pick(c.stems);
      const mid = end && /^[aeiouy]/.test(end) ? '' : this.pick(c.middles);
      const raw = this.pick(c.onsets) + mid + end;
      return raw[0].toUpperCase() + raw.slice(1).toLowerCase();
    });
  }

  adjectiveOf(stem: string, c: Culture): string {
    const suffix = c.adjective[0];
    const base = /[aeiouy]$/.test(stem) ? stem.slice(0, -1) : stem;
    return base + suffix;
  }

  title(c: Culture): string {
    return this.pick(c.titles);
  }

  /** A name for a geographic feature ("The X Mountains", "Lake X", "The X Sea"…). */
  feature(kind: 'range' | 'lake' | 'river' | 'sea' | 'region' | 'wilds', c: Culture): string {
    const stem = this.stem(c);
    const forms: Record<typeof kind, string[]> = {
      range: [`The ${stem} Mountains`, `The ${stem}spine`, `The ${stem} Fells`, `The ${stem} Teeth`, `The ${stem} Heights`],
      lake: [`Lake ${stem}`, `${stem}mere`, `${stem} Water`],
      river: [`${stem}`, `${stem}water`, `${stem} River`],
      sea: [`The ${stem} Sea`, `${stem} Bight`, `The Gulf of ${stem}`, `The ${stem} Main`, `${stem} Sound`],
      region: [`${stem} Marches`, `${stem} Uplands`, `${stem} Lowlands`, `${stem} Coast`, `${stem} Vale`, `${stem} Wolds`, `${stem} Plains`, `${stem} Reach`],
      wilds: [`The ${stem} Wilds`, `The ${stem} Barrens`, `The ${stem} Marchlands`, `The ${stem} Waste`],
    };
    const options = forms[kind].filter((f) => !this.used.has(f));
    const name = options.length ? this.pick(options) : `${forms[kind][0]} ${roman(2)}`;
    this.used.add(name);
    return name;
  }
}

function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);
}
