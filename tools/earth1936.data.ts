// Authored data for "The World, 1936" (tools/genreal.ts): the whole world on
// 1 January 1936. The geography is the World 1914 map's (tools/earth.data.ts):
// the same frame, projection, province density, climate zones, ridges, passes,
// straits, lakes, rivers, seas and deposits; Europe and the Near East are
// classified by the Europe 1936 map (tools/europe1936.data.ts). This file
// holds what changed between 1914 and 1936:
//  - the sovereign states of 1936 (Saudi Arabia, Yemen, Manchukuo, the
//    Mongolian People's Republic, Iraq, Egypt, the new states of Europe) and
//    the colonies and mandates each held: the German colonies divided as
//    League mandates (Tanganyika, Cameroons and Togoland, South West Africa,
//    Ruanda-Urundi, New Guinea, Samoa, the South Seas), Jubaland in Italian
//    Somaliland, Tacna returned to Peru (1929), Leticia to Colombia (1934);
//  - the names of 1936 (Peiping, Hsinking, Stalinabad, Frunze, Alma-Ata…) and
//    town populations of about 1936, which place the cities and set regional wealth.
// Simplifications, stated in the map's description and docs/atlas/MAPS.md:
//  - borders follow present-day first-level divisions, approximating those of
//    1936 where they differ (the Chaco after the armistice of 1935, the
//    Ecuador-Peru line, Jehol in Manchukuo);
//  - the Italo-Ethiopian war (from October 1935) cannot be a starting war:
//    Ethiopia is independent and Italy claims it;
//  - China's warlord provinces (Sinkiang, Tsinghai, the south-west) and the
//    Communist base in Shensi are drawn as Nationalist China's; Tannu Tuva, a
//    Soviet satellite, is drawn as Soviet; Iceland (in personal union with
//    Denmark) is drawn as Danish; Luxembourg (in economic union with Belgium)
//    as Belgian; Newfoundland (under a British commission since 1934) as British;
//  - protectorates and dependencies are drawn as their protector's land, as on
//    the 1914 map (the Indian princely states, Bhutan, the Gulf sheikhdoms,
//    Morocco and Tunisia); Hong Kong and Macau are drawn with the land around them;
//  - the Bering Strait lies on the map's seam and has no crossing.

import type { NationDef } from '../src/sim/types';
import {
  BIOME,
  BOX,
  BY_GROUP,
  BY_LAND as BY_LAND_1914,
  COLONY as COLONY_1914,
  DEPOSIT_HINTS,
  EUROPE,
  HELD as HELD_1914,
  INDONESIA,
  ISLAND_NAMES,
  LAKES,
  LAND_SPARSE as SPARSE_1914,
  NAMES as NAMES_1914,
  NATIONS as NATIONS_1914,
  NOT_YET as NOT_YET_1914,
  OVERSEAS,
  OVERSEAS_LAND,
  PASSES,
  PERIOD as PERIOD_1914,
  PROV_KM2,
  RIDGES,
  RIVERS,
  SEAS,
  STRAITS,
  THAI,
  TOWNS as TOWNS_1914,
  WEALTH as WEALTH_1914,
  regionNamer,
  zoneOf,
} from './earth.data';
import { NAMES as EU14_NAMES, NOT_YET as EU14_NOT_YET, inList } from './europe.data';
import { CAPITALS as EU_CAPITALS, CLAIMS_1936, NAMES as EU_NAMES, NATIONS as EU_NATIONS, NOT_YET as EU_NOT_YET, REGIONS as EU_REGIONS, TREATIES_1936, classify as euClassify } from './europe1936.data';
import { equalEarth, type Division, type RealMapDef } from './realmap';

type Arms = NonNullable<NationDef['arms']>;
const arms = (field: string, ordinary: string, ordinaryTincture: string, charge: string, chargeTincture: string): Arms => ({ field, ordinary, ordinaryTincture, charge, chargeTincture });

const nation = (id: string, name: string, short: string, adjective: string, color: string, capital: string, personality: NationDef['personality'], a: Arms, summary: string, strength: string, constraint: string, traits: NationDef['traits'], startType: string, rating: NationDef['rating']): NationDef => ({
  id,
  name,
  short,
  adjective,
  color,
  capital,
  personality,
  emblem: a.charge === 'none' ? 'crown' : a.charge,
  summary,
  strength,
  constraint,
  traits,
  startType,
  rating,
  arms: a,
});

/** A realm of the World 1914 map that carries on in 1936, with what changed. */
const was = (id: string, over: Partial<NationDef> = {}): NationDef => ({ ...NATIONS_1914.find((n) => n.id === id)!, ...over });

// ───────────────────────────── realms ──────────────────────────────────────

/** The realms of the Europe map drawn as part of a neighbour on a world map. */
const FOLD: Record<string, string> = { lux: 'bel' };
/** Realms of the Europe map whose summaries a world map widens to their empires. */
const IMPERIAL: Record<string, Partial<NationDef>> = {
  gbr: { summary: 'The largest empire on earth: the British Isles, India and Burma, half of Africa, the mandates of Palestine, Transjordan and Tanganyika, Malaya and the Caribbean, rearming slowly after the Abyssinian crisis.', constraint: 'A small army for the largest empire, spread over every continent.' },
  fra: { summary: 'The Third Republic behind the Maginot Line, with the second colonial empire: North and West Africa, Madagascar, Indochina and the mandates of Syria, Lebanon, Cameroun and Togo.' },
  ita: { summary: 'Mussolini’s kingdom, at war in Ethiopia and under League sanctions, with Libya, Eritrea, Somaliland and the Dodecanese.' },
  spa: { summary: 'The Second Republic, months before its civil war and divided between left and right, with the Moroccan protectorate, Ifni, Río de Oro and Spanish Guinea.' },
  por: { summary: 'Salazar’s Estado Novo, Britain’s oldest ally, ruling Angola, Mozambique, Guinea and Timor.' },
  ned: { summary: 'A rich trading kingdom of ports and polders, neutral between Britain and Germany, and master of the East Indies and Surinam.', strength: 'Commerce and the spice islands: trade and income above its size.' },
  bel: { summary: 'An industrial kingdom under Leopold III, allied with France, ruling the Congo and the mandate of Ruanda-Urundi; Luxembourg, in economic union with it, is drawn with it.' },
  den: { summary: 'A farming kingdom at the Baltic straits, with Greenland and the Faroes, and Iceland in personal union under its king.' },
  sov: { summary: 'Stalin’s union of republics from the Dniester to the Pacific, in its second five-year plan, newly in the League and allied with Czechoslovakia and Mongolia; Tannu Tuva is drawn with it.', constraint: 'Purges and immense distances: research and integration are slow.' },
};

