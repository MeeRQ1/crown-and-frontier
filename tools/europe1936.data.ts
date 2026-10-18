// Authored data for "Europe, 1936" (tools/genreal.ts): the continent on
// 1 January 1936. The geography is the Europe 1914 map's (tools/europe.data.ts):
// the same frame, projection, province density, ridges, passes, straits, lakes,
// rivers, seas and deposits. This file holds what changed:
//  - the realms of 1936 and their simplified arms in national colours (the
//    game's heraldry has no eagles, lions or political emblems);
//  - which present-day first-level division belonged to which realm and region
//    in 1936. Borders follow present-day divisions where they match those of
//    1936 and approximate them where they do not (the Polish Corridor and the
//    Free City of Danzig, East Upper Silesia, the Riga line in Belarus and
//    Ukraine, the Karelian Isthmus, Bessarabia, Venezia Giulia);
//  - the names in use in 1936 for places renamed since (Danzig, Lwów,
//    Wilno, Leningrad, Stalingrad, Fiume, Cernăuți…);
//  - the treaties in force and the claims of the time.
// Sources: the peace treaties of 1919–23 (Versailles, Saint-Germain, Trianon,
// Neuilly, Lausanne) and the later frontier treaties (Riga 1921, Tartu 1920,
// Kars 1921, the Memel Convention 1924, the Saar plebiscite of January 1935),
// as summarised in standard atlases of the period (e.g. the Times Atlas of
// European History, Magocsi's Historical Atlas of Central Europe), and the
// League of Nations Treaty Series for the alliances and pacts.
// Simplifications, stated in the map's description and docs/atlas/MAPS.md:
//  - the Free City of Danzig, whose customs and foreign relations Poland held,
//    is a Polish region of its own, claimed by Germany;
//  - the Italo-Ethiopian war (from October 1935) lies beyond this frame;
//  - Luxembourg keeps its own realm; the microstates, Gibraltar, Tangier and
//    the enclave of Zara are drawn with the land around them;
//  - northern Arabia and Kuwait, whose capitals lie beyond the frame, are left
//    off the campaign; the deserts at the frame's southern edge are thinly divided.

import type { NationDef } from '../src/sim/types';
import { B, BOX, COLONY, DEPOSIT_HINTS, FRONTIER, ISLAND_NAMES, LAKES, NATIONS as NATIONS_1914, PASSES, RIDGES, RIVERS, SEAS, STRAITS, classify as classify1914, inCrop, inList, reg } from './europe.data';
import { lambert, type Division, type RealMapDef, type RealRegion } from './realmap';

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

/** A realm of the 1914 map that carries on in 1936, with what changed. */
const was = (id: string, over: Partial<NationDef> = {}): NationDef => ({ ...NATIONS_1914.find((n) => n.id === id)!, ...over });

// ───────────────────────────── realms ──────────────────────────────────────