export const NATIONS: NationDef[] = [
  ...EU_NATIONS.filter((n) => !(n.id in FOLD)).map((n) => ({ ...n, ...(IMPERIAL[n.id] ?? {}) })),
  was('afg', { name: 'Kingdom of Afghanistan', summary: 'The mountain kingdom of Zahir Shah, between the Soviet Union and British India.' }),
  nation('sau', 'Kingdom of Saudi Arabia', 'Saudi Arabia', 'Saudi', '#6f8f4f', 'riyadh', 'expansionist', arms('vert', 'bend', 'argent', 'none', 'argent'), 'Ibn Saud’s kingdom of Najd and the Hejaz, united in 1932, keeper of Mecca and Medina, with an American oil concession in Hasa.', 'Desert warriors: cavalry strikes hard.', 'Sand and few people: no industry, little income.', { cavalryAttackAdd: 0.1, moraleAdd: 0.3, incomeMul: -0.25 }, 'Desert kingdom', 'challenging'),
  nation('yem', 'Mutawakkilite Kingdom of Yemen', 'Yemen', 'Yemeni', '#b07a9a', 'sanaa', 'defensive', arms('gules', 'none', 'gules', 'star', 'argent'), 'The highland kingdom of Imam Yahya, independent since the Ottomans left in 1918 and at peace with Saudi Arabia since the treaty of Taif (1934).', 'Mountain strongholds: forts are cheap and defenders fight well.', 'Isolated and poor.', { fortCostMul: -0.2, moraleAdd: 0.2, incomeMul: -0.25 }, 'Mountain realm', 'challenging'),
  was('omn'),
  was('nep'),
  was('chn', { capital: 'nanking', summary: 'Chiang Kai-shek’s Nationalist China, governing from Nanking and fighting the Communists, with warlords in the provinces and Japan pressing on the north.', constraint: 'Warlords and foreign concessions: income, research and integration are weak.' }),
  nation('man', 'Empire of Manchukuo', 'Manchukuo', 'Manchurian', '#8a6aa0', 'hsinking', 'defensive', arms('or', 'chief', 'gules', 'star', 'sable'), 'The state Japan made of Manchuria and Jehol in 1932, under the last Qing emperor Puyi and the Kwantung Army.', 'Coal, iron and soybeans, and Japanese capital: supply flows.', 'A puppet few recognise: land integrates slowly and others distrust it.', { supplyProdMul: 0.1, integrationMul: -0.25, opinionAdd: -10 }, 'Puppet empire', 'challenging'),
  was('tib', { summary: 'The Dalai Lama’s state on the roof of the world, independent in fact since 1913 and ruled by a regent since 1934.' }),
  was('mgl', { name: 'Mongolian People’s Republic', capital: 'ulanbator', personality: 'defensive', summary: 'The first Soviet satellite, on the steppe between the Soviet Union, China and Manchukuo, under the protection of the Red Army.' }),
  was('jpn', { summary: 'An island empire under rising military influence, master of Korea, Formosa and the South Seas mandate, with its creature Manchukuo on the continent; it has left the League and the naval treaties.' }),
  was('sia', { summary: 'The only kingdom of South-East Asia to keep its independence, a constitutional monarchy since the revolution of 1932, between British Burma and French Indochina.' }),
  was('eth', { summary: 'The ancient highland empire of Haile Selassie, invaded by Italy in October 1935 and fighting on in Tigray and the Ogaden.' }),
  was('lbr', { summary: 'A small republic on the Grain Coast, independent since 1847 and dependent on Firestone’s rubber.' }),
  was('saf', { summary: 'The dominion of the Cape, Natal, the Transvaal and the Orange Free State, rich in gold, governing the mandate of South West Africa.' }),
  was('usa', { summary: 'The largest industrial economy in the world, still in the Depression under Roosevelt’s New Deal and neutral by law, with the Philippines, Hawaii, Alaska and the Panama Canal.', constraint: 'A small standing army and a public set on neutrality.' }),
  was('can', { summary: 'A dominion free in its foreign policy since the Statute of Westminster (1931), from the Atlantic to the Pacific, its prairies hit by drought and depression.' }),
  was('mex', { summary: 'The republic of Cárdenas after the revolution: land reform, the oil fields of the Gulf and a quarrel with the foreign oil companies.', constraint: 'Restless provinces after twenty years of revolution.', traits: { supplyProdMul: 0.1, integrationMul: -0.15, incomeMul: -0.1 }, startType: 'Revolutionary republic' }),
  was('gua', { summary: 'The largest of the Central American republics, under the dictatorship of Ubico.' }),
  was('hon', { summary: 'A republic of banana coasts under Carías, where the fruit companies make and unmake governments.' }),
  was('sal', { summary: 'The smallest and most crowded Central American republic, under General Martínez since the massacre of 1932.' }),
  was('nic', { summary: 'A republic of lakes and volcanoes, left by the American marines in 1933 and dominated by Somoza’s National Guard.', constraint: 'A weak government.' }),
  was('cri'),
  was('pan', { summary: 'The isthmus republic beside the canal the United States runs.' }),
  was('cub', { summary: 'An island republic of sugar, under Batista’s influence since the revolution of 1933 and the eye of the United States.' }),
  was('hai', { summary: 'The first black republic, left by the American marines in 1934.' }),
  was('dom', { summary: 'The eastern republic of Hispaniola under Trujillo’s dictatorship.' }),
  was('col', { summary: 'An Andean republic of coffee under the Liberals, which kept Leticia after its war with Peru in 1932–33.' }),
  was('ven', { summary: 'The oil republic of the Maracaibo basin, freed by Gómez’s death in December 1935 from twenty-seven years of his rule.' }),
  was('ecu', { summary: 'The republic on the equator, between the cacao coast and the volcanoes of the Andes, in dispute with Peru over the Amazon.' }),
  was('pru', { summary: 'The old viceroyalty of the Andes under Benavides, which regained Tacna in 1929 and gave up Leticia in 1934.' }),
  was('bra', { summary: 'The giant of South America under Vargas, a federal republic of coffee and rubber reaching deep into the Amazon.' }),
  was('bol', { summary: 'A landlocked republic of the high Andes, rich in tin, beaten by Paraguay in the Chaco War and still claiming the Chaco.' }),
  was('par', { summary: 'A small river republic, victorious in the Chaco War and holding most of the Chaco under the armistice of 1935.' }),
  was('uru', { summary: 'A small, prosperous republic of cattle and reforms on the River Plate, under Terra.' }),
  was('arg', { summary: 'One of the richest countries in the world, exporting wheat and beef through Buenos Aires, ruled by the conservative Concordancia.' }),
  was('chi', { summary: 'The long republic of the Pacific coast, recovering from the collapse of nitrate, with a strong navy.' }),
  was('ast', { capital: 'canberra', summary: 'A federation of six states, its parliament in Canberra since 1927, governing Papua and the mandates of New Guinea and Nauru.' }),
  was('nzl', { summary: 'The southernmost dominion, newly under its first Labour government, governing the mandate of Western Samoa.' }),
];