export const NATIONS: NationDef[] = [
  was('gbr', { summary: 'The centre of the largest empire on earth, rearming slowly after the Abyssinian crisis, with the fleet at Malta and Gibraltar and the mandates of Palestine and Transjordan.', constraint: 'A small army and an empire to garrison.' }),
  nation('irl', 'Irish Free State', 'Ireland', 'Irish', '#5b9a62', 'dublin', 'defensive', arms('vert', 'pale', 'argent', 'none', 'or'), 'A dominion since 1922, now under de Valera unpicking the Treaty, and in a tariff war with Britain.', 'Men who fought for independence in living memory: soldiers fight well.', 'Small, agricultural and at odds with its largest market.', { moraleAdd: 0.2, tradeMul: -0.1 }, 'Small dominion', 'challenging'),
  was('fra', { summary: 'The Third Republic behind the Maginot Line, keystone of the alliances of eastern Europe, with North Africa and the mandates of Syria and Lebanon.', strength: 'Fortifications and a large reserve: forts cost less.', constraint: 'A falling birth rate and short-lived governments: men are precious.', traits: { fortCostMul: -0.3, popGrowthMul: -0.2 }, startType: 'Established republic' }),
  nation('ger', 'German Reich', 'Germany', 'German', '#5d5d6b', 'berlin', 'expansionist', arms('sable', 'fess', 'argent', 'roundel', 'gules'), 'Rearming openly since 1935 and rejoined by the Saar, with the Rhineland still demilitarised and the treaties of 1919 its declared grievance.', 'Industry and staff work: research and income above every neighbour.', 'Ringed by French alliances, and short of oil, rubber and iron ore.', { researchMul: 0.15, incomeMul: 0.1, supplyProdMul: -0.1 }, 'Rearming power', 'recommended'),
  was('ita', { personality: 'expansionist', summary: 'Mussolini’s kingdom, at war in Ethiopia and under League sanctions, master of Libya, the Dodecanese, Trieste, Istria and Fiume.', strength: 'A long coast and a modern fleet: trade pays and soldiers are keen.', constraint: 'Poor in coal and iron, and isolated by sanctions.', traits: { tradeMul: 0.1, moraleAdd: 0.1, supplyProdMul: -0.1 }, startType: 'Fascist kingdom' }),
  nation('sov', 'Union of Soviet Socialist Republics', 'Soviet Union', 'Soviet', '#8e3a3a', 'moscow', 'opportunist', arms('gules', 'none', 'gules', 'hammer', 'or'), 'Stalin’s union of republics from the Dniester to the Pacific, in its second five-year plan, newly in the League and allied with Czechoslovakia.', 'Vast manpower and planned industry: armies are cheap to fill.', 'Purges and distances: research and integration are slow.', { manpowerMul: 0.35, supplyProdMul: 0.1, researchMul: -0.1, integrationMul: -0.1 }, 'Planned economy', 'standard'),
  nation('pol', 'Republic of Poland', 'Poland', 'Polish', '#c06a7a', 'warsaw', 'defensive', arms('gules', 'none', 'gules', 'crown', 'argent'), 'The restored republic between Germany and the Soviet Union, ruled by Piłsudski’s colonels since his death in 1935, with the port of Gdynia and the Free City of Danzig at the mouth of the Vistula.', 'A large army with a fighting tradition: soldiers fight well.', 'Two great neighbours, and Ukrainian and Belarusian lands in the east that integrate slowly.', { moraleAdd: 0.2, manpowerMul: 0.1, integrationMul: -0.15 }, 'Republic between giants', 'standard'),
  nation('cze', 'Czechoslovak Republic', 'Czechoslovakia', 'Czechoslovak', '#4f8aa8', 'prague', 'defensive', arms('argent', 'perFess', 'gules', 'lozenge', 'azure'), 'The democracy of Masaryk and, since December 1935, Beneš: industrial Bohemia behind its mountain forts, allied with France and the Soviet Union.', 'Škoda works and border forts: industry and fortification.', 'Long borders and three million Germans in the Sudetenland.', { fortCostMul: -0.25, incomeMul: 0.1, integrationMul: -0.1 }, 'Industrial democracy', 'standard'),
  nation('aut', 'Federal State of Austria', 'Austria', 'Austrian', '#c9a23f', 'vienna', 'defensive', arms('gules', 'fess', 'argent', 'none', 'argent'), 'The Alpine republic left in 1919, ruled by Schuschnigg’s Fatherland Front since Dollfuss’s murder and shielded by Italy against German annexation.', 'Alpine passes: forts are cheap.', 'Small, divided and coveted by Germany.', { fortCostMul: -0.2, incomeMul: -0.05 }, 'Small state', 'challenging'),
  nation('hun', 'Kingdom of Hungary', 'Hungary', 'Hungarian', '#7a9a4a', 'budapest', 'expansionist', arms('vert', 'fess', 'argent', 'crown', 'gules'), 'A kingdom without a king under the Regent Horthy, shorn of two-thirds of its land at Trianon and set on winning it back.', 'Revisionist fervour: soldiers fight hard.', 'Small, ringed by the Little Entente and limited in arms.', { moraleAdd: 0.3, manpowerMul: -0.1 }, 'Revisionist kingdom', 'challenging'),
  was('rom', { personality: 'defensive', summary: 'Greater Romania of 1918, with Transylvania, Bessarabia and Bukovina, the Ploiești oil fields, and alliances with Poland, the Little Entente and the Balkan Pact.', constraint: 'Every neighbour claims a part of it: new lands integrate slowly.', traits: { supplyProdMul: 0.15, integrationMul: -0.1 } }),
  nation('yug', 'Kingdom of Yugoslavia', 'Yugoslavia', 'Yugoslav', '#6f6aa8', 'belgrade', 'defensive', arms('azure', 'fess', 'argent', 'crown', 'gules'), 'The kingdom of the South Slavs under the regent Prince Paul since King Alexander’s assassination in 1934, divided into nine banovinas.', 'Mountains and veterans: defenders fight well.', 'Serbs and Croats at odds: land integrates slowly.', { moraleAdd: 0.3, integrationMul: -0.2 }, 'Established crown', 'standard'),
  was('bul', { summary: 'Tsar Boris’s kingdom, twice defeated and cut off from the Aegean, claiming Macedonia, Western Thrace and Southern Dobruja.', constraint: 'Isolated and disarmed by the treaty of Neuilly.', traits: { moraleAdd: 0.4, manpowerMul: -0.1 }, startType: 'Revisionist kingdom', rating: 'challenging' }),
  was('gre', { summary: 'A kingdom again since November 1935 after a decade of republic and coups, with Thrace, Macedonia and the islands, and a merchant fleet on every sea.', constraint: 'Political turmoil and a million refugees from Anatolia.', traits: { tradeMul: 0.2, straitCostAdd: -1, integrationMul: -0.05 } }),
  was('alb', { name: 'Kingdom of Albania', capital: 'tirana', summary: 'King Zog’s mountain kingdom, bound to Italy by the treaties of Tirana and its loans.', strength: 'Mountains: forts are cheap.', constraint: 'Poor and dependent on Italian money.', traits: { fortCostMul: -0.15, incomeMul: -0.2 }, startType: 'Mountain realm' }),
  nation('tur', 'Republic of Turkey', 'Turkey', 'Turkish', '#9b5b3a', 'ankara', 'defensive', arms('gules', 'none', 'gules', 'crescent', 'argent'), 'Atatürk’s republic of Anatolia and eastern Thrace, secular and modernising, and pressing to refortify the straits.', 'The straits and the hills of Anatolia: defenders fight well.', 'Poor and rebuilding after a decade of war.', { moraleAdd: 0.3, incomeMul: -0.1 }, 'Young republic', 'standard'),
  nation('spa', 'Spanish Republic', 'Spain', 'Spanish', '#d0a13a', 'madrid', 'defensive', arms('gules', 'perFess', 'purpure', 'tower', 'or'), 'The Second Republic, months before its civil war and divided between left and right, with a protectorate in northern Morocco.', 'Mountains and a long border to defend: forts are cheap.', 'Little industry and a nation divided: provinces are restless.', { fortCostMul: -0.2, researchMul: -0.1, integrationMul: -0.15 }, 'Divided republic', 'standard'),
  was('por', { summary: 'Salazar’s Estado Novo, Britain’s oldest ally, with Angola, Mozambique and the Atlantic islands overseas.' }),
  was('ned', { summary: 'A rich trading kingdom of ports and polders, neutral between Britain and Germany, and master of the East Indies.' }),
  was('bel', { summary: 'An industrial kingdom under Leopold III, allied with France since 1920 and guarding the Meuse.', constraint: 'On the road between France and Germany.' }),
  was('lux', { summary: 'A neutral grand duchy of iron and steel, in economic union with Belgium since 1921.' }),
  was('swi'),
  was('den', { summary: 'A farming kingdom at the Baltic straits, restored to North Schleswig in 1920 and disarming in the hope of neutrality.' }),
  was('swe'),
  was('nor', { capital: 'oslo', summary: 'A seafaring kingdom of fjords whose merchant fleet sails every sea, neutral and lightly armed.' }),
  nation('fin', 'Republic of Finland', 'Finland', 'Finnish', '#9ab8c8', 'helsinki', 'defensive', arms('argent', 'cross', 'azure', 'none', 'or'), 'Independent since 1917, a republic of forests and lakes holding the Karelian Isthmus a day’s march from Leningrad.', 'Forests, lakes and ski troops: defenders fight well.', 'Few people for a long border.', { moraleAdd: 0.4, fortCostMul: -0.15, manpowerMul: -0.15 }, 'Small republic', 'challenging'),
  nation('est', 'Republic of Estonia', 'Estonia', 'Estonian', '#5e7fb8', 'tallinn', 'defensive', arms('azure', 'fess', 'sable', 'none', 'argent'), 'A small Baltic republic under Päts’s authoritarian rule, allied with Latvia.', 'Coast, marsh and forest: forts are cheap.', 'Very small, beside the Soviet Union.', { fortCostMul: -0.15, manpowerMul: -0.1 }, 'Small republic', 'challenging'),
  nation('lat', 'Republic of Latvia', 'Latvia', 'Latvian', '#9a4a5a', 'riga', 'commercial', arms('gules', 'fess', 'argent', 'star', 'or'), 'Ulmanis’s republic at the mouth of the Daugava, trading through Riga and Liepāja.', 'Ports and timber: trade pays.', 'Small, between Germany and the Soviet Union.', { tradeMul: 0.15 }, 'Small republic', 'challenging'),
  nation('lit', 'Republic of Lithuania', 'Lithuania', 'Lithuanian', '#b9a046', 'kaunas', 'defensive', arms('gules', 'none', 'gules', 'horse', 'argent'), 'Smetona’s republic, governed from Kaunas while its historic capital Vilnius is held by Poland, and master of Memel since 1923.', 'A people determined to keep its land.', 'Small, claiming Vilnius and claimed for Memel.', { moraleAdd: 0.2, manpowerMul: -0.1 }, 'Small republic', 'challenging'),
  nation('egy', 'Kingdom of Egypt', 'Egypt', 'Egyptian', '#c4a96a', 'cairo', 'defensive', arms('vert', 'none', 'vert', 'crescent', 'argent'), 'A kingdom of the Nile, independent since 1922 but with British troops on the Suez Canal.', 'The Nile and its cotton: income above its size.', 'British garrisons and a small army.', { incomeMul: 0.1, manpowerMul: -0.2 }, 'Nominal independence', 'challenging'),
  nation('irq', 'Kingdom of Iraq', 'Iraq', 'Iraqi', '#8a8a4a', 'baghdad', 'opportunist', arms('sable', 'perFess', 'vert', 'star', 'argent'), 'Independent since 1932 and bound to Britain by the treaty of 1930: a kingdom of the two rivers with the oil of Kirkuk.', 'Oil and the two rivers.', 'A young state with restless tribes: land integrates slowly.', { supplyProdMul: 0.15, integrationMul: -0.2 }, 'Young kingdom', 'challenging'),
  was('per', { id: 'irn', name: 'Imperial State of Iran', short: 'Iran', adjective: 'Iranian', summary: 'Reza Shah’s modernising monarchy, renamed Iran in 1935; its north-west lies within this map.', strength: 'Distance and mountains.', constraint: 'Little industry: income and research are low.', traits: { incomeMul: -0.15, researchMul: -0.15 } }),
];

export const CAPITALS: Record<string, [string, string]> = {
  gbr: ['London', 'GBR'],
  irl: ['Dublin', 'IRL'],
  fra: ['Paris', 'FRA'],
  ger: ['Berlin', 'DEU'],
  ita: ['Rome', 'ITA'],
  sov: ['Moscow', 'RUS'],
  pol: ['Warsaw', 'POL'],
  cze: ['Prague', 'CZE'],
  aut: ['Vienna', 'AUT'],
  hun: ['Budapest', 'HUN'],
  rom: ['Bucharest', 'ROU'],
  yug: ['Belgrade', 'SRB'],
  bul: ['Sofia', 'BGR'],
  gre: ['Athens', 'GRC'],
  alb: ['Tirana', 'ALB'],
  tur: ['Ankara', 'TUR'],
  spa: ['Madrid', 'ESP'],
  por: ['Lisbon', 'PRT'],
  ned: ['Amsterdam', 'NLD'],
  bel: ['Brussels', 'BEL'],
  lux: ['Luxembourg', 'LUX'],
  swi: ['Bern', 'CHE'],
  den: ['København', 'DNK'],
  swe: ['Stockholm', 'SWE'],
  nor: ['Oslo', 'NOR'],
  fin: ['Helsinki', 'FIN'],
  est: ['Tallinn', 'EST'],
  lat: ['Riga', 'LVA'],
  lit: ['Kaunas', 'LTU'],
  egy: ['Cairo', 'EGY'],
  irq: ['Baghdad', 'IRQ'],
  irn: ['Tehran', 'IRN'],
};

// ───────────────────────────── regions ─────────────────────────────────────

/** Lands held since 1919–21 by a state their people did not choose: they integrate more slowly. */
const BORDERLAND: [number, number] = [45, 75];
const MANDATE = COLONY;