export const CAPITALS: Record<string, [string, string]> = {
  ...Object.fromEntries(Object.entries(EU_CAPITALS).filter(([id]) => !(id in FOLD))),
  afg: ['Kabul', 'AFG'],
  sau: ['Riyadh', 'SAU'],
  yem: ['Sanaa', 'YEM'],
  omn: ['Muscat', 'OMN'],
  nep: ['Kathmandu', 'NPL'],
  chn: ['Nanjing', 'CHN'],
  man: ['Changchun', 'CHN'],
  tib: ['Lhasa', 'CHN'],
  mgl: ['Ulaanbaatar', 'MNG'],
  jpn: ['Tokyo', 'JPN'],
  sia: ['Bangkok', 'THA'],
  eth: ['Addis Ababa', 'ETH'],
  lbr: ['Monrovia', 'LBR'],
  saf: ['Pretoria', 'ZAF'],
  usa: ['Washington, D.C.', 'USA'],
  can: ['Ottawa', 'CAN'],
  mex: ['Mexico City', 'MEX'],
  gua: ['Guatemala City', 'GTM'],
  hon: ['Tegucigalpa', 'HND'],
  sal: ['San Salvador', 'SLV'],
  nic: ['Managua', 'NIC'],
  cri: ['San José', 'CRI'],
  pan: ['Panama City', 'PAN'],
  cub: ['Havana', 'CUB'],
  hai: ['Port-au-Prince', 'HTI'],
  dom: ['Santo Domingo', 'DOM'],
  col: ['Bogota', 'COL'],
  ven: ['Caracas', 'VEN'],
  ecu: ['Quito', 'ECU'],
  pru: ['Lima', 'PER'],
  bra: ['Rio de Janeiro', 'BRA'],
  bol: ['La Paz', 'BOL'],
  par: ['Asunción', 'PRY'],
  uru: ['Montevideo', 'URY'],
  arg: ['Buenos Aires', 'ARG'],
  chi: ['Santiago', 'CHL'],
  ast: ['Canberra', 'AUS'],
  nzl: ['Wellington', 'NZL'],
};

// ───────────────────────────── 1936 ownership ──────────────────────────────

const EU_REALM = new Map(EU_REGIONS.map((r) => [r.id, r.realm]));
const EU_NAME = new Map(EU_REGIONS.map((r) => [r.id, r.name]));
const fold = (realm: string) => FOLD[realm] ?? realm;

/** Colonies, mandates and states outside Europe: the realm that held them on 1 January 1936. */
const HELD: Record<string, string> = {
  ...HELD_1914,
  // the German colonies, as League mandates
  TGO: 'fra', CMR: 'fra', NAM: 'saf', RWA: 'bel', BDI: 'bel', WSM: 'nzl', NRU: 'ast', MNP: 'jpn', PLW: 'jpn', FSM: 'jpn', MHL: 'jpn',
  // the Soviet Union in Asia
  KAZ: 'sov', UZB: 'sov', TKM: 'sov', KGZ: 'sov', TJK: 'sov',
  IRN: 'irn', VIR: 'usa', ISL: 'den', GRL: 'den', FRO: 'den',
};

export function realmOf(d: Division, lon: number, lat: number): string | null | undefined {
  const n = d.name;
  switch (d.adm0) {
    case 'RUS': {
      // southern Sakhalin (Karafuto) and the Kurils were Japanese
      if (n === 'Sakhalin') return lon > 145.5 || lat < 50 ? 'jpn' : 'sov';
      // the Europe map's frontiers: East Prussia, the Karelian Isthmus, Petsamo, Petseri and Abrene
      const r = euClassify(d, lon, lat);
      return r ? fold(EU_REALM.get(r)!) : 'sov';
    }
    case 'NOR':
      // Svalbard has been Norwegian since 1925 (the treaty of 1920)
      if (inList(n, 'Svalbard|Jan Mayen')) return 'nor';
      if (n === 'Bouvet Island') return null;
      break;
    case 'MAR':
      // Cape Juby, south of the Draa, and Ifni (occupied in 1934) were Spanish
      if (lat < 27.67 || (lon < -9.75 && lon > -10.5 && lat > 29.05 && lat < 29.65)) return 'spa';
      break;
    case 'SAU':
      return 'sau';
    case 'YEM':
      return inList(n, "`Adan|Lahij|Abyan|Al Dali'|Shabwah|Hadramawt|Al Mahrah") ? 'gbr' : 'yem';
    case 'TZA':
    case 'GHA':
      // Tanganyika and British Togoland (with the Gold Coast) were British mandates
      return 'gbr';
    case 'CMR':
      // the British Cameroons (the Southern Cameroons; the north joined Nigeria in 1961)
      return inList(n, 'Nord-Ouest|Sud-Ouest') ? 'gbr' : 'fra';
    case 'PNG':
      return 'ast';
    case 'CHN':
      if (n === 'Xizang') return 'tib';
      if (n === 'Paracel Islands') return null;
      // Manchukuo: the three north-eastern provinces, Jehol and the eastern Mongol banners
      if (inList(n, 'Heilongjiang|Jilin|Liaoning') || (n === 'Inner Mongol' && lon > 117) || (n === 'Hebei' && lat > 40.4 && lon > 116.6)) return 'man';
      return 'chn';
    case 'CAN':
      // Newfoundland, under a commission of government from London since 1934, is drawn as British
      return n === 'Newfoundland and Labrador' ? 'gbr' : 'can';
    case 'ESP':
      if (n === 'Canarias' || d.group === 'Canarias') return 'spa';
      break;
    case 'KWT':
      return 'gbr';
    case 'PER':
      return 'pru';
  }
  if (EUROPE.has(d.adm0)) {
    const r = euClassify(d, lon, lat);
    if (r === undefined) return undefined;
    if (r === null) return OVERSEAS[d.adm0] ?? null;
    return fold(EU_REALM.get(r)!);
  }
  if (d.adm0 in HELD) return HELD[d.adm0];
  // uninhabited outposts and the far southern islands
  if (inList(d.adm0, 'ATA|ATF|HMD|SGS|BVT|IOT|IOA|ATC|CSI|CLP|PGA|KAS|KAB|UMI|PCN|NFK|COK|NIU|TKL|WLF|TUV|SPM|AIA|ATG|DMA|GRD|KNA|LCA|VCT|MSR|VGB|ABW|CUW|SXM|BLM|MAF|BES')) return null;
  return undefined;
}

// ───────────────────────────── lands and region names ──────────────────────

/** Europe-map regions grouped into the lands a world map divides further. */
const EU_LAND: Record<string, string> = {
  egypt: 'Egypt', sinai: 'Egypt', westerndesert: 'Egypt', cyprus: 'Cyprus', malta: 'Malta', palestine: 'Palestine', transjordan: 'Transjordan',
  algiers: 'Algeria', oran: 'Algeria', constantine: 'Algeria', algsahara: 'Algeria', tunis: 'Tunisia', southtunisia: 'Tunisia',
  fez: 'Morocco', rabat: 'Morocco', marrakesh: 'Morocco', oriental: 'Morocco', spmorocco: 'Spanish Morocco',
  aleppo: 'Syria and Lebanon', syria: 'Syria and Lebanon', beirut: 'Syria and Lebanon', zor: 'Syria and Lebanon', alexandretta: 'Syria and Lebanon',
  tripolitania: 'Libya', cyrenaica: 'Libya', dodecanese: 'Dodecanese',
  georgia: 'Caucasus', erivan: 'Caucasus', baku: 'Caucasus', terek: 'Caucasus', kuban: 'Caucasus', stavropol: 'Caucasus',
  minsk: 'Byelorussia', vitebsk: 'Byelorussia', mogilev: 'Byelorussia',
  zhitomir: 'Ukraine', podolia: 'Ukraine', kiev: 'Ukraine', chernigov: 'Ukraine', poltava: 'Ukraine', donets: 'Ukraine', ekaterinoslav: 'Ukraine', kherson: 'Ukraine', taurida: 'Ukraine',
};
const REALM_LAND: Record<string, string> = {
  gbr: 'Britain', irl: 'Ireland', fra: 'France', ger: 'Germany', ita: 'Italy', sov: 'Russia', pol: 'Poland', cze: 'Czechoslovakia', aut: 'Austria', hun: 'Hungary', rom: 'Romania', yug: 'Yugoslavia', bul: 'Bulgaria', gre: 'Greece', alb: 'Albania', tur: 'Turkey',
  spa: 'Spain', por: 'Portugal', ned: 'Netherlands', bel: 'Belgium', swi: 'Switzerland', den: 'Denmark', swe: 'Sweden', nor: 'Norway', fin: 'Finland', est: 'Estonia', lat: 'Latvia', lit: 'Lithuania', egy: 'Egypt', irq: 'Iraq', irn: 'Iran',
};

const euCache = new Map<string, string | null | undefined>();
/** The Europe-map region of a division, at its label point (for grouping and naming); Russia's European oblasts too. */
function euRegionOf(d: Division): string | null | undefined {
  if (!EUROPE.has(d.adm0) && d.adm0 !== 'RUS') return undefined;
  const key = String(d.props.adm1_code);
  if (!euCache.has(key)) euCache.set(key, euClassify(d, Number(d.props.longitude), Number(d.props.latitude)));
  return euCache.get(key);
}

/** Lands named after the country, colony or mandate of 1936. */
const COLONY: Record<string, string> = {
  ...COLONY_1914,
  TGO: 'French Togoland', NAM: 'South West Africa', ETH: 'Ethiopia', MLI: 'French Sudan', BFA: 'French Sudan', NER: 'Niger Colony', KEN: 'Kenya', RWA: 'Ruanda-Urundi', BDI: 'Ruanda-Urundi',
  MNP: 'South Seas Mandate', PLW: 'South Seas Mandate', FSM: 'South Seas Mandate', MHL: 'South Seas Mandate', NRU: 'Nauru', WSM: 'Western Samoa', VIR: 'Virgin Islands', IRN: 'Iran',
};