export const REGIONS: RealRegion[] = [
  // United Kingdom
  reg('gbr', 'london', 'London', B.low),
  reg('gbr', 'southeast', 'South East England', B.low),
  reg('gbr', 'eastanglia', 'East Anglia', B.low),
  reg('gbr', 'southwest', 'West Country', B.mixed),
  reg('gbr', 'midlands', 'Midlands', B.low),
  reg('gbr', 'northwest', 'Lancashire and Cheshire', B.mixed),
  reg('gbr', 'yorkshire', 'Yorkshire', B.mixed),
  reg('gbr', 'northeast', 'Northumbria', B.hill),
  reg('gbr', 'wales', 'Wales', B.hill),
  reg('gbr', 'lowlands', 'Scottish Lowlands', B.hill),
  reg('gbr', 'highlands', 'Highlands', B.alp, { sparse: 1.8 }),
  reg('gbr', 'ulster', 'Northern Ireland', B.mixed),
  reg('gbr', 'cyprus', 'Cyprus', B.med, { integ: COLONY }),
  reg('gbr', 'malta', 'Malta', { plains: 2, hills: 1 }),
  reg('gbr', 'palestine', 'Palestine', B.dry, { integ: MANDATE }),
  reg('gbr', 'transjordan', 'Transjordan', B.desert, { sparse: 3, integ: MANDATE }),
  // Irish Free State
  reg('irl', 'leinster', 'Leinster', B.low),
  reg('irl', 'munster', 'Munster', B.mixed),
  reg('irl', 'connacht', 'Connacht', B.marsh),
  reg('irl', 'donegal', 'Donegal, Cavan and Monaghan', B.mixed),
  // France
  reg('fra', 'iledefrance', 'Île-de-France', B.low),
  reg('fra', 'picardy', 'Picardy and Flanders', B.low),
  reg('fra', 'champagne', 'Champagne and Lorraine', B.mixed),
  reg('fra', 'alsace', 'Alsace and Moselle', B.hill),
  reg('fra', 'normandy', 'Normandy', B.low),
  reg('fra', 'brittany', 'Brittany', B.mixed),
  reg('fra', 'loire', 'Anjou and Maine', B.low),
  reg('fra', 'orleanais', 'Orléanais and Berry', B.low),
  reg('fra', 'burgundy', 'Burgundy and Franche-Comté', B.hill),
  reg('fra', 'aquitaine', 'Aquitaine', B.mixed),
  reg('fra', 'languedoc', 'Languedoc', B.med),
  reg('fra', 'lyonnais', 'Lyonnais and Auvergne', B.hill),
  reg('fra', 'savoy', 'Savoy and Dauphiné', B.alp),
  reg('fra', 'provence', 'Provence', B.med),
  reg('fra', 'corsica', 'Corsica', B.med),
  reg('fra', 'algiers', 'Algiers', B.med, { sparse: 1.3, integ: COLONY }),
  reg('fra', 'oran', 'Oran', B.dry, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'constantine', 'Constantine', B.med, { sparse: 1.3, integ: COLONY }),
  reg('fra', 'algsahara', 'Algerian Sahara', B.desert, { integ: COLONY, sparse: 5 }),
  reg('fra', 'tunis', 'Tunis', B.med, { sparse: 1.2, integ: COLONY }),
  reg('fra', 'southtunisia', 'Southern Tunisia', B.desert, { integ: COLONY, sparse: 3 }),
  reg('fra', 'fez', 'Fez and Meknes', B.hill, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'rabat', 'Rabat and Casablanca', B.med, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'marrakesh', 'Marrakesh', B.dry, { integ: COLONY, sparse: 2 }),
  reg('fra', 'oriental', 'Eastern Morocco', B.desert, { integ: COLONY, sparse: 2.5 }),
  reg('fra', 'aleppo', 'Aleppo', B.dry, { sparse: 1.4, integ: MANDATE }),
  reg('fra', 'syria', 'Damascus', B.dry, { sparse: 1.7, integ: MANDATE }),
  reg('fra', 'beirut', 'Lebanon and Latakia', B.med, { integ: MANDATE }),
  reg('fra', 'zor', 'Jazira and the Euphrates', B.desert, { sparse: 3.5, integ: MANDATE }),
  reg('fra', 'alexandretta', 'Sanjak of Alexandretta', B.med, { integ: MANDATE }),
  // German Reich
  reg('ger', 'brandenburg', 'Brandenburg', B.mixed),
  reg('ger', 'pomerania', 'Pomerania', B.mixed),
  reg('ger', 'mecklenburg', 'Mecklenburg', B.low),
  reg('ger', 'schleswig', 'Schleswig-Holstein', B.low),
  reg('ger', 'hanover', 'Hanover and Oldenburg', B.low),
  reg('ger', 'westphalia', 'Rhineland and Westphalia', B.mixed),
  reg('ger', 'hesse', 'Hesse-Nassau', B.hill),
  reg('ger', 'palatinate', 'Palatinate and Saar', B.hill),
  reg('ger', 'baden', 'Baden and Württemberg', B.hill),
  reg('ger', 'bavaria', 'Bavaria', B.hill),
  reg('ger', 'saxony', 'Saxony', B.hill),
  reg('ger', 'thuringia', 'Thuringia', B.hill),
  reg('ger', 'provsaxony', 'Prussian Saxony', B.low),
  reg('ger', 'silesia', 'Silesia', B.mixed),
  reg('ger', 'eastprussia', 'East Prussia', { plains: 2.4, forest: 2, marsh: 1.2 }),
  // Italy
  reg('ita', 'piedmont', 'Piedmont', B.alp),
  reg('ita', 'lombardy', 'Lombardy', B.low),
  reg('ita', 'venetia', 'Venetia', B.low),
  reg('ita', 'trentino', 'Trentino and South Tyrol', B.alp),
  reg('ita', 'julian', 'Venezia Giulia', B.hill),
  reg('ita', 'liguria', 'Liguria', B.med),
  reg('ita', 'emilia', 'Emilia-Romagna', B.low),
  reg('ita', 'tuscany', 'Tuscany', B.med),
  reg('ita', 'marche', 'Marche and Umbria', B.med),
  reg('ita', 'lazio', 'Lazio', B.med),
  reg('ita', 'abruzzo', 'Abruzzo and Molise', B.alp),
  reg('ita', 'campania', 'Campania', B.med),
  reg('ita', 'apulia', 'Apulia', B.med),
  reg('ita', 'calabria', 'Calabria and Basilicata', B.med),
  reg('ita', 'sicily', 'Sicily', B.med),
  reg('ita', 'sardinia', 'Sardinia', B.med),
  reg('ita', 'tripolitania', 'Tripolitania', B.desert, { integ: COLONY, sparse: 3 }),
  reg('ita', 'cyrenaica', 'Cyrenaica', B.desert, { integ: COLONY, sparse: 3.5 }),
  reg('ita', 'dodecanese', 'Dodecanese', B.med, { integ: COLONY }),
  // Soviet Union
  reg('sov', 'stpetersburg', 'Leningrad', B.taiga, { sparse: 1.4 }),
  reg('sov', 'novgorod', 'Novgorod and Kalinin', B.taiga, { sparse: 1.8 }),
  reg('sov', 'pskov', 'Pskov', B.north, { sparse: 1.6 }),
  reg('sov', 'olonets', 'Soviet Karelia', B.taiga, { sparse: 2.6 }),
  reg('sov', 'kola', 'Murmansk', B.taiga, { sparse: 5 }),
  reg('sov', 'archangel', 'Archangel', B.taiga, { sparse: 5 }),
  reg('sov', 'vologda', 'Vologda', B.taiga, { sparse: 3.2 }),
  reg('sov', 'moscow', 'Moscow', B.mixed, { sparse: 1.6 }),
  reg('sov', 'yaroslavl', 'Yaroslavl and Ivanovo', B.north, { sparse: 1.7 }),
  reg('sov', 'nizhny', 'Gorky', B.north, { sparse: 1.7 }),
  reg('sov', 'kazan', 'Kazan and Kirov', B.north, { sparse: 2.2 }),
  reg('sov', 'smolensk', 'Smolensk', B.mixed, { sparse: 1.6 }),
  reg('sov', 'kaluga', 'Tula and Oryol', B.mixed, { sparse: 1.5 }),
  reg('sov', 'ryazan', 'Ryazan and Penza', B.mixed, { sparse: 1.6 }),
  reg('sov', 'kursk', 'Kursk', B.steppe, { sparse: 1.4 }),
  reg('sov', 'voronezh', 'Voronezh and Tambov', B.steppe, { sparse: 1.6 }),
  reg('sov', 'saratov', 'Saratov and Kuybyshev', B.steppe, { sparse: 2 }),
  reg('sov', 'don', 'Rostov and the Don', B.steppe, { sparse: 1.8 }),
  reg('sov', 'astrakhan', 'Stalingrad and Astrakhan', B.desert, { sparse: 3 }),
  reg('sov', 'kuban', 'Kuban', B.steppe, { sparse: 1.4 }),
  reg('sov', 'terek', 'North Caucasus', B.alp, { sparse: 1.4, integ: FRONTIER }),
  reg('sov', 'stavropol', 'Stavropol', B.steppe, { sparse: 1.6 }),
  reg('sov', 'georgia', 'Georgia', B.alp, { sparse: 1.2 }),
  reg('sov', 'erivan', 'Armenia', B.alp, { sparse: 1.2 }),
  reg('sov', 'baku', 'Azerbaijan', B.dry, { sparse: 1.6 }),
  reg('sov', 'minsk', 'Minsk', B.marsh, { sparse: 1.5 }),
  reg('sov', 'vitebsk', 'Vitebsk', B.north, { sparse: 1.5 }),
  reg('sov', 'mogilev', 'Mogilev and Gomel', B.marsh, { sparse: 1.5 }),
  reg('sov', 'zhitomir', 'Zhitomir', B.marsh, { sparse: 1.4 }),
  reg('sov', 'podolia', 'Vinnitsa', B.low, { sparse: 1.2 }),
  reg('sov', 'kiev', 'Kiev', B.low, { sparse: 1.3 }),
  reg('sov', 'chernigov', 'Chernigov and Kharkov', B.steppe, { sparse: 1.3 }),
  reg('sov', 'poltava', 'Poltava', B.steppe, { sparse: 1.3 }),
  reg('sov', 'donets', 'Donbas', B.steppe, { sparse: 1.3 }),
  reg('sov', 'ekaterinoslav', 'Dnepropetrovsk', B.steppe, { sparse: 1.4 }),
  reg('sov', 'kherson', 'Odessa and Nikolaev', B.steppe, { sparse: 1.4 }),
  reg('sov', 'taurida', 'Crimea', B.steppe, { sparse: 1.4 }),
  // Poland
  reg('pol', 'warsaw', 'Warsaw', B.low),
  reg('pol', 'lodz', 'Łódź and Kielce', B.low),
  reg('pol', 'lublin', 'Lublin', B.low),
  reg('pol', 'poznan', 'Poznań', B.low),
  reg('pol', 'pomorze', 'Pomorze', B.mixed),
  reg('pol', 'danzig', 'Free City of Danzig', B.low),
  reg('pol', 'katowice', 'Polish Silesia', B.hill),
  reg('pol', 'krakow', 'Kraków', B.hill),
  reg('pol', 'lwow', 'Lwów', B.hill),
  reg('pol', 'stanislawow', 'Stanisławów and Tarnopol', B.hill, { integ: BORDERLAND }),
  reg('pol', 'volhynia', 'Volhynia', B.marsh, { sparse: 1.3, integ: BORDERLAND }),
  reg('pol', 'polesie', 'Polesie', B.marsh, { sparse: 1.5, integ: BORDERLAND }),
  reg('pol', 'bialystok', 'Białystok', B.north, { sparse: 1.2 }),
  reg('pol', 'wilno', 'Wilno and Nowogródek', B.north, { sparse: 1.3, integ: BORDERLAND }),
  // Czechoslovakia
  reg('cze', 'bohemia', 'Bohemia', B.hill),
  reg('cze', 'moravia', 'Moravia and Silesia', B.hill),
  reg('cze', 'slovakia', 'Western Slovakia', B.alp),
  reg('cze', 'eslovakia', 'Eastern Slovakia', B.alp),
  reg('cze', 'ruthenia', 'Subcarpathian Ruthenia', B.alp, { integ: BORDERLAND }),
  // Austria, Hungary
  reg('aut', 'loweraustria', 'Vienna and Lower Austria', B.hill),
  reg('aut', 'upperaustria', 'Upper Austria and Salzburg', B.alp),
  reg('aut', 'tyrol', 'Tyrol and Vorarlberg', B.alp),
  reg('aut', 'styria', 'Styria and Carinthia', B.alp),
  reg('hun', 'budapest', 'Budapest', B.low),
  reg('hun', 'transdanubia', 'Transdanubia', B.low),
  reg('hun', 'northhungary', 'Northern Hungary', B.hill),
  reg('hun', 'alfold', 'Great Hungarian Plain', { plains: 4, steppe: 1.2, marsh: 0.6 }),
  // Romania
  reg('rom', 'wallachia', 'Wallachia', B.low),
  reg('rom', 'oltenia', 'Oltenia', B.low),
  reg('rom', 'moldavia', 'Moldavia', B.hill),
  reg('rom', 'dobruja', 'Dobruja', B.steppe),
  reg('rom', 'transylvania', 'Transylvania', B.alp),
  reg('rom', 'banat', 'Banat and Arad', B.low),
  reg('rom', 'bukovina', 'Bukovina', B.hill),
  reg('rom', 'bessarabia', 'Bessarabia', B.low, { sparse: 1.2, integ: BORDERLAND }),
  // Yugoslavia: the nine banovinas of 1929
  reg('yug', 'drava', 'Drava Banovina', B.alp),
  reg('yug', 'sava', 'Sava Banovina', B.hill),
  reg('yug', 'primorje', 'Littoral Banovina', B.med),
  reg('yug', 'vrbas', 'Vrbas Banovina', B.alp),
  reg('yug', 'drina', 'Drina Banovina', B.alp),
  reg('yug', 'zeta', 'Zeta Banovina', B.alp),
  reg('yug', 'danube', 'Danube Banovina', B.low),
  reg('yug', 'morava', 'Morava Banovina', B.hill),
  reg('yug', 'vardar', 'Vardar Banovina', B.hill, { integ: BORDERLAND }),
  // Bulgaria, Greece, Albania
  reg('bul', 'sofia', 'Sofia', B.hill),
  reg('bul', 'danubebul', 'Danubian Bulgaria', B.low),
  reg('bul', 'rumelia', 'Eastern Rumelia', B.hill),
  reg('bul', 'pirin', 'Pirin and the Rhodopes', B.alp),
  reg('gre', 'attica', 'Attica and Boeotia', B.med),
  reg('gre', 'peloponnese', 'Peloponnese', B.med),
  reg('gre', 'thessaly', 'Thessaly', B.low),
  reg('gre', 'epirus', 'Epirus', B.alp),
  reg('gre', 'grmacedonia', 'Greek Macedonia', B.hill),
  reg('gre', 'wthrace', 'Western Thrace', B.med),
  reg('gre', 'crete', 'Crete', B.med),
  reg('gre', 'aegean', 'Aegean Islands', B.med),
  reg('gre', 'ionian', 'Ionian Islands', B.med),
  reg('alb', 'albania', 'Albania', B.alp, { integ: [40, 70] }),
  // Turkey
  reg('tur', 'thrace', 'Istanbul and Thrace', B.low),
  reg('tur', 'hudavendigar', 'Bursa and the Marmara', B.hill),
  reg('tur', 'aydin', 'İzmir and the Aegean', B.med),
  reg('tur', 'konya', 'Konya', B.dry, { sparse: 1.8 }),
  reg('tur', 'ankara', 'Ankara', B.dry, { sparse: 1.8 }),
  reg('tur', 'kastamonu', 'Kastamonu', B.hill, { sparse: 1.4 }),
  reg('tur', 'sivas', 'Sivas', B.hill, { sparse: 1.5 }),
  reg('tur', 'trebizond', 'Trabzon', B.alp, { sparse: 1.3 }),
  reg('tur', 'erzurum', 'Erzurum', B.alp, { sparse: 1.7 }),
  reg('tur', 'kars', 'Kars', B.alp, { sparse: 1.4 }),
  reg('tur', 'van', 'Van', B.alp, { sparse: 1.7, integ: FRONTIER }),
  reg('tur', 'diyarbekir', 'Diyarbakır', B.dry, { sparse: 1.7, integ: FRONTIER }),
  reg('tur', 'mamuret', 'Elazığ and Malatya', B.alp, { sparse: 1.5 }),
  reg('tur', 'adana', 'Adana and Antep', B.med),
  // Spain, Portugal
  reg('spa', 'newcastile', 'New Castile', B.dry, { sparse: 1.3 }),
  reg('spa', 'oldcastile', 'Old Castile and León', B.dry, { sparse: 1.3 }),
  reg('spa', 'esgalicia', 'Galicia', B.hill),
  reg('spa', 'asturias', 'Asturias and Cantabria', B.alp),
  reg('spa', 'basque', 'Basque Country and Navarre', B.hill),
  reg('spa', 'aragon', 'Aragon', B.dry, { sparse: 1.3 }),
  reg('spa', 'catalonia', 'Catalonia', B.hill),
  reg('spa', 'valencia', 'Valencia and Murcia', B.med),
  reg('spa', 'andalusia', 'Andalusia', B.med),
  reg('spa', 'extremadura', 'Extremadura', B.dry, { sparse: 1.3 }),
  reg('spa', 'balearics', 'Balearic Islands', B.med),
  reg('spa', 'spmorocco', 'Spanish Morocco', B.alp, { integ: COLONY }),
  reg('por', 'ptnorth', 'Minho and Douro', B.hill),
  reg('por', 'beira', 'Beira', B.hill),
  reg('por', 'ptlisbon', 'Estremadura', B.med),
  reg('por', 'alentejo', 'Alentejo and Algarve', B.dry),
  // the Low Countries, Switzerland
  reg('ned', 'holland', 'Holland', { plains: 3, marsh: 1.6 }),
  reg('ned', 'nleast', 'Gelderland and the East', B.low),
  reg('bel', 'flanders', 'Flanders and Brabant', B.low),
  reg('bel', 'wallonia', 'Wallonia', B.hill),
  reg('lux', 'luxembourg', 'Luxembourg', B.hill),
  reg('swi', 'switzerland', 'Switzerland', B.alp),
  // Scandinavia and Finland
  reg('den', 'jutland', 'Jutland', B.low),
  reg('den', 'zealand', 'Zealand and Funen', B.low),
  reg('swe', 'gotaland', 'Götaland', B.mixed),
  reg('swe', 'smaland', 'Scania and Småland', B.mixed),
  reg('swe', 'svealand', 'Svealand', B.north, { sparse: 1.3 }),
  reg('swe', 'norrlands', 'Southern Norrland', B.taiga, { sparse: 2.2 }),
  reg('swe', 'norrlandn', 'Northern Norrland', B.taiga, { sparse: 3.5 }),
  reg('nor', 'eastnorway', 'Eastern Norway', B.north, { sparse: 1.3 }),
  reg('nor', 'westnorway', 'Western Norway', B.alp, { sparse: 1.6 }),
  reg('nor', 'trondelag', 'Trøndelag', B.alp, { sparse: 2 }),
  reg('nor', 'northnorway', 'Northern Norway', B.alp, { sparse: 3.5 }),
  reg('fin', 'finlands', 'Southern Finland', B.north, { sparse: 1.2 }),
  reg('fin', 'fikarelia', 'Viipuri and Karelia', B.north, { sparse: 1.4 }),
  reg('fin', 'finlandc', 'Central Finland', B.taiga, { sparse: 2 }),
  reg('fin', 'finlandn', 'Oulu and Lapland', B.taiga, { sparse: 4 }),
  // the Baltic states
  reg('est', 'estnorth', 'Northern Estonia', B.north),
  reg('est', 'estsouth', 'Southern Estonia', B.north),
  reg('lat', 'riga', 'Riga and Vidzeme', B.north),
  reg('lat', 'courland', 'Courland and Zemgale', B.mixed),
  reg('lat', 'latgale', 'Latgale', B.north, { sparse: 1.2 }),
  reg('lit', 'kaunas', 'Kaunas', B.mixed),
  reg('lit', 'samogitia', 'Samogitia', B.mixed),
  reg('lit', 'aukstaitija', 'Aukštaitija', B.north),
  reg('lit', 'memel', 'Memel Territory', B.low, { integ: BORDERLAND }),
  // Egypt, Iraq, Iran
  reg('egy', 'egypt', 'Lower Egypt', { plains: 4, marsh: 1 }),
  reg('egy', 'sinai', 'Sinai and the Canal', B.desert, { sparse: 2.5 }),
  reg('egy', 'westerndesert', 'Western Desert', B.desert, { sparse: 4 }),
  reg('irq', 'mosul', 'Mosul', B.dry, { sparse: 1.6, integ: FRONTIER }),
  reg('irq', 'baghdad', 'Baghdad', { plains: 2.4, steppe: 2, marsh: 0.8 }, { sparse: 1.8 }),
  reg('irq', 'basra', 'Basra', { marsh: 2, steppe: 2, plains: 1 }, { sparse: 2.4 }),
  reg('irn', 'tabriz', 'Azerbaijan (Tabriz)', B.dry, { sparse: 1.6 }),
  reg('irn', 'gilan', 'Gilan and Mazandaran', { forest: 2.4, hills: 1.4, plains: 1 }, { sparse: 1.3 }),
  reg('irn', 'tehran', 'Tehran and Qazvin', B.dry, { sparse: 1.6 }),
  reg('irn', 'hamadan', 'Hamadan and Kermanshah', B.alp, { sparse: 1.6 }),
  reg('irn', 'khuzestan', 'Khuzestan and Luristan', B.dry, { sparse: 2.4 }),
];