/** The land a division's regions stay within: a colony, a country, or a part of a large realm. */
export function landOf(d: Division, realm: string): string {
  const n = d.name;
  const eu = euRegionOf(d);
  // a division the Europe map gives to another realm (Cape Juby, southern Sakhalin…) is grouped by its own realm here
  if (eu && fold(EU_REALM.get(eu)!) === realm) return EU_LAND[eu] ?? REALM_LAND[realm] ?? realm;
  switch (d.adm0) {
    case 'FRA':
    case 'ESP':
    case 'PRT':
      if (!eu) return OVERSEAS_LAND[d.group] ?? OVERSEAS_LAND[n] ?? (d.group || n);
      break;
    case 'RUS':
      if (realm === 'jpn') return 'Karafuto';
      if (realm !== 'sov') return REALM_LAND[realm] ?? realm;
      return d.group === 'Far Eastern' ? 'Soviet Far East' : d.group === 'Siberian' || d.group === 'Urals' ? 'Siberia' : 'Russia';
    case 'KAZ':
      return 'Kazakhstan';
    case 'UZB':
    case 'TKM':
    case 'KGZ':
    case 'TJK':
      return 'Central Asia';
    case 'IRN':
      return 'Iran';
    case 'SAU':
      if (n === 'Ash Sharqiyah') return 'Hasa';
      if (inList(n, "Ar Riyad|Al Quassim|Ha'il|Al Jawf|Al Hudud ash Shamaliyah")) return 'Najd';
      return inList(n, '`Asir|Jizan|Najran') ? 'Asir' : 'Hejaz';
    case 'YEM':
      return realm === 'gbr' ? 'Aden' : 'Yemen';
    case 'USA':
      if (n === 'Alaska') return 'Alaska';
      if (n === 'Hawaii') return 'Hawaii';
      return { Northeast: 'Northeast', Midwest: 'Midwest', South: 'South', West: 'West' }[d.group] ?? 'Northeast';
    case 'CAN':
      if (realm === 'gbr') return 'Newfoundland';
      return d.group === 'Western Canada' ? 'Western Canada' : d.group === 'Northern Canada' ? 'Northern Territories' : 'Eastern Canada';
    case 'CHN':
      if (realm === 'tib') return 'Tibet';
      if (realm === 'man') return 'Manchukuo';
      if (n === 'Inner Mongol') return 'Inner Mongolia';
      if (n === 'Xinjiang') return 'Sinkiang';
      if (n === 'Qinghai') return 'Tsinghai';
      return 'China Proper';
    case 'HKG':
    case 'MAC':
      return 'China Proper';
    case 'TWN':
      return 'Formosa';
    case 'KOR':
    case 'PRK':
      return 'Korea';
    case 'JPN':
      return 'Japan';
    case 'IND':
    case 'PAK':
    case 'BGD':
    case 'BTN':
      return 'British India';
    case 'LKA':
    case 'MDV':
      return 'Ceylon';
    case 'MMR':
      return 'Burma';
    case 'VNM':
      return inList(d.group, 'Tây Bắc|Đông Bắc|Ðông B?c|Đồng Bằng Sông Hồng') ? 'Tonkin' : inList(d.group, 'Đông Nam Bộ|đồng bằng sông Cửu Long') ? 'Cochinchina' : 'Annam';
    case 'MYS':
      return inList(n, 'Sabah|Labuan') ? 'North Borneo' : n === 'Sarawak' ? 'Sarawak' : 'Malaya';
    case 'SGP':
      return 'Malaya';
    case 'BRN':
      return 'Sarawak';
    case 'IDN':
      return INDONESIA.find(([, re]) => re.test(n))![0];
    case 'PNG':
      // the former German colony, an Australian mandate since 1920; Papua, Australian since 1906
      return inList(n, 'Morobe|Madang|East Sepik|Sandaun|Manus|New Ireland|East New Britain|West New Britain|North Solomons') ? 'New Guinea' : 'Papua';
    case 'TZA':
      return inList(n, 'Zanzibar South and Central|Kaskazini-Unguja|Zanzibar West|Kusini-Pemba|Kaskazini-Pemba') ? 'Zanzibar' : 'Tanganyika';
    case 'GHA':
      return 'Gold Coast';
    case 'CMR':
      return realm === 'gbr' ? 'British Cameroons' : 'French Cameroun';
    case 'SDN':
    case 'SDS':
      return 'Sudan';
    case 'SOM':
      return 'Italian Somaliland';
    case 'ZAF':
      return 'South Africa';
    case 'PER':
      return 'Peru';
    case 'MAR':
      return 'Río de Oro';
  }
  // a division the Europe map gives to a neighbour at its label point (Funen, Kavala): its realm's European land
  return COLONY[d.adm0] ?? (EUROPE.has(d.adm0) ? REALM_LAND[realm] : undefined) ?? d.adm0;
}

/** Present-day divisions → the province, oblast or territory of 1936 they lay in (or its name then). */
const PERIOD: Record<string, string> = {
  ...PERIOD_1914,
  // China: Chihli became Hopei in 1928; the new provinces of 1928; Manchukuo's Jehol and Hsingan
  'CHN/Hebei': 'Hopei', 'CHN/Beijing': 'Hopei', 'CHN/Tianjin': 'Hopei', 'CHN/Qinghai': 'Tsinghai', 'CHN/Ningxia': 'Ningsia', 'CHN/Inner Mongol': 'Suiyuan and Chahar', 'CHN/Jehol': 'Jehol', 'CHN/Hsingan': 'Hsingan',
  // the Soviet Union in Asia: the oblasts, krais and republics of 1936
  'RUS/Sverdlovsk': 'Sverdlovsk', 'RUS/Chelyabinsk': 'Chelyabinsk', 'RUS/Kurgan': 'Chelyabinsk', "RUS/Tyumen'": 'Omsk', 'RUS/Khanty-Mansiy': 'Ostyak-Vogul', 'RUS/Yamal-Nenets': 'Yamal', 'RUS/null': 'Yamal', 'RUS/Omsk': 'Omsk', 'RUS/Novosibirsk': 'West Siberia', 'RUS/Tomsk': 'West Siberia', 'RUS/Kemerovo': 'Kuzbass', 'RUS/Altay': 'Altai', 'RUS/Gorno-Altay': 'Oirot', 'RUS/Krasnoyarsk': 'Krasnoyarsk', 'RUS/Khakass': 'Khakassia', 'RUS/Tuva': 'Tannu Tuva', 'RUS/Irkutsk': 'East Siberia', 'RUS/Buryat': 'Buryat-Mongolia', 'RUS/Chita': 'Chita', 'RUS/Sakha (Yakutia)': 'Yakutia', 'RUS/Amur': 'Amur', 'RUS/Yevrey': 'Birobidzhan', 'RUS/Khabarovsk': 'Khabarovsk', "RUS/Primor'ye": 'Primorye', 'RUS/Maga Buryatdan': 'Kolyma', 'RUS/Chukchi Autonomous Okrug': 'Chukotka', 'RUS/Kamchatka': 'Kamchatka', 'RUS/Sakhalin': 'Sakhalin',
  'KAZ/West Kazakhstan': 'West Kazakhstan', 'KAZ/Atyrau': 'West Kazakhstan', 'KAZ/Mangghystau': 'West Kazakhstan', 'KAZ/Aqtöbe': 'Aktyubinsk', 'KAZ/Qostanay': 'Kustanai', 'KAZ/North Kazakhstan': 'North Kazakhstan', 'KAZ/Aqmola': 'Karaganda', 'KAZ/Astana': 'Karaganda', 'KAZ/Qaraghandy': 'Karaganda', 'KAZ/Pavlodar': 'East Kazakhstan', 'KAZ/East Kazakhstan': 'East Kazakhstan', 'KAZ/Almaty': 'Alma-Ata', 'KAZ/Almaty City': 'Alma-Ata', 'KAZ/Zhambyl': 'South Kazakhstan', 'KAZ/South Kazakhstan': 'South Kazakhstan', 'KAZ/Qyzylorda': 'South Kazakhstan',
  'UZB/': 'Uzbekistan', 'TKM/': 'Turkmenistan', 'KGZ/': 'Kirghizia', 'TJK/': 'Tajikistan',
  // the Americas: Tacna Peruvian again, Arica in Chile's Tarapacá; Quintana Roo a territory again (1935)
  'CHL/Arica y Parinacota': 'Tarapacá', 'MEX/Quintana Roo': 'Quintana Roo',
};
const periodName = (d: Division): string => {
  const hit = PERIOD[`${d.adm0}/${d.name}`] ?? PERIOD[`${d.adm0}/`];
  if (hit) return hit;
  const eu = euRegionOf(d);
  if (eu) return EU_NAME.get(eu)!;
  if (d.adm0 === 'PHL') {
    const lat = Number(d.props.latitude);
    const lon = Number(d.props.longitude);
    return lat > 12.6 ? 'Luzon' : lat > 9.3 || (lon < 123.6 && lat > 8.4) ? 'Visayas' : 'Mindanao';
  }
  if (d.adm0 === 'THA') return THAI[d.group] ?? 'Central Siam';
  if (BY_GROUP.has(d.adm0) && d.group) return d.group;
  if (d.adm0 === 'KOR' || d.adm0 === 'PRK') return 'Korea';
  return d.name;
};