const REGION_IDS = new Set(REGIONS.map((r) => r.id));

// ───────────────────────────── classification ──────────────────────────────

/** Leningrad oblast north of the Sestra (the Karelian Isthmus) was Finnish. */
const onIsthmus = (lon: number, lat: number) => lon < 31.2 && lat > 60.15 + (lon - 29.9) * 0.4;
/** Ladoga Karelia, north of the lake and west of the old border, was Finnish. */
const inLadogaKarelia = (lon: number, lat: number) => lat < 62.2 && lon < 32.0 - (lat - 61.3) * 0.85;
/** Petsamo, Finland's corridor to the Arctic Ocean. */
const inPetsamo = (lon: number, lat: number) => lon < 31.9 && lat > 68.9;
/** Southern Bessarabia (the Budjak), west of the Dniester estuary, was Romanian. */
const inBudjak = (lon: number, lat: number) => lat < 46.6 && lon < 30.0 + (46.5 - lat) * 1.2;
/** The Polish-Soviet frontier of the Treaty of Riga (1921) through the Minsk and Vitebsk oblasts. */
const westOfRigaLine = (n: string, lon: number, lat: number) => (n === 'Minsk' ? lon < 27.25 + (lat - 53.5) * 0.4 : n === 'Vitebsk' ? lon < 28.1 && lat < 55.85 : false);

/** The region of a division at a point on 1 January 1936. */
export function classify(d: Division, lon: number, lat: number): string | null | undefined {
  const r = classify1936(d, lon, lat);
  // a region the 1914 map knows but 1936 does not (Posen, Bosnia…) is an error, not a silent hole
  return r && !REGION_IDS.has(r) ? undefined : r;
}

function classify1936(d: Division, lon: number, lat: number): string | null | undefined {
  const n = d.name;
  const g = d.group;
  switch (d.adm0) {
    case 'IRL':
      if (inList(n, 'Donegal|Cavan|Monaghan')) return 'donegal';
      break;
    case 'DNK':
      // North Schleswig is Danish again (the plebiscite of 1920)
      return inList(n, 'Hovedstaden|Sjaælland') || (n === 'Syddanmark' && lon > 9.9) ? 'zealand' : 'jutland';
    case 'ISR':
    case 'PSX':
      // the Golan was in the French mandate of Syria
      return n === 'HaZafon' && lon > 35.62 && lat > 32.7 ? 'syria' : 'palestine';
    case 'JOR':
      return 'transjordan';
    case 'SAU':
      // the Saudi kingdom's capital lies beyond the frame: left off, as Kuwait is
      return null;
    case 'TUR':
      if (n === 'Hatay') return 'alexandretta';
      if (inList(n, 'Gaziantep|Kilis')) return 'adana';
      break;
    case 'ITA':
    case 'VAT':
    case 'SMR': {
      const r = classify1914(d, lon, lat);
      return r === 'tyrol' ? 'trentino' : r === 'littoral' ? 'julian' : r;
    }
    case 'AUT':
      if (inList(n, 'Wien|Niederösterreich|Burgenland')) return 'loweraustria';
      break;
    case 'SVK':
      return inList(n, 'Bratislavský|Trnavský|Nitriansky|Trenciansky|Žilinský') ? 'slovakia' : 'eslovakia';
    case 'SVN':
      // the Slovenian Littoral and the Karst were Italian (Rapallo, 1920)
      if (g === 'Obalno-kraška' || g === 'Goriška' || (g === 'Notranjsko-kraška' && lon < 14.3)) return 'julian';
      return 'drava';
    case 'HRV':
      if (n === 'Istarska') return 'julian';
      // Fiume (Italian since 1924), Abbazia and the islands of Cherso and Lussino
      if (n === 'Primorsko-Goranska' && ((lon < 14.45 && lat > 45.2) || (lon < 14.5 && lat < 45.05))) return 'julian';
      if (n === 'Dubrovacko-Neretvanska') return 'zeta';
      if (inList(n, 'Splitsko-Dalmatinska|Šibensko-Kninska|Zadarska')) return 'primorje';
      if (n === 'Vukovarsko-Srijemska') return 'danube';
      return 'sava';
    case 'BIH':
      if ((lat < 43.7 && lon < 18.15) || (lat < 44.0 && lon < 17.6)) return 'primorje';
      if (lat < 43.3) return 'zeta';
      if (lon < 17.8 && lat > 44.0) return 'vrbas';
      return 'drina';
    case 'SRB':
      if (inList(n, 'Severno-Backi|Zapadno-Backi|Južno-Backi|Severno-Banatski|Srednje-Banatski|Južno-Banatski|Sremski|Grad Beograd|Podunavski|Šumadijski|Branicevski')) return 'danube';
      if (inList(n, 'Macvanski|Kolubarski|Zlatiborski|Moravicki')) return 'drina';
      if (n === 'Raški') return 'zeta';
      if (n === 'Pcinjski') return 'vardar';
      return 'morava';
    case 'KOS':
      return inList(g, 'Prizren|Uroševac|Gnjilane') ? 'vardar' : 'zeta';
    case 'MNE':
      return 'zeta';
    case 'MKD':
      return 'vardar';
    case 'POL':
      return polish(n, lon, lat);
    case 'LTU':
      if (n === 'Klaipedos') return 'memel';
      // the Vilnius region was Polish (Żeligowski's mutiny of 1920, annexed 1922)
      if (n === 'Vilniaus' || (n === 'Alytaus' && (lon > 24.1 || lat < 54.15)) || (n === 'Utenos' && lon > 26.0 && lat < 55.4)) return 'wilno';
      if (inList(n, 'Šiauliai|Telšiai|Taurages')) return 'samogitia';
      if (inList(n, 'Panevezio|Utenos')) return 'aukstaitija';
      return 'kaunas';
    case 'LVA':
      return g === 'Latgale' ? 'latgale' : g === 'Kurzeme' || g === 'Zemgale' ? 'courland' : 'riga';
    case 'EST':
      return inList(n, 'Tartu|Võru|Põlva|Valga|Viljandi|Pärnu|Saare|Jõgeva') ? 'estsouth' : 'estnorth';
    case 'FIN':
      if (n === 'South Karelia') return 'fikarelia';
      break;
    case 'RUS':
      if (n === 'Leningrad' && onIsthmus(lon, lat)) return 'fikarelia';
      // Ivangorod, across the river from Narva, was Estonian
      if (n === 'Leningrad' && lon < 28.25 && lat < 59.45) return 'estnorth';
      if (n === 'Karelia' && inLadogaKarelia(lon, lat)) return 'fikarelia';
      if (n === 'Murmansk' && inPetsamo(lon, lat)) return 'finlandn';
      // Petseri (Pechory) was Estonian and Abrene (Pytalovo) Latvian (Tartu and Riga, 1920)
      if (n === 'Pskov' && lon < 28.0 && lat > 57.55 && lat < 58.0) return 'estsouth';
      if (n === 'Pskov' && lon < 28.0 && lat < 57.4 && lat > 56.85) return 'latgale';
      break;
    case 'BLR':
      if (n === 'Grodno') return lon < 24.6 ? 'bialystok' : 'wilno';
      if (n === 'Brest') return lon > 25.6 && lat > 52.8 ? 'wilno' : 'polesie';
      if (westOfRigaLine(n, lon, lat)) return 'wilno';
      return ({ Minsk: 'minsk', 'City of Minsk': 'minsk', Vitebsk: 'vitebsk', Mogilev: 'mogilev', Gomel: 'mogilev' } as Record<string, string>)[n];
    case 'UKR':
      return ukrainian(n, lon, lat);
    case 'MDA':
      // Bessarabia was Romanian; the left bank of the Dniester was the Soviet Moldavian ASSR
      return inList(n, 'Stîngă Nistrului|Transnistria|Grigoriopol|Camenca') ? 'kherson' : 'bessarabia';
  }
  return classify1914(d, lon, lat);
}