/** Lands whose regions are named after the land alone (one name, with directions where there are several). */
const BY_LAND = new Set([
  ...[...BY_LAND_1914].filter((l) => !inList(l, 'Kamerun|German East Africa|German South West Africa|Kaiser-Wilhelmsland|Togoland|Jabal Shammar|Steppe|Turkestan|Abyssinia|Upper Senegal and Niger|British East Africa|Niger Territory|Kokonor')),
  'French Cameroun', 'British Cameroons', 'Tanganyika', 'Ruanda-Urundi', 'South West Africa', 'New Guinea', 'French Togoland', 'Kenya', 'Ethiopia', 'French Sudan', 'Niger Colony', 'Tsinghai', 'Palestine', 'Transjordan',
]);

const baseRegionName = regionNamer(periodName, BY_LAND);
/** Manchukuo's share of Hopei and Inner Mongolia is Jehol and Hsingan. */
export function regionName(land: string, realm: string, divisions: Division[], single: boolean, shares: number[], capital?: number): string {
  const divs = realm === 'man' ? divisions.map((d) => (d.name === 'Hebei' ? { ...d, name: 'Jehol' } : d.name === 'Inner Mongol' ? { ...d, name: 'Hsingan' } : d)) : divisions;
  return baseRegionName(land, realm, divs, single, shares, capital);
}

// ───────────────────────────── density and wealth ──────────────────────────

/** How thinly settled each land was: its provinces are this many times the standard area. */
const LAND_SPARSE: Record<string, number> = {
  ...SPARSE_1914,
  Austria: 0.26, Hungary: 0.26, Czechoslovakia: 0.26, Poland: 0.26, Yugoslavia: 0.3, Russia: 0.5, Ukraine: 0.36, Byelorussia: 0.4, Turkey: 0.45, Estonia: 0.36, Latvia: 0.36, Lithuania: 0.36,
  'Syria and Lebanon': 0.6, Palestine: 0.5, Transjordan: 1.2, Iran: 1.2,
  Kazakhstan: 2.4, 'Central Asia': 1.3, 'Soviet Far East': 5, Manchukuo: 0.9, Tsinghai: 3.5, 'New Guinea': 2.8,
};
const sparseOf = (land: string, lat: number, lon: number): number => {
  // the African colonies and other lands not listed
  let s = LAND_SPARSE[land] ?? 2;
  const z = zoneOf(lat, lon);
  if (z === 'desert') s = Math.max(s * 1.8, 2.2);
  else if (z === 'rainforest') s *= 1.5;
  else if (z === 'polar') s = Math.max(s * 2.5, 3);
  else if (z === 'boreal' && s < 1.5) s *= 1.6;
  else if (z === 'river') s = Math.min(s, 0.5);
  return Math.min(s, 9);
};

/** Regional wealth about 1936, relative to western Europe: scales town populations for density. */
const WEALTH: Record<string, number> = {
  ...WEALTH_1914,
  GBR: 1.15, USA: 1.2, CAN: 1, JPN: 0.75, RUS: 0.55, UKR: 0.5, BLR: 0.45, FIN: 0.65, SWE: 1, NOR: 0.9, DNK: 1.05, CZE: 0.85, AUT: 0.75, POL: 0.5, ITA: 0.7, ESP: 0.55, PRT: 0.45, IRL: 0.65, ARG: 0.8, MEX: 0.4, BRA: 0.4, CUB: 0.45, ZAF: 0.65,
};
const wealthOf = (adm0: string, lon: number, lat: number): number => {
  if (adm0 in WEALTH) return WEALTH[adm0];
  if (lat > 35 && lon > -25 && lon < 45) return 0.55; // the rest of Europe
  if (lon < -30) return 0.35; // the Americas
  if (lat < 35 && lon < 52 && lon > -25) return 0.14; // Africa
  return 0.25; // Asia and the Pacific
};

// ───────────────────────────── towns about 1936 ────────────────────────────

/**
 * Towns of about 1936 (Natural Earth name, country, population in thousands),
 * from the censuses of the early 1930s (city or agglomeration as each census
 * counted it); towns not listed grow from their 1914 figure by their country's
 * urban growth since.
 */
const TOWNS: Array<[string, string, number, number?]> = [
  // Europe and the Near East
  ['London', 'GBR', 8400], ['Berlin', 'DEU', 4240], ['Paris', 'FRA', 2830], ['Moscow', 'RUS', 3600], ['St. Petersburg', 'RUS', 2900], ['Vienna', 'AUT', 1870], ['Hamburg', 'DEU', 1130], ['Budapest', 'HUN', 1050], ['Warsaw', 'POL', 1200], ['Łódź', 'POL', 640], ['Prague', 'CZE', 900],
  ['Rome', 'ITA', 1150], ['Milan', 'ITA', 1100], ['Naples', 'ITA', 860], ['Madrid', 'ESP', 1050], ['Barcelona', 'ESP', 1050], ['Bucharest', 'ROU', 640], ['Athens', 'GRC', 1100], ['Sofia', 'BGR', 290], ['Belgrade', 'SRB', 290], ['Istanbul', 'TUR', 740], ['Ankara', 'TUR', 120],
  ['Kiev', 'UKR', 850], ['Kharkiv', 'UKR', 830], ['Odesa', 'UKR', 600], ['Baku', 'AZE', 780], ['Tbilisi', 'GEO', 500], ['Riga', 'LVA', 390], ['Helsinki', 'FIN', 290], ['Kaunas', 'LTU', 110], ['Tallinn', 'EST', 140], ['Dublin', 'IRL', 470],
  ['Cairo', 'EGY', 1310], ['Alexandria', 'EGY', 690], ['Tehran', 'IRN', 360], ['Baghdad', 'IRQ', 400], ['Riyadh', 'SAU', 40], ['Sanaa', 'YEM', 25],
  // Asia
  ['Tokyo', 'JPN', 6000], ['Ōsaka', 'JPN', 3000], ['Nagoya', 'JPN', 1100], ['Kyoto', 'JPN', 1080], ['Kōbe', 'JPN', 910], ['Yokohama', 'JPN', 700], ['Seoul', 'KOR', 440], ['Taipei', 'TWN', 280],
  ['Shanghai', 'CHN', 3500], ['Beijing', 'CHN', 1550], ['Tianjin', 'CHN', 1250], ['Guangzhou', 'CHN', 1100], ['Wuhan', 'CHN', 1200], ['Nanjing', 'CHN', 1000], ['Shenyeng', 'CHN', 530], ['Harbin', 'CHN', 470], ['Changchun', 'CHN', 300], ['Dalian', 'CHN', 400], ['Hong Kong', 'HKG', 980],
  ['Kolkata', 'IND', 1500], ['Mumbai', 'IND', 1250], ['Chennai', 'IND', 650], ['Delhi', 'IND', 450], ['Lahore', 'PAK', 430], ['Karachi', 'PAK', 300], ['Bangkok', 'THA', 700], ['Manila', 'PHL', 620], ['Singapore', 'SGP', 550], ['Jakarta', 'IDN', 530], ['Ulaanbaatar', 'MNG', 70],
  ['Tashkent', 'UZB', 500], ['Novosibirsk', 'RUS', 280], ['Yekaterinburg', 'RUS', 420], ['Chelyabinsk', 'RUS', 270], ['Magnitogorsk', 'RUS', 150],
  // the Americas, Africa and Oceania
  ['New York', 'USA', 7000], ['Chicago', 'USA', 3380], ['Philadelphia', 'USA', 1950], ['Detroit', 'USA', 1570], ['Los Angeles', 'USA', 1240], ['Cleveland', 'USA', 900], ['St. Louis', 'USA', 820], ['Baltimore', 'USA', 805], ['Boston', 'USA', 780], ['Pittsburgh', 'USA', 670], ['San Francisco', 'USA', 634], ['Washington, D.C.', 'USA', 560],
  ['Montréal', 'CAN', 820], ['Toronto', 'CAN', 630], ['Mexico City', 'MEX', 1030], ['Havana', 'CUB', 650], ['Buenos Aires', 'ARG', 2400], ['Rio de Janeiro', 'BRA', 1700], ['São Paulo', 'BRA', 1200], ['Santiago', 'CHL', 900], ['Lima', 'PER', 450], ['Bogota', 'COL', 330], ['Caracas', 'VEN', 250], ['Montevideo', 'URY', 650],
  ['Johannesburg', 'ZAF', 520], ['Sydney', 'AUS', 1250], ['Melbourne', 'AUS', 1050], ['Canberra', 'AUS', 10],
];
/** Urban growth from 1914 to 1936 for towns of the 1914 table not listed above. */
const GROWTH: Record<string, number> = {
  GBR: 1.12, FRA: 1.1, DEU: 1.12, BEL: 1.1, NLD: 1.25, CHE: 1.15, DNK: 1.3, SWE: 1.3, NOR: 1.2, FIN: 1.6, AUT: 0.92, CZE: 1.4, HUN: 1.2, POL: 1.4, ITA: 1.4, ESP: 1.6, PRT: 1.4, IRL: 1.1,
  RUS: 1.8, UKR: 1.4, BLR: 1.4, GEO: 1.7, AZE: 1.7, ARM: 1.7, ROU: 1.6, BGR: 2.5, SRB: 2.8, GRC: 2, TUR: 0.8, EGY: 1.7,
  USA: 1.4, CAN: 1.6, AUS: 1.6, NZL: 1.6, ARG: 1.6, BRA: 1.6, MEX: 2, JPN: 1.9, CHN: 1.4, IND: 1.25, PAK: 1.4,
};
const TOWN = new Map<string, Array<[number, number | undefined]>>();
for (const [n, a, k, lon] of TOWNS) (TOWN.get(`${n}|${a}`) ?? TOWN.set(`${n}|${a}`, []).get(`${n}|${a}`)!).push([k * 1000, lon]);
for (const [n, a, k, lon] of TOWNS_1914) if (!TOWN.has(`${n}|${a}`)) TOWN.set(`${n}|${a}`, [[k * 1000 * (GROWTH[a] ?? 1.3), lon]]);

export function popOf(p: { name: string; adm0: string; pop: number; lon: number; lat: number }): number {
  const hit = TOWN.get(`${p.name}|${p.adm0}`)?.find(([, lon]) => lon === undefined || Math.abs(lon - p.lon) < 3);
  if (hit) return hit[0];
  // the rest: present-day figures, scaled down by the growth since and by the region's wealth then
  return p.pop * 0.12 * wealthOf(p.adm0, p.lon, p.lat);
}

/** Names of 1936 for places renamed since: the world map's beyond Europe, and the Europe 1936 map's. */
export const NAMES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(NAMES_1914).filter(([k]) => !(k in EU14_NAMES))),
  ...EU_NAMES,
  Beijing: 'Peiping',
  Changchun: 'Hsinking',
  Kunming: 'Kunming',
  Hohhot: 'Kweisui',
  Qiqihar: 'Tsitsihar',
  Chengde: 'Chengteh',
  Ulaanbaatar: 'Ulan Bator',
  Yekaterinburg: 'Sverdlovsk',
  Novosibirsk: 'Novosibirsk',
  'Ulan-Ude': 'Ulan-Ude',
  Kyzyl: 'Kyzyl',
  'Komsomolsk-na-Amure': 'Komsomolsk',
  Novokuznetsk: 'Stalinsk',
  Qaraghandy: 'Karaganda',
  Almaty: 'Alma-Ata',
  Bishkek: 'Frunze',
  Dushanbe: 'Stalinabad',
  Ashgabat: 'Ashkhabad',
  Qyzylorda: 'Kzyl-Orda',
  Kirov: 'Kirov',
  Windhoek: 'Windhoek',
  Madang: 'Madang',
  Kokopo: 'Kokopo',
  Kavieng: 'Kavieng',
  Lusaka: 'Lusaka',
  Incheon: 'Jinsen',
  Hefei: 'Hofei',
  Darwin: 'Darwin',
  Douala: 'Douala',
  Yaoundé: 'Yaoundé',
  Lomé: 'Lomé',
  Yellowknife: 'Yellowknife',
  Khujand: 'Leninabad',
};