function polish(n: string, lon: number, lat: number): string | undefined {
  switch (n) {
    case 'West Pomeranian':
      return 'pomerania';
    case 'Lubusz':
      return 'brandenburg';
    case 'Lower Silesian':
    case 'Opole':
      return 'silesia';
    case 'Silesian':
      // East Upper Silesia went to Poland in 1922; Gleiwitz, Hindenburg and Ratibor stayed German
      if (lat > 50.55) return 'lodz';
      return (lon < 18.85 && lat > 50.2) || lon < 18.4 ? 'silesia' : 'katowice';
    case 'Pomeranian':
      if (lat > 54.15 && lat < 54.47 && lon >= 18.4 && lon < 19.45) return 'danzig';
      // the right bank of the lower Vistula (Marienburg, Marienwerder) stayed with East Prussia
      if (lon > 18.85 && lat <= 54.15) return 'eastprussia';
      // Lauenburg, Bütow and Stolp stayed German Pomerania
      if (lon < 17.45 + Math.max(0, lat - 53.9) * 0.7) return 'pomerania';
      return 'pomorze';
    case 'Kuyavian-Pomeranian':
      return 'pomorze';
    case 'Warmian-Masurian':
      // Soldau and the Lubawa land went to Poland; the rest is East Prussia
      return (lat < 53.55 && lon < 20.0) || (lat < 53.4 && lon < 20.6) ? 'pomorze' : 'eastprussia';
    case 'Greater Poland':
      // Schneidemühl, Deutsch Krone and Flatow stayed German (the Grenzmark)
      return lat > 53.02 && lon < 17.3 ? 'pomerania' : 'poznan';
    case 'Masovian':
      return 'warsaw';
    case 'Łódź':
    case 'Świętokrzyskie':
      return 'lodz';
    case 'Lublin':
      return 'lublin';
    case 'Podlachian':
      return 'bialystok';
    case 'Lesser Poland':
      return 'krakow';
    case 'Subcarpathian':
      return 'lwow';
  }
  return undefined;
}

function ukrainian(n: string, lon: number, lat: number): string | undefined {
  if (inList(n, 'Volyn|Rivne')) return 'volhynia';
  if (n === "L'viv") return 'lwow';
  if (inList(n, "Ternopil'|Ivano-Frankivs'k")) return 'stanislawow';
  if (n === 'Transcarpathia') return 'ruthenia';
  if (n === 'Chernivtsi') return 'bukovina';
  if (n === 'Odessa') return inBudjak(lon, lat) ? 'bessarabia' : 'kherson';
  return (
    {
      Zhytomyr: 'zhitomir',
      "Khmel'nyts'kyy": 'podolia',
      Vinnytsya: 'podolia',
      Kiev: 'kiev',
      'Kiev City': 'kiev',
      Cherkasy: 'kiev',
      Chernihiv: 'chernigov',
      Sumy: 'chernigov',
      Kharkiv: 'chernigov',
      Poltava: 'poltava',
      Kirovohrad: 'poltava',
      "Luhans'k": 'donets',
      "Donets'k": 'donets',
      "Dnipropetrovs'k": 'ekaterinoslav',
      Zaporizhzhya: 'ekaterinoslav',
      Kherson: 'kherson',
      Mykolayiv: 'kherson',
      Crimea: 'taurida',
      Sevastopol: 'taurida',
    } as Record<string, string>
  )[n];
}

// ───────────────────────────── names ───────────────────────────────────────