/** Towns the 1914 map leaves out that stood by 1936: new capitals, the Soviet and Copperbelt mining towns, old ports. */
const TOWNS_BY_1936 = 'Canberra|Lusaka|Karaganda|Qaraghandy|Magnitogorsk|Komsomolsk-na-Amure|Novokuznetsk|Nukus|Ukhta|Jamshedpur|Goiânia|Belo Horizonte|Tijuana|Mexicali|Port Harcourt|Kaduna|Jos|Ndola|Kitwe|Mufulira|Luanshya|Kabwe|Port Sudan|Wad Medani|Juba|Walvis Bay|Thiès|Kigali|Arusha|Kuwait|Manama|Doha|Dubai|Abu Dhabi|Townsville|Gladstone';

/** Places Natural Earth lists that were not yet towns in 1936 (or only under a later name with no forerunner). */
export const NOT_YET = [
  ...EU_NOT_YET,
  // the 1914 map's list, less the towns founded or grown by 1936 (and old towns it left out)
  ...NOT_YET_1914.filter((n) => !EU14_NOT_YET.includes(n) && !inList(n, TOWNS_BY_1936)),
];

// ───────────────────────────── treaties and claims ─────────────────────────

/**
 * Beyond Europe (see TREATIES_1936): the dominions stand with Britain (the
 * Commonwealth's common defence, though free in foreign policy since 1931);
 * the Japan-Manchukuo protocol of 1932 and the Soviet-Mongolian understanding
 * of 1934 (the mutual assistance protocol of March 1936 formalised it) are
 * alliances; the treaty of Taif (1934) is a pact between Saudi Arabia and Yemen.
 */
const TREATIES_WORLD: NonNullable<RealMapDef['treaties']> = [
  ...TREATIES_1936,
  { type: 'alliance', a: 'gbr', b: 'can' },
  { type: 'alliance', a: 'gbr', b: 'saf' },
  { type: 'alliance', a: 'gbr', b: 'ast' },
  { type: 'alliance', a: 'gbr', b: 'nzl' },
  { type: 'alliance', a: 'jpn', b: 'man' },
  { type: 'alliance', a: 'sov', b: 'mgl' },
  { type: 'nap', a: 'sau', b: 'yem' },
];

/** Beyond Europe: Italy's war on Ethiopia, China's lost Manchuria, the Chaco, the Falklands. */
const CLAIMS_WORLD: NonNullable<RealMapDef['claims']> = [
  ...CLAIMS_1936,
  { by: 'ita', on: 'eth', name: 'Ethiopia', at: [[38.72, 14.13], [37.46, 12.61], [42.15, 9.32]] },
  { by: 'chn', on: 'man', name: 'Manchuria and Jehol', at: [[123.43, 41.8], [126.65, 45.75], [117.93, 40.96]] },
  { by: 'bol', on: 'par', name: 'the Chaco Boreal', at: [[-60.61, -22.03]] },
  { by: 'arg', on: 'gbr', name: 'the Falkland Islands', at: [[-57.85, -51.7]] },
];

// ───────────────────────────── the definition ──────────────────────────────

/** Realms whose lands beyond their home are colonies or mandates (loosely held at the start). */
const COLONIAL = 'gbr|fra|ita|spa|por|ned|bel|usa|jpn|den|saf|ast|nzl';
const HOME = 'Britain|France|Italy|Spain|Portugal|Netherlands|Belgium|Denmark|Northeast|Midwest|South|West|Japan|Alaska|South Africa|Australia|New Zealand';

export function earth1936Def(): RealMapDef {
  return {
    id: 'earth-1936',
    revision: 1,
    startYear: 1936,
    campaignYears: { options: [10, 20, 30], default: 20 },
    nations: NATIONS,
    regions: [],
    classify: () => undefined,
    auto: {
      realmOf,
      groupOf: landOf,
      targetKm2: (land, _realm, lat, lon) => 3.4 * PROV_KM2 * sparseOf(land, lat, lon),
      sparse: (land, _realm, lat, lon) => sparseOf(land, lat, lon),
      biome: (_land, lat, lon) => BIOME[zoneOf(lat, lon)],
      integ: (land, realm) => (inList(realm, COLONIAL) && !inList(land, HOME) ? [25, 55] : undefined),
      name: regionName,
    },
    capitals: CAPITALS,
    proj: equalEarth(11),
    box: BOX,
    inCrop: (_lon, lat) => lat >= BOX.south && lat <= BOX.north,
    km: 1.8,
    provKm2: PROV_KM2,
    minIslandKm2: 2500,
    minLakeKm2: 4000,
    regionalKm2: 90000,
    land: 'land50',
    lakes: LAKES,
    rivers: RIVERS,
    riverMinKm: 700,
    ridges: RIDGES,
    passes: PASSES,
    islandNames: ISLAND_NAMES,
    seas: SEAS,
    names: NAMES,
    notYet: NOT_YET,
    popOf,
    nameKm: 260,
    straits: STRAITS,
    straitMaxKm: 160,
    treaties: TREATIES_WORLD,
    claims: CLAIMS_WORLD.map((c) => ({ ...c, km: 260 })),
    cities: { max: 260, minPop: 150000, spacingKm: 260 },
    depositHints: DEPOSIT_HINTS,
    climate: 'temperate',
    wrapOcean: true,
    meta: {
      name: 'The World, 1936',
      description:
        'The whole world on 1 January 1936, from the Arctic to Cape Horn: the British and French empires at their greatest extent with the League mandates, a rearming Germany, the Soviet Union from the Dniester to the Pacific, Italy at war in Ethiopia, Japan with its creature Manchukuo, Nationalist China, and the United States in the Depression. The treaties of the day are in force and the claims of the time stand, Ethiopia and Manchuria among them. Borders approximated from present-day divisions; protectorates are drawn as their protector’s land.',
      blurb: 'A huge historical campaign: over a thousand provinces and 69 realms on the eve of the Second World War.',
      size: 'huge',
      difficulty: 'hard',
      style: 'Empires and revisionists across every ocean',
      mechanics: ['Real geography', 'Historical borders of 1936', 'Alliances and claims of 1936', 'Colonial empires and mandates', 'Oceans that wrap around', 'Mountain passes', 'Straits and islands'],
      origin: 'builtin',
      attribution: [
        'Coastlines, lakes, rivers, first-level divisions and towns: Natural Earth (naturalearthdata.com), public domain.',
        'Borders of 1936 approximated from present-day divisions; historical names, town populations of about 1936, ridges, passes and straits are authored (tools/earth1936.data.ts, with tools/earth.data.ts and tools/europe1936.data.ts). Arms are simplified, in national colours.',
      ],
    },
  };
}