/** Present-day place names → the names in use in 1936 (the official language of the state that held them). */
export const NAMES: Record<string, string> = {
  'St. Petersburg': 'Leningrad',
  'St.  Petersburg': 'Leningrad',
  Vilnius: 'Wilno',
  Lviv: 'Lwów',
  "L'viv": 'Lwów',
  'Ivano-Frankivsk': 'Stanisławów',
  Ternopil: 'Tarnopol',
  Lutsk: 'Łuck',
  Rivne: 'Równe',
  Kovel: 'Kowel',
  Drohobych: 'Drohobycz',
  Hrodna: 'Grodno',
  Brest: 'Brześć',
  Pinsk: 'Pińsk',
  Baranavichy: 'Baranowicze',
  Navahrudak: 'Nowogródek',
  Gdańsk: 'Danzig',
  Gdansk: 'Danzig',
  Wrocław: 'Breslau',
  Wroclaw: 'Breslau',
  Szczecin: 'Stettin',
  Kaliningrad: 'Königsberg',
  Olsztyn: 'Allenstein',
  Opole: 'Oppeln',
  Koszalin: 'Köslin',
  'Zielona Góra': 'Grünberg',
  'Zielona Gora': 'Grünberg',
  'Gorzów Wielkopolski': 'Landsberg',
  'Gorzow Wielkopolski': 'Landsberg',
  Słupsk: 'Stolp',
  Slupsk: 'Stolp',
  Elbląg: 'Elbing',
  Elblag: 'Elbing',
  Legnica: 'Liegnitz',
  Wałbrzych: 'Waldenburg',
  Walbrzych: 'Waldenburg',
  Gliwice: 'Gleiwitz',
  Bytom: 'Beuthen',
  Zabrze: 'Hindenburg',
  Racibórz: 'Ratibor',
  'Jelenia Góra': 'Hirschberg',
  Piła: 'Schneidemühl',
  Pila: 'Schneidemühl',
  Kołobrzeg: 'Kolberg',
  Kolobrzeg: 'Kolberg',
  Świnoujście: 'Swinemünde',
  Malbork: 'Marienburg',
  Ełk: 'Lyck',
  Elk: 'Lyck',
  Kętrzyn: 'Rastenburg',
  Sovetsk: 'Tilsit',
  Chernyakhovsk: 'Insterburg',
  Gusev: 'Gumbinnen',
  Baltiysk: 'Pillau',
  'Bielsko-Biała': 'Bielsko',
  'Bielsko-Biala': 'Bielsko',
  Volgograd: 'Stalingrad',
  'Nizhny Novgorod': 'Gorky',
  Samara: 'Kuybyshev',
  "Tver'": 'Kalinin',
  Tver: 'Kalinin',
  Vladikavkaz: 'Ordzhonikidze',
  Stavropol: 'Voroshilovsk',
  Novomoskovsk: 'Stalinogorsk',
  Dnipropetrovsk: 'Dnepropetrovsk',
  Dnipro: 'Dnepropetrovsk',
  Kamianske: 'Dneprodzerzhinsk',
  Donetsk: 'Stalino',
  Luhansk: 'Voroshilovgrad',
  Makiyivka: 'Makeyevka',
  Horlivka: 'Gorlovka',
  Bakhmut: 'Artemovsk',
  Kyiv: 'Kiev',
  Kharkiv: 'Kharkov',
  Odesa: 'Odessa',
  Zaporizhzhya: 'Zaporozhye',
  Zaporizhia: 'Zaporozhye',
  Kirovohrad: 'Kirovo',
  Kropyvnytskyi: 'Kirovo',
  'Kryvyi Rih': 'Krivoy Rog',
  'Kryvyy Rih': 'Krivoy Rog',
  Mykolayiv: 'Nikolaev',
  Mykolaiv: 'Nikolaev',
  Zhytomyr: 'Zhitomir',
  Vinnytsya: 'Vinnitsa',
  Vinnytsia: 'Vinnitsa',
  "Khmel'nyts'kyy": 'Proskurov',
  Khmelnytskyi: 'Proskurov',
  Chernihiv: 'Chernigov',
  Kremenchuk: 'Kremenchug',
  Cherkasy: 'Cherkassy',
  Mahilyow: 'Mogilev',
  Homyel: 'Gomel',
  Babruysk: 'Bobruisk',
  Vitsyebsk: 'Vitebsk',
  'Veliky Novgorod': 'Novgorod',
  Arkhangelsk: 'Archangel',
  "Arkhangel'sk": 'Archangel',
  Oryol: 'Oryol',
  Ganja: 'Kirovabad',
  Vyborg: 'Viipuri',
  Pechenga: 'Petsamo',
  Chernivtsi: 'Cernăuți',
  'Bilhorod-Dnistrovskyi': 'Cetatea Albă',
  Izmail: 'Ismail',
  Bender: 'Tighina',
  Chisinau: 'Chișinău',
  'Chişinău': 'Chișinău',
  Dobrich: 'Bazargic',
  'Cluj-Napoca': 'Cluj',
  Uzhhorod: 'Užhorod',
  Mukacheve: 'Mukačevo',
  Rijeka: 'Fiume',
  Pula: 'Pola',
  Koper: 'Capodistria',
  Zadar: 'Zara',
  Rovinj: 'Rovigno',
  Poreč: 'Parenzo',
  Postojna: 'Postumia',
  'Nova Gorica': 'Gorizia',
  Skopje: 'Skoplje',
  Bitola: 'Bitolj',
  Zrenjanin: 'Petrovgrad',
  Iskenderun: 'Alexandretta',
  'İskenderun': 'Alexandretta',
  Antakya: 'Antioch',
  Kahramanmaraş: 'Maraş',
  Kahramanmaras: 'Maraş',
  Şanlıurfa: 'Urfa',
  Sanliurfa: 'Urfa',
  Elazığ: 'Elaziz',
  Elazig: 'Elaziz',
  'Bandar-e Anzali': 'Pahlavi',
  Gorgan: 'Astarabad',
  København: 'Copenhagen',
  'Den Haag': 'The Hague',
  Antwerpen: 'Antwerp',
  Gent: 'Ghent',
  Göteborg: 'Gothenburg',
  Goteborg: 'Gothenburg',
  Mönchengladbach: 'München-Gladbach',
  Monchengladbach: 'München-Gladbach',
  Derry: 'Londonderry',
  'Al Iskandariyah': 'Alexandria',
  'Bur Sa`id': 'Port Said',
  Alger: 'Algiers',
  Annaba: 'Bône',
  Skikda: 'Philippeville',
  Béjaïa: 'Bougie',
  Bejaia: 'Bougie',
  Chlef: 'Orléansville',
  Fès: 'Fez',
  Fes: 'Fez',
  Marrakech: 'Marrakesh',
  Tanger: 'Tangier',
  Kenitra: 'Port Lyautey',
  Tétouan: 'Tetuán',
  'Beer Sheva': 'Beersheba',
  'Tel Aviv-Yafo': 'Tel Aviv',
  // the names of 1936 where Natural Earth gives today's (or misspells them)
  Izmayil: 'Ismail',
  Maladzyechna: 'Mołodeczno',
  Nikel: 'Kolosjoki',
  Svetogorsk: 'Enso',
  Pizen: 'Plzeň',
  Pec: 'Peć',
  'Alba Lulia': 'Alba Iulia',
  'Miercurea Cuic': 'Miercurea Ciuc',
  'Drobeta-Turnu Severin': 'Turnu Severin',
  Ganca: 'Kirovabad',
  Khmelnytskyy: 'Proskurov',
  'Kamyanets-Podilskyy': 'Kamenets-Podolsky',
  'Velikiy Novgorod': 'Novgorod',
  Dimitrovgrad: 'Melekess',
  Naxcivan: 'Nakhichevan',
  Qabala: 'Kutkashen',
  Tskhinvali: 'Staliniri',
  Belomorsk: 'Soroka',
  Mazyr: 'Mozyr',
  Kerkira: 'Corfu',
  Komatini: 'Komotini',
  Patra: 'Patras',
  Sparti: 'Sparta',
  Lovec: 'Lovech',
  Montana: 'Ferdinand',
  'Ad Nabk': 'Nebk',
  Tadmur: 'Palmyra',
  Ṭarābulus: 'Tripoli',
  'Dayr az Zawr': 'Deir ez-Zor',
  Qairouan: 'Kairouan',
  'Sdid Bouzid': 'Sidi Bouzid',
  Tiarat: 'Tiaret',
  Poitier: 'Poitiers',
  Sefra: 'Aïn Sefra',
  'El Jadida': 'Mazagan',
  'Er Rachidia': 'Ksar es Souk',
  Khvoy: 'Khoy',
  Vannersborg: 'Vänersborg',
  'Ros Comain': 'Roscommon',
  Ajdabiya: 'Agedabia',
  Banghazi: 'Bengasi',
  Darnah: 'Derna',
  'Bani Walid': 'Beni Ulid',
  Mizdah: 'Mizda',
  Dirj: 'Derg',
  'As Sidr': 'Es Sider',
  'Al Jaghbub': 'Giarabub',
};

/** Places Natural Earth lists that were not yet towns in 1936 (or only under a later name with no forerunner). */
export const NOT_YET = ['Wolfsburg', 'Salzgitter', 'Eisenhüttenstadt', 'Eisenhuttenstadt', 'Hoyerswerda', 'Schwedt', 'Severomorsk', 'Novocheboksarsk', 'Nova Kakhovka', 'Enerhodar', 'Yuzhnoukrainsk', 'Netishyn', 'Kuznetsovsk', 'Varash', 'Chornomorsk', 'Pivdenne', 'Navoi', 'Zelenograd', 'Tolyatti', 'Naberezhnyye Chelny', 'Nizhnekamsk', 'Almetyevsk', 'Volzhskiy', 'Volzhsky', 'Obninsk', 'Sumqayit', 'Sumgait', 'Rustavi', 'Nowa Huta', 'Stalowa Wola', 'Dunaújváros', 'Severodvinsk', 'Apatity', 'Monchegorsk', 'Novopolotsk', 'Soligorsk', 'Salihorsk', 'Zhodzina', 'Lelystad', 'Almere', 'Ashdod', 'Holon', 'Aktau', 'Novokuybyshevsk', 'Kaspiysk', 'Izberbash', 'Magas', 'Nova Gorica', 'Volgodonsk', 'Gubkin', 'Akhtubinsk', 'Hassi Messaoud', 'Şirvan', 'Kohtla-Järve', 'Slantsy'];

// ───────────────────────────── 1936: treaties and claims ────────────────────

/**
 * Treaties in force on 1 January 1936, in the game's terms (defensive
 * alliances, non-aggression pacts, trade agreements):
 *  - alliances: France with Poland (1921), Czechoslovakia (1924) and Belgium
 *    (the military accord of 1920, renounced only in October 1936); the Little
 *    Entente (Czechoslovakia, Romania, Yugoslavia, 1920–21); the Polish-
 *    Romanian alliance (1921); the Balkan Pact (Greece, Romania, Turkey,
 *    Yugoslavia, February 1934); the Soviet-Czechoslovak mutual assistance
 *    pact (May 1935); the Anglo-Portuguese alliance; the Anglo-Iraqi treaty
 *    (1930); the second treaty of Tirana (Italy and Albania, 1927); the
 *    Estonian-Latvian alliance (1923);
 *  - non-aggression pacts: Locarno (France and Belgium with Germany, Britain as
 *    guarantor), the German-Polish declaration (January 1934), the Soviet pacts
 *    with Poland, France, Finland, Estonia and Latvia (1932) and Lithuania
 *    (1926), the Treaty of Berlin (Germany and the Soviet Union, 1926), the
 *    Italo-Soviet pact (1933), the Soviet-Turkish treaty (1925), the
 *    Turkish-Persian treaty (1932), Italy's treaty with Hungary (1927), the
 *    French treaties of friendship with Romania and Yugoslavia, and the Baltic
 *    Entente (1934);
 *  - trade: the Rome Protocols (Italy, Austria, Hungary, 1934), the Oslo
 *    states (Denmark, Norway, Sweden, Finland), the Belgian-Luxembourg
 *    economic union (1921) and Germany's clearing agreements with Hungary and
 *    Yugoslavia (1934);
 *  - left out: the Franco-Soviet mutual assistance treaty (signed May 1935,
 *    in force only from March 1936), the Anglo-Egyptian treaty (August 1936),
 *    the Axis (October 1936) and the Anti-Comintern Pact (November 1936).
 */
export const TREATIES_1936: NonNullable<RealMapDef['treaties']> = [
  { type: 'alliance', a: 'fra', b: 'pol' },
  { type: 'alliance', a: 'fra', b: 'cze' },
  { type: 'alliance', a: 'fra', b: 'bel' },
  { type: 'alliance', a: 'cze', b: 'rom' },
  { type: 'alliance', a: 'cze', b: 'yug' },
  { type: 'alliance', a: 'rom', b: 'yug' },
  { type: 'alliance', a: 'pol', b: 'rom' },
  { type: 'alliance', a: 'gre', b: 'rom' },
  { type: 'alliance', a: 'gre', b: 'tur' },
  { type: 'alliance', a: 'gre', b: 'yug' },
  { type: 'alliance', a: 'rom', b: 'tur' },
  { type: 'alliance', a: 'tur', b: 'yug' },
  { type: 'alliance', a: 'cze', b: 'sov' },
  { type: 'alliance', a: 'gbr', b: 'por' },
  { type: 'alliance', a: 'gbr', b: 'irq' },
  { type: 'alliance', a: 'ita', b: 'alb' },
  { type: 'alliance', a: 'est', b: 'lat' },
  { type: 'nap', a: 'fra', b: 'ger' },
  { type: 'nap', a: 'bel', b: 'ger' },
  { type: 'nap', a: 'gbr', b: 'fra' },
  { type: 'nap', a: 'ger', b: 'pol' },
  { type: 'nap', a: 'sov', b: 'pol' },
  { type: 'nap', a: 'sov', b: 'fra' },
  { type: 'nap', a: 'sov', b: 'fin' },
  { type: 'nap', a: 'sov', b: 'est' },
  { type: 'nap', a: 'sov', b: 'lat' },
  { type: 'nap', a: 'sov', b: 'lit' },
  { type: 'nap', a: 'ger', b: 'sov' },
  { type: 'nap', a: 'ita', b: 'sov' },
  { type: 'nap', a: 'sov', b: 'tur' },
  { type: 'nap', a: 'tur', b: 'irn' },
  { type: 'nap', a: 'ita', b: 'hun' },
  { type: 'nap', a: 'fra', b: 'rom' },
  { type: 'nap', a: 'fra', b: 'yug' },
  { type: 'nap', a: 'est', b: 'lit' },
  { type: 'nap', a: 'lat', b: 'lit' },
  { type: 'trade', a: 'ita', b: 'aut' },
  { type: 'trade', a: 'aut', b: 'hun' },
  { type: 'trade', a: 'den', b: 'nor' },
  { type: 'trade', a: 'den', b: 'swe' },
  { type: 'trade', a: 'nor', b: 'swe' },
  { type: 'trade', a: 'swe', b: 'fin' },
  { type: 'trade', a: 'bel', b: 'lux' },
  { type: 'trade', a: 'ger', b: 'hun' },
  { type: 'trade', a: 'ger', b: 'yug' },
];

/**
 * The grievances of 1936: the revisionist claims of the defeated of 1918 and
 * the disputes the peace left open. Each covers the province of the holder
 * nearest to each town listed. A claim is a grievance and a ground for war in
 * the game, not a statement that the land belonged to the claimant.
 */
export const CLAIMS_1936: NonNullable<RealMapDef['claims']> = [
  { by: 'ger', on: 'pol', name: 'Danzig and the Polish Corridor', at: [[18.64, 54.36], [18.0, 53.12], [18.53, 54.52]] },
  { by: 'ger', on: 'pol', name: 'East Upper Silesia', at: [[19.02, 50.26]] },
  { by: 'ger', on: 'lit', name: 'the Memel Territory', at: [[21.12, 55.72]] },
  { by: 'hun', on: 'cze', name: 'Southern Slovakia and Ruthenia', at: [[21.25, 48.73], [18.13, 47.76], [22.3, 48.62]] },
  { by: 'hun', on: 'rom', name: 'Transylvania', at: [[23.6, 46.79], [21.92, 47.05], [24.56, 46.54]] },
  { by: 'hun', on: 'yug', name: 'Bačka', at: [[19.68, 46.07], [19.85, 45.25]] },
  { by: 'bul', on: 'rom', name: 'Southern Dobruja', at: [[27.84, 43.59]] },
  { by: 'bul', on: 'yug', name: 'Vardar Macedonia', at: [[21.43, 42.0], [21.33, 41.03]] },
  { by: 'bul', on: 'gre', name: 'Western Thrace', at: [[25.87, 40.85], [25.4, 41.12]] },
  { by: 'lit', on: 'pol', name: 'Vilnius', at: [[25.32, 54.68]] },
  { by: 'pol', on: 'cze', name: 'Zaolzie', at: [[18.54, 49.75]] },
  { by: 'sov', on: 'rom', name: 'Bessarabia', at: [[28.86, 47.01], [27.93, 47.76], [30.35, 46.19]] },
  { by: 'gre', on: 'ita', name: 'the Dodecanese', at: [[28.22, 36.43]] },
  { by: 'irl', on: 'gbr', name: 'Northern Ireland', at: [[-5.96, 54.6], [-7.31, 54.99]] },
  { by: 'tur', on: 'fra', name: 'the Sanjak of Alexandretta', at: [[36.12, 36.23]] },
];

export function europe1936Def(): RealMapDef {
  return {
    id: 'europe-1936',
    // 2 (format 9): denser provinces (8,800 km² instead of 12,500) and more cities as fixed provinces
    revision: 2,
    // every realm keeps revision 1's development, population, forts, factories and deposits over its new
    // provinces; each province records the land it holds, on which development and factories
    // are priced and builders counted
    conserve: 'src/data/maps/legacy/europe-1936-r1.scenario.json',
    startYear: 1936,
    campaignYears: { options: [10, 20, 30], default: 20 },
    nations: NATIONS,
    regions: REGIONS,
    capitals: CAPITALS,
    classify,
    proj: lambert(15, 50, 38, 62),
    box: BOX,
    inCrop,
    km: 0.72,
    provKm2: 8800,
    minIslandKm2: 1300,
    minLakeKm2: 900,
    regionalKm2: 60000,
    land: 'land50',
    lakes: LAKES,
    rivers: RIVERS,
    riverMinKm: 220,
    ridges: RIDGES,
    passes: PASSES,
    islandNames: ISLAND_NAMES,
    seas: SEAS,
    names: NAMES,
    notYet: NOT_YET,
    straits: STRAITS,
    straitMaxKm: 140,
    treaties: TREATIES_1936,
    claims: CLAIMS_1936,
    cities: { max: 170, minPop: 120000, spacingKm: 75 },
    depositHints: DEPOSIT_HINTS,
    climate: 'temperate',
    meta: {
      name: 'Europe, 1936',
      description:
        'Europe on 1 January 1936, from Ireland to the Volga and from the North Cape to the Nile delta: a rearming Germany ringed by French alliances, the Soviet Union in its second five-year plan, Italy at war in Ethiopia, and the new states of 1918 between them. The treaties of the day are in force (the French alliances, the Little Entente, the Balkan Pact, Locarno, the non-aggression pacts), and the revisionist claims stand: Danzig and the Corridor, Memel, Transylvania, Dobruja, Macedonia, Bessarabia. Borders approximated from present-day divisions; the Free City of Danzig is a Polish region.',
      blurb: 'A large historical campaign: nearly a thousand provinces and 32 realms on the eve of the Second World War.',
      size: 'large',
      difficulty: 'hard',
      style: 'Revisionists against the order of 1919',
      mechanics: ['Real geography', 'Historical borders of 1936', 'Alliances and claims of 1936', 'Mountain passes', 'Straits and islands', 'River crossings'],
      origin: 'builtin',
      attribution: [
        'Coastlines, lakes, rivers, first-level divisions and towns: Natural Earth (naturalearthdata.com), public domain.',
        'Borders of 1936 approximated from present-day divisions; historical names, ridges, passes and straits are authored (tools/europe1936.data.ts, with the geography of tools/europe.data.ts). Arms are simplified, in national colours.',
      ],
    },
  };
}
