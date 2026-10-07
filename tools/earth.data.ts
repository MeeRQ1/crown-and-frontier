// Authored data for "The World, 1914" (tools/genreal.ts). Geography comes from
// Natural Earth; this file holds what Natural Earth cannot provide:
//  - the sovereign states and dominions of mid-1914 and their simplified arms in
//    national colours, and the colonies, protectorates and dependencies each
//    held (assigned to the power that governed them);
//  - which present-day first-level division belonged to which realm in 1914
//    (in Europe and the Near East the Europe map's classification is reused),
//    and how the divisions are grouped into the colonies, provinces and lands
//    of the time; regions are then made automatically within each group;
//  - names: the regions take the names of 1914 (Chihli, Bengal, Transvaal…),
//    and towns renamed since take their names of the time;
//  - the population of the larger towns about 1914 (Natural Earth gives
//    present-day figures), which places the cities and sets regional wealth;
//  - the main mountain walls and their passes, straits, seas, lakes and rivers.
// Simplifications, stated in the map's description and docs/atlas/MAPS.md:
//  - borders follow present-day first-level divisions, approximating those of
//    1914 where they differ; the Arctic north of 78° N and Antarctica are left
//    off; islands under about 2,500 km² are dropped;
//  - protectorates and dependencies are drawn as their protector's land:
//    Bukhara and Khiva (Russia), the Indian princely states, Bhutan and Sikkim
//    (Britain), Morocco (France and Spain), Tunisia (France), the Gulf
//    sheikhdoms and Aden (Britain), Korea and Formosa (Japan); Newfoundland, a
//    separate dominion, is drawn as British; the Ottoman clients in Arabia
//    (Jabal Shammar, Asir) and the Yemen are Ottoman; Najd with Hasa and Oman
//    are realms of their own; Mongolia and Tibet, de facto independent of
//    China since 1911–13, are realms;
//  - realms too small for a province on a world map are drawn as part of a
//    neighbour: Luxembourg (with Germany), Montenegro (with Serbia), the
//    microstates; Hong Kong, Macau, the French and Portuguese towns in India
//    and the treaty ports are drawn with the land around them;
//  - the Bering Strait lies on the map's seam and has no crossing.

import type { NationDef, Terrain } from '../src/sim/types';
import { ISLAND_NAMES as EU_ISLANDS, NATIONS as EU_NATIONS, NAMES as EU_NAMES, NOT_YET as EU_NOT_YET, PASSES as EU_PASSES, REGIONS as EU_REGIONS, RIDGES as EU_RIDGES, classify as euClassify } from './europe.data';
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

/** A realm of the Europe map, with what changes on a world map. */
const eu = (id: string, over: Partial<NationDef> = {}): NationDef => ({ ...EU_NATIONS.find((n) => n.id === id)!, ...over });

// ───────────────────────────── realms ──────────────────────────────────────

export const NATIONS: NationDef[] = [
  eu('gbr', { summary: 'The empire on which the sun never sets: the British Isles, India, Egypt and the Sudan, half of Africa, Malaya and the Caribbean, held together by the largest navy and merchant fleet in the world.', constraint: 'A small army for the largest empire, spread over every continent.' }),
  eu('fra', { summary: 'The Third Republic, with a conscript army along its eastern fortress line and the second colonial empire: North and West Africa, Madagascar and Indochina.' }),
  eu('ger', { summary: 'The industrial empire at the centre of Europe, with the strongest army on the continent, a fleet built to rival Britain’s and colonies in Africa and the Pacific. Luxembourg, in its customs union, is drawn with it.' }),
  eu('aus'),
  eu('rus', { summary: 'The empire of the tsars from Poland to the Pacific: Finland, the Caucasus, Turkestan and Siberia, slow to mobilise and vast in manpower.', constraint: 'Railways and industry lag, and the distances are immense: research and supply are slow.' }),
  eu('ita', { summary: 'A young kingdom, newly master of Libya and the Dodecanese, with Eritrea and Somaliland on the Red Sea and the Indian Ocean.' }),
  eu('ott', { summary: 'The old empire of the straits, shrunk by the Balkan wars, still ruling Anatolia, the Levant, Mesopotamia, the Hejaz and the Yemen from Constantinople.' }),
  eu('spa', { summary: 'A kingdom behind the Pyrenees, neutral and recovering from the loss of Cuba and the Philippines, with a zone in northern Morocco, Río de Oro and Spanish Guinea.' }),
  eu('por', { summary: 'An Atlantic republic since 1910, Britain’s oldest ally, holding Angola, Mozambique, Guinea and Timor.' }),
  eu('ned', { summary: 'A rich trading kingdom of ports and polders, neutral between Britain and Germany, and master of the East Indies.', strength: 'Commerce and the spice islands: trade and income above its size.' }),
  eu('bel', { summary: 'An industrial kingdom whose neutrality the great powers guarantee, ruling the vast Congo since 1908.' }),
  eu('swi'),
  eu('den', { summary: 'A farming kingdom at the Baltic straits, with Iceland, the Faroes and Greenland across the North Atlantic.' }),
  eu('swe'),
  eu('nor'),
  eu('rom'),
  eu('bul'),
  eu('ser', { summary: 'A kingdom doubled by the Balkan wars, battle-hardened and facing Austria-Hungary across the Danube; Montenegro, its ally and kin, is drawn with it.' }),
  eu('gre'),
  eu('alb'),
  eu('per', { summary: 'The Qajar shah’s realm from the Caspian to the Gulf, divided into Russian and British zones of influence, with the oil of the south newly in British hands.' }),
  nation('afg', 'Emirate of Afghanistan', 'Afghanistan', 'Afghan', '#8a7a52', 'kabul', 'defensive', arms('sable', 'none', 'sable', 'tower', 'argent'), 'The mountain emirate between the Russian and British empires, which conducts its foreign affairs through India.', 'Mountains and hardy tribes: soldiers fight well at home.', 'Poor, remote and without industry.', { moraleAdd: 0.4, incomeMul: -0.2, researchMul: -0.2 }, 'Mountain realm', 'challenging'),
  nation('njd', 'Emirate of Najd and Hasa', 'Najd', 'Najdi', '#6f8f4f', 'riyadh', 'expansionist', arms('vert', 'bend', 'argent', 'none', 'argent'), 'Ibn Saud’s desert emirate of central Arabia, newly master of the Gulf coast of Hasa and rival of the Rashidis of Ha’il.', 'Desert warriors: cavalry strikes hard.', 'Sand and few people: no industry, little income.', { cavalryAttackAdd: 0.1, moraleAdd: 0.3, incomeMul: -0.25 }, 'Desert emirate', 'challenging'),
  nation('omn', 'Sultanate of Muscat and Oman', 'Oman', 'Omani', '#a0644e', 'muscat', 'commercial', arms('gules', 'none', 'gules', 'ship', 'argent'), 'A seafaring sultanate at the mouth of the Gulf, under British protection, at odds with the imamate of its interior.', 'Dhows and the Indian Ocean trade.', 'Small, poor and divided.', { tradeMul: 0.2, incomeMul: -0.1 }, 'Maritime trader', 'challenging'),
  nation('nep', 'Kingdom of Nepal', 'Nepal', 'Nepalese', '#8a5c9c', 'kathmandu', 'defensive', arms('gules', 'bordure', 'azure', 'sun', 'argent'), 'A Himalayan kingdom ruled by the Rana prime ministers, closed to foreigners and allied to British India.', 'Gurkha soldiers and mountain walls.', 'Landlocked and poor.', { moraleAdd: 0.4, fortCostMul: -0.2, incomeMul: -0.15 }, 'Mountain realm', 'challenging'),
  nation('chn', 'Republic of China', 'China', 'Chinese', '#cf9f3e', 'peking', 'defensive', arms('or', 'chief', 'gules', 'sun', 'gules'), 'The young republic of Yuan Shikai, three years after the fall of the Qing: the most populous country on earth, with foreign concessions in its ports.', 'Numbers: an immense population and manpower.', 'Divided provinces and foreign debt: income, research and integration are weak.', { manpowerMul: 0.3, incomeMul: -0.2, researchMul: -0.2, integrationMul: -0.15 }, 'Old empire', 'challenging'),
  nation('tib', 'Tibet', 'Tibet', 'Tibetan', '#b3865a', 'lhasa', 'defensive', arms('azure', 'none', 'azure', 'mountain', 'argent'), 'The Dalai Lama’s state on the roof of the world, independent in fact since the Chinese garrison left in 1913.', 'The highest mountains on earth.', 'Few people and no industry.', { fortCostMul: -0.3, incomeMul: -0.25, researchMul: -0.3 }, 'Mountain realm', 'challenging'),
  nation('mgl', 'Bogd Khanate of Mongolia', 'Mongolia', 'Mongolian', '#6b956b', 'urga', 'opportunist', arms('gules', 'pale', 'azure', 'sun', 'or'), 'Outer Mongolia under the Bogd Khan, independent of China since 1911 and leaning on Russia.', 'Horsemen of the steppe.', 'Empty land: little income or industry.', { cavalryAttackAdd: 0.1, cavalryCostMul: -0.2, incomeMul: -0.25 }, 'Steppe horde', 'challenging'),
  nation('jpn', 'Empire of Japan', 'Japan', 'Japanese', '#c4566a', 'tokyo', 'expansionist', arms('argent', 'none', 'argent', 'roundel', 'gules'), 'The island empire that defeated Russia in 1905, ruling Korea and Formosa and allied to Britain, with a modern navy and a growing industry.', 'Discipline and a modern fleet: soldiers fight well and research is quick.', 'Few raw materials at home.', { moraleAdd: 0.3, researchMul: 0.1, supplyProdMul: -0.05 }, 'Rising power', 'recommended'),
  nation('sia', 'Kingdom of Siam', 'Siam', 'Siamese', '#4f9a9a', 'bangkok', 'diplomat', arms('gules', 'none', 'gules', 'tower', 'argent'), 'The only kingdom of South-East Asia to keep its independence, a buffer between British Burma and French Indochina.', 'Diplomacy between the empires: others think well of it.', 'Squeezed by two colonial powers.', { opinionAdd: 15, envoyAdd: 1 }, 'Buffer kingdom', 'challenging'),
  nation('eth', 'Ethiopian Empire', 'Ethiopia', 'Ethiopian', '#5a8a52', 'addisababa', 'defensive', arms('vert', 'fess', 'or', 'crown', 'gules'), 'The ancient highland empire that beat Italy at Adwa in 1896, independent among the African colonies.', 'Highland armies: defenders fight well at home.', 'Little industry and no coast.', { moraleAdd: 0.4, fortCostMul: -0.15, researchMul: -0.25 }, 'Mountain realm', 'challenging'),
  nation('lbr', 'Republic of Liberia', 'Liberia', 'Liberian', '#87679a', 'monrovia', 'diplomat', arms('gules', 'chief', 'azure', 'star', 'argent'), 'A small republic on the Grain Coast, independent since 1847 and indebted to American and European banks.', 'American friendship: others think well of it.', 'Small, poor and indebted.', { opinionAdd: 15, incomeMul: -0.2 }, 'Small neutral', 'challenging'),
  nation('saf', 'Union of South Africa', 'South Africa', 'South African', '#c48a46', 'pretoria', 'expansionist', arms('or', 'quarterly', 'azure', 'tree', 'vert'), 'The dominion of 1910 joining the Cape, Natal, the Transvaal and the Orange Free State, rich in gold and diamonds.', 'Gold and diamonds: income above its size.', 'A divided white minority ruling a black majority.', { incomeMul: 0.2, integrationMul: -0.15 }, 'Dominion', 'standard'),
  nation('usa', 'United States of America', 'United States', 'American', '#6a88b8', 'washington', 'commercial', arms('argent', 'chief', 'azure', 'star', 'argent'), 'The largest industrial economy in the world, between two oceans, with the Philippines, Hawaii and Puerto Rico, the Panama Canal about to open and a small army.', 'Industry and capital: income and research above everyone.', 'A small standing army and a public wary of foreign wars.', { incomeMul: 0.25, researchMul: 0.15, manpowerMul: -0.15 }, 'Wealthy heartland', 'recommended'),
  nation('can', 'Dominion of Canada', 'Canada', 'Canadian', '#9e6a8e', 'ottawa', 'commercial', arms('gules', 'pale', 'argent', 'tree', 'gules'), 'A self-governing dominion of the British Empire from the Atlantic to the Pacific, its prairies filling with settlers.', 'Wheat, timber and rail: trade pays well.', 'Few people for an immense land.', { tradeMul: 0.2, popGrowthMul: 0.15, manpowerMul: -0.15 }, 'Dominion', 'standard'),
  nation('mex', 'United Mexican States', 'Mexico', 'Mexican', '#77a058', 'mexicocity', 'opportunist', arms('vert', 'pale', 'argent', 'sun', 'or'), 'A republic in the middle of its revolution, with Huerta in the capital, Carranza, Villa and Zapata in the field and American marines in Veracruz.', 'Silver and oil.', 'Civil war: the provinces are restless and slow to integrate.', { supplyProdMul: 0.1, integrationMul: -0.25, incomeMul: -0.1 }, 'Revolution', 'challenging'),
  nation('gua', 'Republic of Guatemala', 'Guatemala', 'Guatemalan', '#b88c56', 'guatemalacity', 'defensive', arms('azure', 'pale', 'argent', 'tree', 'vert'), 'The largest of the Central American republics, under the long dictatorship of Estrada Cabrera.', 'Coffee and highland forts.', 'Small and poor.', { fortCostMul: -0.15, incomeMul: -0.1 }, 'Small republic', 'challenging'),
  nation('hon', 'Republic of Honduras', 'Honduras', 'Honduran', '#5c9c9e', 'tegucigalpa', 'opportunist', arms('azure', 'fess', 'argent', 'star', 'azure'), 'A republic of banana coasts and mountain towns, where the fruit companies make and unmake governments.', 'Bananas: the fruit trade pays.', 'Weak government.', { tradeMul: 0.15, integrationMul: -0.15 }, 'Small republic', 'challenging'),
  nation('sal', 'Republic of El Salvador', 'El Salvador', 'Salvadoran', '#9670ad', 'sansalvador', 'commercial', arms('azure', 'fess', 'argent', 'mountain', 'vert'), 'The smallest and most crowded of the Central American republics, a land of coffee and volcanoes.', 'Coffee and a dense population.', 'Very small.', { incomeMul: 0.1, popGrowthMul: 0.1 }, 'Small republic', 'challenging'),
  nation('nic', 'Republic of Nicaragua', 'Nicaragua', 'Nicaraguan', '#c4ab48', 'managua', 'opportunist', arms('azure', 'fess', 'argent', 'mountain', 'azure'), 'A republic of lakes and volcanoes under American marines since 1912, coveted for a second canal.', 'The lakes and a canal route.', 'An occupied government.', { tradeMul: 0.1, integrationMul: -0.15 }, 'Small republic', 'challenging'),
  nation('cri', 'Republic of Costa Rica', 'Costa Rica', 'Costa Rican', '#cf7c78', 'sanjose', 'diplomat', arms('azure', 'fess', 'gules', 'mountain', 'argent'), 'A peaceful coffee republic with more teachers than soldiers.', 'Schools and stability: research and opinion are good.', 'A tiny army.', { researchMul: 0.1, opinionAdd: 10, manpowerMul: -0.2 }, 'Small neutral', 'challenging'),
  nation('pan', 'Republic of Panama', 'Panama', 'Panamanian', '#669e7e', 'panama', 'commercial', arms('argent', 'quarterly', 'gules', 'star', 'azure'), 'The isthmus republic of 1903, whose canal opens to shipping in August 1914 under American control.', 'The canal: trade pays and straits are cheap.', 'Small and under American protection.', { tradeMul: 0.3, straitCostAdd: -1, manpowerMul: -0.2 }, 'Maritime trader', 'challenging'),
  nation('cub', 'Republic of Cuba', 'Cuba', 'Cuban', '#cc9a56', 'havana', 'commercial', arms('azure', 'pile', 'gules', 'star', 'argent'), 'An island republic of sugar, independent since 1902 under the eye of the United States.', 'Sugar: trade and income.', 'An island under American tutelage.', { tradeMul: 0.2, incomeMul: 0.05 }, 'Island republic', 'challenging'),
  nation('hai', 'Republic of Haiti', 'Haiti', 'Haitian', '#6b7bb0', 'portauprince', 'defensive', arms('azure', 'perFess', 'gules', 'tree', 'vert'), 'The first black republic, proud and unstable, with five presidents between 1911 and 1915.', 'Mountains and a fierce independence.', 'Turmoil: the provinces are restless.', { moraleAdd: 0.3, integrationMul: -0.25 }, 'Island republic', 'challenging'),
  nation('dom', 'Dominican Republic', 'Dominican Rep.', 'Dominican', '#ad6889', 'santodomingo', 'opportunist', arms('azure', 'cross', 'argent', 'book', 'gules'), 'The eastern republic of Hispaniola, whose customs houses American agents have run since 1905.', 'Sugar and cacao.', 'Debt and civil strife.', { incomeMul: -0.1, integrationMul: -0.15 }, 'Island republic', 'challenging'),
  nation('col', 'Republic of Colombia', 'Colombia', 'Colombian', '#d4bb4c', 'bogota', 'defensive', arms('or', 'perFess', 'gules', 'star', 'azure'), 'An Andean republic of coffee and mountains, still resentful of the loss of Panama.', 'Mountain valleys: forts are cheap.', 'Divided by the Andes.', { fortCostMul: -0.15, supplyProdMul: -0.1 }, 'Established republic', 'standard'),
  nation('ven', 'United States of Venezuela', 'Venezuela', 'Venezuelan', '#b15a68', 'caracas', 'opportunist', arms('or', 'fess', 'azure', 'star', 'argent'), 'The republic of Gómez, cattle plains and the first oil wells on Lake Maracaibo.', 'Oil beneath the lake.', 'A dictatorship of one man.', { supplyProdMul: 0.1, researchMul: -0.1 }, 'Established republic', 'standard'),
  nation('ecu', 'Republic of Ecuador', 'Ecuador', 'Ecuadorian', '#56899b', 'quito', 'defensive', arms('azure', 'chief', 'or', 'mountain', 'argent'), 'The republic on the equator, between the cacao coast and the volcanoes of the Andes.', 'Cacao and the high valleys.', 'Small and contested by Peru.', { tradeMul: 0.1, fortCostMul: -0.1 }, 'Small republic', 'challenging'),
  nation('pru', 'Republic of Peru', 'Peru', 'Peruvian', '#d2a052', 'lima', 'defensive', arms('gules', 'pale', 'argent', 'tree', 'vert'), 'The old viceroyalty of the Andes, still claiming Tacna and Arica lost to Chile in the Pacific War.', 'Guano, copper and the mountain wall.', 'Defeat in the last war and a long frontier.', { supplyProdMul: 0.1, fortCostMul: -0.1 }, 'Established republic', 'standard'),
  nation('bra', 'United States of Brazil', 'Brazil', 'Brazilian', '#5c9e56', 'riodejaneiro', 'commercial', arms('vert', 'none', 'vert', 'lozenge', 'or'), 'The giant of South America, a federal republic of coffee and rubber reaching deep into the Amazon.', 'Coffee and rubber: trade pays well.', 'Vast and thinly settled: supply is slow.', { tradeMul: 0.2, popGrowthMul: 0.1, supplyProdMul: -0.1 }, 'Established republic', 'standard'),
  nation('bol', 'Republic of Bolivia', 'Bolivia', 'Bolivian', '#8a6a48', 'lapaz', 'defensive', arms('gules', 'fess', 'or', 'mountain', 'argent'), 'A landlocked republic of the high Andes, rich in tin and silver, its coast lost to Chile.', 'Tin and silver.', 'Landlocked and thinly peopled.', { supplyProdMul: 0.1, manpowerMul: -0.1 }, 'Mountain realm', 'challenging'),
  nation('par', 'Republic of Paraguay', 'Paraguay', 'Paraguayan', '#9688c8', 'asuncion', 'defensive', arms('gules', 'fess', 'argent', 'star', 'azure'), 'A small river republic still recovering from the catastrophe of 1864–70, claiming the Chaco.', 'A hard people.', 'Depopulated and poor.', { moraleAdd: 0.3, manpowerMul: -0.2 }, 'Small republic', 'challenging'),
  nation('uru', 'Oriental Republic of Uruguay', 'Uruguay', 'Uruguayan', '#77acc6', 'montevideo', 'diplomat', arms('argent', 'chief', 'azure', 'sun', 'or'), 'A small, prosperous republic of cattle and reforms on the River Plate.', 'Beef and wool: income above its size.', 'Small, between Argentina and Brazil.', { incomeMul: 0.15, opinionAdd: 10 }, 'Small neutral', 'challenging'),
  nation('arg', 'Argentine Republic', 'Argentina', 'Argentine', '#85b0d6', 'buenosaires', 'commercial', arms('azure', 'fess', 'argent', 'sun', 'or'), 'One of the richest countries in the world, exporting wheat and beef from the Pampas through Buenos Aires.', 'Grain and beef: trade and income.', 'Its wealth depends on British markets and ships.', { tradeMul: 0.2, incomeMul: 0.15 }, 'Wealthy heartland', 'standard'),
  nation('chi', 'Republic of Chile', 'Chile', 'Chilean', '#bd5a4d', 'santiago', 'expansionist', arms('azure', 'perFess', 'gules', 'star', 'argent'), 'The long republic of the Pacific coast, victorious in the nitrate war, with a strong navy and the Atacama’s saltpetre.', 'Nitrates and a Prussian-trained army.', 'A long, thin country.', { moraleAdd: 0.2, supplyProdMul: 0.1 }, 'Rising power', 'standard'),
  nation('ast', 'Commonwealth of Australia', 'Australia', 'Australian', '#4a8798', 'melbourne', 'commercial', arms('azure', 'chief', 'gules', 'star', 'argent'), 'A federation of six colonies since 1901, a continent of wool and gold with five million people, governing Papua.', 'Wool and gold: trade pays well.', 'An empty continent far from everyone.', { tradeMul: 0.2, incomeMul: 0.1, manpowerMul: -0.2 }, 'Dominion', 'standard'),
  nation('nzl', 'Dominion of New Zealand', 'New Zealand', 'New Zealand', '#5a6a9e', 'wellington', 'commercial', arms('azure', 'bordure', 'argent', 'ship', 'argent'), 'The southernmost dominion, a land of sheep and dairies loyal to Britain.', 'Wool and butter.', 'Small and remote.', { tradeMul: 0.2, manpowerMul: -0.15 }, 'Dominion', 'challenging'),
];

/** The realms of the Europe map drawn as part of a neighbour on a world map. */
const FOLD: Record<string, string> = { lux: 'ger', mon: 'ser' };

export const CAPITALS: Record<string, [string, string]> = {
  gbr: ['London', 'GBR'],
  fra: ['Paris', 'FRA'],
  ger: ['Berlin', 'DEU'],
  aus: ['Vienna', 'AUT'],
  rus: ['St. Petersburg', 'RUS'],
  ita: ['Rome', 'ITA'],
  ott: ['Istanbul', 'TUR'],
  spa: ['Madrid', 'ESP'],
  por: ['Lisbon', 'PRT'],
  ned: ['Amsterdam', 'NLD'],
  bel: ['Brussels', 'BEL'],
  swi: ['Bern', 'CHE'],
  den: ['København', 'DNK'],
  swe: ['Stockholm', 'SWE'],
  nor: ['Oslo', 'NOR'],
  rom: ['Bucharest', 'ROU'],
  bul: ['Sofia', 'BGR'],
  ser: ['Belgrade', 'SRB'],
  gre: ['Athens', 'GRC'],
  alb: ['Durrës', 'ALB'],
  per: ['Tehran', 'IRN'],
  afg: ['Kabul', 'AFG'],
  njd: ['Riyadh', 'SAU'],
  omn: ['Muscat', 'OMN'],
  nep: ['Kathmandu', 'NPL'],
  chn: ['Beijing', 'CHN'],
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
  ast: ['Melbourne', 'AUS'],
  nzl: ['Wellington', 'NZL'],
};

// ───────────────────────────── 1914 ownership ──────────────────────────────

const inList = (name: string, list: string) => list.split('|').includes(name);
const EU_REALM = new Map(EU_REGIONS.map((r) => [r.id, r.realm]));
const EU_NAME = new Map(EU_REGIONS.map((r) => [r.id, r.name]));
/** Countries the Europe map classifies (its frame covers them whole). */
const EUROPE = new Set('GBR IMN GGY JEY IRL CYP CYN ESB WSB MLT GIB FRA MCO ESP AND PRT DEU DNK POL LTU LVA EST BLR UKR MDA ROU BGR SRB KOS MNE ALB MKD GRC TUR BIH HRV SVN AUT CZE SVK HUN ITA SMR VAT CHE LIE LUX BEL NLD NOR SWE FIN ALD GEO ARM AZE MAR TUN ISR PSX LBN SYR JOR IRQ EGY'.split(' '));
/** Where the Europe map leaves a division off (beyond its frame), whose it was. */
const OVERSEAS: Record<string, string> = { FRA: 'fra', ESP: 'spa', PRT: 'por' };

/** German New Guinea: north of the line from 5° S on the Dutch border to 8° S on the east coast. */
const germanNewGuinea = (lon: number, lat: number) => lat > -5 - ((lon - 141) * 3) / 6.9;

/** Colonies, protectorates and states outside Europe: the realm that held them in mid-1914. */
const HELD: Record<string, string> = {
  // Africa
  SAH: 'spa', MRT: 'fra', SEN: 'fra', GMB: 'gbr', GNB: 'por', GIN: 'fra', SLE: 'gbr', LBR: 'lbr', CIV: 'fra', BFA: 'fra', MLI: 'fra', NER: 'fra', BEN: 'fra', TGO: 'ger', NGA: 'gbr', CMR: 'ger', TCD: 'fra', CAF: 'fra', GAB: 'fra', COG: 'fra', GNQ: 'spa', STP: 'por', COD: 'bel', AGO: 'por', NAM: 'ger', ZAF: 'saf', BWA: 'gbr', LSO: 'gbr', SWZ: 'gbr', ZWE: 'gbr', ZMB: 'gbr', MWI: 'gbr', MOZ: 'por', RWA: 'ger', BDI: 'ger', UGA: 'gbr', KEN: 'gbr', ETH: 'eth', ERI: 'ita', DJI: 'fra', SOM: 'ita', SOL: 'gbr', SDN: 'gbr', SDS: 'gbr', DZA: 'fra', LBY: 'ita', MDG: 'fra', COM: 'fra', MUS: 'gbr', SYC: 'gbr', CPV: 'por', SHN: 'gbr',
  // Asia
  KAZ: 'rus', UZB: 'rus', TKM: 'rus', KGZ: 'rus', TJK: 'rus', IRN: 'per', AFG: 'afg', PAK: 'gbr', IND: 'gbr', BGD: 'gbr', LKA: 'gbr', MDV: 'gbr', BTN: 'gbr', NPL: 'nep', MMR: 'gbr', THA: 'sia', LAO: 'fra', KHM: 'fra', VNM: 'fra', MYS: 'gbr', SGP: 'gbr', BRN: 'gbr', IDN: 'ned', TLS: 'por', PHL: 'usa', MNG: 'mgl', KOR: 'jpn', PRK: 'jpn', JPN: 'jpn', TWN: 'jpn', HKG: 'chn', MAC: 'chn', OMN: 'omn', ARE: 'gbr', QAT: 'gbr', BHR: 'gbr', KWT: 'gbr',
  // Oceania
  AUS: 'ast', NZL: 'nzl', SLB: 'gbr', VUT: 'gbr', NCL: 'fra', FJI: 'gbr', PYF: 'fra', WSM: 'ger', TON: 'gbr', GUM: 'usa', MNP: 'ger', PLW: 'ger', FSM: 'ger', MHL: 'ger', NRU: 'ger', KIR: 'gbr', ASM: 'usa',
  // the Americas
  USA: 'usa', PRI: 'usa', VIR: 'den', CAN: 'can', GRL: 'den', ISL: 'den', FRO: 'den', MEX: 'mex', GTM: 'gua', BLZ: 'gbr', HND: 'hon', SLV: 'sal', NIC: 'nic', CRI: 'cri', PAN: 'pan', CUB: 'cub', USG: 'cub', HTI: 'hai', DOM: 'dom', JAM: 'gbr', BHS: 'gbr', TTO: 'gbr', BRB: 'gbr', CYM: 'gbr', TCA: 'gbr', BMU: 'gbr', COL: 'col', VEN: 'ven', GUY: 'gbr', SUR: 'ned', ECU: 'ecu', PER: 'pru', BRA: 'bra', BOL: 'bol', PRY: 'par', URY: 'uru', ARG: 'arg', CHL: 'chi', FLK: 'gbr',
};

export function realmOf(d: Division, lon: number, lat: number): string | null | undefined {
  const n = d.name;
  switch (d.adm0) {
    case 'RUS':
      if (n === 'Kaliningrad') return 'ger';
      // southern Sakhalin (Karafuto) and the Kurils were Japanese
      if (n === 'Sakhalin') return lon > 145.5 || lat < 50 ? 'jpn' : 'rus';
      return 'rus';
    case 'NOR':
      // Svalbard was no one's until 1920
      if (inList(n, 'Svalbard|Jan Mayen')) return null;
      break;
    case 'MAR':
      // Cape Juby, south of the Draa, was Spanish
      if (lat < 27.67) return 'spa';
      break;
    case 'SAU':
      if (inList(n, 'Ar Riyad|Al Quassim|Ash Sharqiyah')) return 'njd';
      return 'ott';
    case 'YEM':
      return inList(n, '`Adan|Lahij|Abyan|Al Dali\'|Shabwah|Hadramawt|Al Mahrah') ? 'gbr' : 'ott';
    case 'TZA':
      return inList(n, 'Zanzibar South and Central|Kaskazini-Unguja|Zanzibar West|Kusini-Pemba|Kaskazini-Pemba') ? 'gbr' : 'ger';
    case 'GHA':
      // the Volta region was German Togoland
      return n === 'Volta' ? 'ger' : 'gbr';
    case 'PNG':
      return germanNewGuinea(lon, lat) || inList(n, 'Morobe|Madang|East Sepik|Sandaun|Manus|New Ireland|East New Britain|West New Britain|North Solomons') ? 'ger' : 'ast';
    case 'PER':
      // Tacna was under Chilean occupation from 1880 to 1929
      return n === 'Tacna' ? 'chi' : 'pru';
    case 'CHN':
      return n === 'Xizang' ? 'tib' : n === 'Paracel Islands' ? null : 'chn';
    case 'CAN':
      // Newfoundland, a dominion of its own, is drawn as British
      return n === 'Newfoundland and Labrador' ? 'gbr' : 'can';
    case 'ESP':
      if (n === 'Canarias' || d.group === 'Canarias') return 'spa';
      break;
    case 'KWT':
      return 'gbr';
  }
  if (EUROPE.has(d.adm0)) {
    const r = euClassify(d, lon, lat);
    if (r === undefined) return undefined;
    if (r === null) return OVERSEAS[d.adm0] ?? null;
    const realm = EU_REALM.get(r)!;
    return FOLD[realm] ?? realm;
  }
  if (d.adm0 in HELD) return HELD[d.adm0];
  // uninhabited outposts and the far southern islands
  if (inList(d.adm0, 'ATA|ATF|HMD|SGS|BVT|IOT|IOA|ATC|CSI|CLP|PGA|KAS|KAB|UMI|PCN|NFK|COK|NIU|TKL|WLF|TUV|SPM|AIA|ATG|DMA|GRD|KNA|LCA|VCT|MSR|VGB|ABW|CUW|SXM|BLM|MAF|BES')) return null;
  return undefined;
}

// ───────────────────────────── lands and region names ──────────────────────

/** Europe-map regions grouped into the lands a world map divides further. */
const EU_LAND: Record<string, string> = {
  ulster: 'Ireland', leinster: 'Ireland', munster: 'Ireland', connacht: 'Ireland',
  egypt: 'Egypt', sinai: 'Egypt', westerndesert: 'Egypt', cyprus: 'Cyprus', malta: 'Malta',
  algiers: 'Algeria', oran: 'Algeria', constantine: 'Algeria', algsahara: 'Algeria', tunis: 'Tunisia', southtunisia: 'Tunisia',
  fez: 'Morocco', rabat: 'Morocco', marrakesh: 'Morocco', oriental: 'Morocco', spmorocco: 'Spanish Morocco',
  tripolitania: 'Libya', cyrenaica: 'Libya', dodecanese: 'Dodecanese',
  finlands: 'Finland', finlandc: 'Finland', finlandn: 'Finland', congress: 'Poland', lublin: 'Poland',
  estland: 'Baltic Provinces', livland: 'Baltic Provinces', courland: 'Baltic Provinces', kovno: 'Baltic Provinces', vilna: 'Baltic Provinces',
  georgia: 'Caucasus', erivan: 'Caucasus', baku: 'Caucasus', kars: 'Caucasus', terek: 'Caucasus', kuban: 'Caucasus', stavropol: 'Caucasus',
  volhynia: 'Little Russia', podolia: 'Little Russia', kiev: 'Little Russia', chernigov: 'Little Russia', poltava: 'Little Russia', donets: 'Little Russia', ekaterinoslav: 'Little Russia', kherson: 'Little Russia', taurida: 'Little Russia', bessarabia: 'Little Russia', don: 'Little Russia',
  aleppo: 'Syria', syria: 'Syria', beirut: 'Syria', jerusalem: 'Syria', transjordan: 'Syria', zor: 'Syria', mosul: 'Iraq', baghdad: 'Iraq', basra: 'Iraq', arabia: 'Jabal Shammar',
};
const EU_REALM_LAND: Record<string, string> = {
  gbr: 'Britain', fra: 'France', ger: 'Germany', aus: 'Austria-Hungary', rus: 'Great Russia', ita: 'Italy', ott: 'Anatolia', spa: 'Spain', por: 'Portugal', ned: 'Netherlands', bel: 'Belgium', swi: 'Switzerland', den: 'Denmark', swe: 'Sweden', nor: 'Norway', rom: 'Romania', bul: 'Bulgaria', ser: 'Serbia', gre: 'Greece', alb: 'Albania', per: 'Persia',
};

const euCache = new Map<string, string | null | undefined>();
/** The Europe-map region of a division, at its label point (for grouping and naming); Russia's European governorates too. */
function euRegionOf(d: Division): string | null | undefined {
  if (!EUROPE.has(d.adm0) && d.adm0 !== 'RUS') return undefined;
  const key = String(d.props.adm1_code);
  if (!euCache.has(key)) euCache.set(key, euClassify(d, Number(d.props.longitude), Number(d.props.latitude)));
  return euCache.get(key);
}

const INDONESIA: Array<[string, RegExp]> = [
  ['Java', /^(Jawa|Banten|Jakarta|Yogyakarta)/],
  ['Lesser Sunda Islands', /^(Bali|Nusa Tenggara)/],
  ['Dutch Borneo', /^Kalimantan/],
  ['Celebes', /^(Sulawesi|Gorontalo)/],
  ['Moluccas', /^Maluku/],
  ['Dutch New Guinea', /^Papua/],
  ['Sumatra', /./],
];

/** The land a division's regions stay within: a colony, a country, or a part of a large realm. */
export function landOf(d: Division, realm: string): string {
  const n = d.name;
  const eu = euRegionOf(d);
  // a division the Europe map gives to another realm (Cape Juby, southern Sakhalin…) is grouped by its own realm here
  if (eu && (FOLD[EU_REALM.get(eu)!] ?? EU_REALM.get(eu)) === realm) return EU_LAND[eu] ?? EU_REALM_LAND[realm] ?? realm;
  switch (d.adm0) {
    case 'FRA':
    case 'ESP':
    case 'PRT':
      if (!eu) return OVERSEAS_LAND[d.group] ?? OVERSEAS_LAND[n] ?? (d.group || n);
      break;
    case 'RUS':
      if (realm === 'jpn') return 'Karafuto';
      if (realm === 'ger') return 'Germany';
      return d.group === 'Far Eastern' ? 'Russian Far East' : d.group === 'Siberian' || d.group === 'Urals' ? 'Siberia' : 'Great Russia';
    case 'KAZ':
      return 'Steppe';
    case 'UZB':
    case 'TKM':
    case 'KGZ':
    case 'TJK':
      return 'Turkestan';
    case 'IRN':
      return 'Persia';
    case 'SAU':
      if (realm === 'njd') return n === 'Ash Sharqiyah' ? 'Hasa' : 'Najd';
      return inList(n, "Ha'il|Al Jawf|Al Hudud ash Shamaliyah") ? 'Jabal Shammar' : inList(n, '`Asir|Jizan|Najran') ? 'Asir' : 'Hejaz';
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
      if (inList(n, 'Heilongjiang|Jilin|Liaoning')) return 'Manchuria';
      if (n === 'Inner Mongol') return 'Inner Mongolia';
      if (n === 'Xinjiang') return 'Sinkiang';
      if (n === 'Qinghai') return 'Kokonor';
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
      return realm === 'ger' ? 'Kaiser-Wilhelmsland' : 'Papua';
    case 'TZA':
    case 'RWA':
    case 'BDI':
      return realm === 'gbr' ? 'Zanzibar' : 'German East Africa';
    case 'GHA':
      return realm === 'ger' ? 'Togoland' : 'Gold Coast';
    case 'MLI':
    case 'BFA':
      return 'Upper Senegal and Niger';
    case 'SDN':
    case 'SDS':
      return 'Sudan';
    case 'SOM':
      return 'Italian Somaliland';
    case 'ZAF':
      return 'South Africa';
    case 'PER':
      return realm === 'chi' ? 'Chile' : 'Peru';
    case 'MAR':
      return 'Río de Oro';
  }
  // a division the Europe map gives to a neighbour at its label point (Funen, Kavala): its realm's European land
  return COLONY[d.adm0] ?? (EUROPE.has(d.adm0) ? EU_REALM_LAND[realm] : undefined) ?? d.adm0;
}

/** Overseas parts of European countries Natural Earth counts as divisions. */
const OVERSEAS_LAND: Record<string, string> = {
  'Guyane française': 'French Guiana', Guyane: 'French Guiana', 'La Réunion': 'Réunion', Réunion: 'Réunion', Martinique: 'Martinique', Guadeloupe: 'Guadeloupe', Mayotte: 'Comoros',
  Canarias: 'Canary Islands', 'Las Palmas': 'Canary Islands', 'Santa Cruz de Tenerife': 'Canary Islands', Azores: 'Azores', Madeira: 'Madeira',
};

/** Lands named after the country or colony of 1914. */
const COLONY: Record<string, string> = {
  SAH: 'Río de Oro', MRT: 'Mauritania', SEN: 'Senegal', GMB: 'Gambia', GNB: 'Portuguese Guinea', GIN: 'French Guinea', SLE: 'Sierra Leone', LBR: 'Liberia', CIV: 'Ivory Coast', NER: 'Niger Territory', BEN: 'Dahomey', TGO: 'Togoland', NGA: 'Nigeria', CMR: 'Kamerun', TCD: 'Chad', CAF: 'Ubangi-Shari', GAB: 'Gabon', COG: 'Middle Congo', GNQ: 'Spanish Guinea', STP: 'São Tomé', COD: 'Belgian Congo', AGO: 'Angola', NAM: 'German South West Africa', BWA: 'Bechuanaland', LSO: 'Basutoland', SWZ: 'Swaziland', ZWE: 'Southern Rhodesia', ZMB: 'Northern Rhodesia', MWI: 'Nyasaland', MOZ: 'Mozambique', UGA: 'Uganda', KEN: 'British East Africa', ETH: 'Abyssinia', ERI: 'Eritrea', DJI: 'French Somaliland', SOL: 'British Somaliland', DZA: 'Algeria', LBY: 'Libya', MDG: 'Madagascar', COM: 'Comoros', MUS: 'Mauritius', SYC: 'Seychelles', CPV: 'Cape Verde',
  AFG: 'Afghanistan', NPL: 'Nepal', THA: 'Siam', LAO: 'Laos', KHM: 'Cambodia', TLS: 'Portuguese Timor', PHL: 'Philippines', MNG: 'Mongolia', OMN: 'Oman', ARE: 'Trucial Coast', QAT: 'Qatar', BHR: 'Bahrain', KWT: 'Kuwait',
  AUS: 'Australia', NZL: 'New Zealand', SLB: 'Solomon Islands', VUT: 'New Hebrides', NCL: 'New Caledonia', FJI: 'Fiji',
  PRI: 'Puerto Rico', GRL: 'Greenland', ISL: 'Iceland', FRO: 'Faroe Islands', MEX: 'Mexico', GTM: 'Guatemala', BLZ: 'British Honduras', HND: 'Honduras', SLV: 'El Salvador', NIC: 'Nicaragua', CRI: 'Costa Rica', PAN: 'Panama', CUB: 'Cuba', HTI: 'Haiti', DOM: 'Santo Domingo', JAM: 'Jamaica', BHS: 'Bahamas', TTO: 'Trinidad', COL: 'Colombia', VEN: 'Venezuela', GUY: 'British Guiana', SUR: 'Dutch Guiana', ECU: 'Ecuador', BRA: 'Brazil', BOL: 'Bolivia', PRY: 'Paraguay', URY: 'Uruguay', ARG: 'Argentina', CHL: 'Chile', FLK: 'Falkland Islands',
};

/** Present-day divisions → the province, state or territory of 1914 they lay in (or its name then). */
const PERIOD: Record<string, string> = {
  // China: the provinces in the postal romanisation of the time
  'CHN/Hebei': 'Chihli', 'CHN/Beijing': 'Chihli', 'CHN/Tianjin': 'Chihli', 'CHN/Shandong': 'Shantung', 'CHN/Henan': 'Honan', 'CHN/Shanxi': 'Shansi', 'CHN/Shaanxi': 'Shensi', 'CHN/Gansu': 'Kansu', 'CHN/Ningxia': 'Kansu', 'CHN/Sichuan': 'Szechwan', 'CHN/Chongqing': 'Szechwan', 'CHN/Hubei': 'Hupeh', 'CHN/Hunan': 'Hunan', 'CHN/Jiangxi': 'Kiangsi', 'CHN/Anhui': 'Anhwei', 'CHN/Jiangsu': 'Kiangsu', 'CHN/Shanghai': 'Kiangsu', 'CHN/Zhejiang': 'Chekiang', 'CHN/Fujian': 'Fukien', 'CHN/Guangdong': 'Kwangtung', 'CHN/Hainan': 'Kwangtung', 'CHN/Guangxi': 'Kwangsi', 'CHN/Guizhou': 'Kweichow', 'CHN/Yunnan': 'Yunnan', 'CHN/Heilongjiang': 'Heilungkiang', 'CHN/Jilin': 'Kirin', 'CHN/Liaoning': 'Fengtien', 'CHN/Xinjiang': 'Sinkiang', 'CHN/Qinghai': 'Kokonor', 'CHN/Inner Mongol': 'Inner Mongolia', 'CHN/Xizang': 'Tibet',
  // British India: the provinces and the largest princely states
  'IND/Uttar Pradesh': 'United Provinces', 'IND/Uttarakhand': 'United Provinces', 'IND/Bihar': 'Bihar and Orissa', 'IND/Jharkhand': 'Bihar and Orissa', 'IND/Odisha': 'Bihar and Orissa', 'IND/West Bengal': 'Bengal', 'IND/Sikkim': 'Sikkim', 'IND/Assam': 'Assam', 'IND/Meghalaya': 'Assam', 'IND/Nagaland': 'Assam', 'IND/Manipur': 'Manipur', 'IND/Mizoram': 'Assam', 'IND/Tripura': 'Bengal', 'IND/Arunachal Pradesh': 'North-East Frontier', 'IND/Madhya Pradesh': 'Central India', 'IND/Chhattisgarh': 'Central Provinces', 'IND/Maharashtra': 'Bombay', 'IND/Gujarat': 'Bombay', 'IND/Goa': 'Bombay', 'IND/Dadra and Nagar Haveli and Daman and Diu': 'Bombay', 'IND/Rajasthan': 'Rajputana', 'IND/Punjab': 'Punjab', 'IND/Haryana': 'Punjab', 'IND/Delhi': 'Delhi', 'IND/Chandigarh': 'Punjab', 'IND/Himachal Pradesh': 'Punjab Hill States', 'IND/Jammu and Kashmir': 'Kashmir', 'IND/Ladakh': 'Ladakh', 'IND/Telangana': 'Hyderabad', 'IND/Andhra Pradesh': 'Madras', 'IND/Tamil Nadu': 'Madras', 'IND/Puducherry': 'Madras', 'IND/Karnataka': 'Mysore', 'IND/Kerala': 'Travancore and Malabar',
  'PAK/Punjab': 'Punjab', 'PAK/Sind': 'Sind', 'PAK/Baluchistan': 'Baluchistan', 'PAK/K.P.': 'North-West Frontier', 'PAK/F.A.T.A.': 'North-West Frontier', 'PAK/F.C.T.': 'Punjab', 'PAK/Northern Areas': 'Gilgit', 'PAK/Azad Kashmir': 'Kashmir',
  'BGD/Dhaka': 'Eastern Bengal', 'BGD/Chittagong': 'Chittagong', 'BGD/Sylhet': 'Assam', 'BGD/Rangpur': 'Northern Bengal', 'BGD/Rajshahi': 'Northern Bengal', 'BGD/Khulna': 'Bengal', 'BGD/Barisal': 'Eastern Bengal', 'BTN/': 'Bhutan',
  'MMR/Yangon': 'Pegu', 'MMR/Bago': 'Pegu', 'MMR/Ayeyarwady': 'Irrawaddy', 'MMR/Mandalay': 'Upper Burma', 'MMR/Sagaing': 'Upper Burma', 'MMR/Magway': 'Upper Burma', 'MMR/Shan': 'Shan States', 'MMR/Kayah': 'Shan States', 'MMR/Kachin': 'Kachin Hills', 'MMR/Rakhine': 'Arakan', 'MMR/Chin': 'Arakan', 'MMR/Kayin': 'Tenasserim', 'MMR/Mon': 'Tenasserim', 'MMR/Tanintharyi': 'Tenasserim',
  // Russia in Asia: the governorates and oblasts
  'RUS/Sverdlovsk': 'Perm', 'RUS/Chelyabinsk': 'Orenburg', 'RUS/Kurgan': 'Tobolsk', "RUS/Tyumen'": 'Tobolsk', 'RUS/Khanty-Mansiy': 'Tobolsk', 'RUS/Yamal-Nenets': 'Obdorsk', 'RUS/null': 'Obdorsk', 'RUS/Omsk': 'Akmolinsk', 'RUS/Novosibirsk': 'Tomsk', 'RUS/Tomsk': 'Tomsk', 'RUS/Kemerovo': 'Kuznetsk', 'RUS/Altay': 'Altai', 'RUS/Gorno-Altay': 'Altai', 'RUS/Krasnoyarsk': 'Yeniseisk', 'RUS/Khakass': 'Minusinsk', 'RUS/Tuva': 'Uryankhay', 'RUS/Irkutsk': 'Irkutsk', 'RUS/Buryat': 'Transbaikalia', 'RUS/Chita': 'Transbaikalia', 'RUS/Sakha (Yakutia)': 'Yakutsk', 'RUS/Amur': 'Amur', 'RUS/Yevrey': 'Amur', 'RUS/Khabarovsk': 'Primorye', "RUS/Primor'ye": 'Primorye', 'RUS/Maga Buryatdan': 'Okhotsk', 'RUS/Chukchi Autonomous Okrug': 'Anadyr', 'RUS/Kamchatka': 'Kamchatka', 'RUS/Sakhalin': 'Sakhalin',
  'KAZ/West Kazakhstan': 'Uralsk', 'KAZ/Atyrau': 'Uralsk', 'KAZ/Aqtöbe': 'Turgai', 'KAZ/Qostanay': 'Turgai', 'KAZ/North Kazakhstan': 'Akmolinsk', 'KAZ/Aqmola': 'Akmolinsk', 'KAZ/Astana': 'Akmolinsk', 'KAZ/Qaraghandy': 'Akmolinsk', 'KAZ/Pavlodar': 'Semipalatinsk', 'KAZ/East Kazakhstan': 'Semipalatinsk', 'KAZ/Almaty': 'Semirechye', 'KAZ/Almaty City': 'Semirechye', 'KAZ/Zhambyl': 'Syr-Darya', 'KAZ/South Kazakhstan': 'Syr-Darya', 'KAZ/Qyzylorda': 'Syr-Darya', 'KAZ/Mangghystau': 'Transcaspia',
  // Canada and Newfoundland
  'CAN/Northwest Territories': 'Mackenzie', 'CAN/Nunavut': 'Keewatin', 'CAN/Québec': 'Quebec', 'CAN/Newfoundland and Labrador': 'Newfoundland',
  // Latin America: territories of the time
  'MEX/Distrito Federal': 'Federal District', 'MEX/Quintana Roo': 'Yucatán', 'MEX/Baja California Sur': 'Lower California', 'MEX/Baja California': 'Lower California', 'MEX/null': 'Yucatán',
  'BRA/Distrito Federal': 'Goiás', 'BRA/Tocantins': 'Goiás', 'BRA/Mato Grosso do Sul': 'Mato Grosso', 'BRA/Rondônia': 'Mato Grosso', 'BRA/Roraima': 'Amazonas', 'BRA/Amapá': 'Pará', 'BRA/Rio de Janeiro': 'Rio de Janeiro',
  'ARG/Ciudad de Buenos Aires': 'Buenos Aires',
  'CHL/Arica y Parinacota': 'Tacna', 'CHL/Región Metropolitana de Santiago': 'Santiago', "CHL/Libertador General Bernardo O'Higgins": 'Colchagua', 'CHL/Ñuble': 'Ñuble', 'CHL/La Araucanía': 'Araucanía', 'CHL/Los Ríos': 'Valdivia', 'CHL/Los Lagos': 'Llanquihue', 'CHL/Aisén del General Carlos Ibáñez del Campo': 'Aysén', 'CHL/Magallanes y Antártica Chilena': 'Magallanes', 'PER/Tacna': 'Tacna',
  // Australia: the Northern Territory (under the Commonwealth since 1911)
  'AUS/Australian Capital Territory': 'New South Wales', 'AUS/Jervis Bay Territory': 'New South Wales',
  // South Africa: the four provinces of the Union
  'ZAF/Western Cape': 'Cape Province', 'ZAF/Northern Cape': 'Cape Province', 'ZAF/Eastern Cape': 'Cape Province', 'ZAF/North West': 'Transvaal', 'ZAF/Gauteng': 'Transvaal', 'ZAF/Mpumalanga': 'Transvaal', 'ZAF/Limpopo': 'Transvaal', 'ZAF/Free State': 'Orange Free State', 'ZAF/KwaZulu-Natal': 'Natal',
  // Persia: provinces of the time
  'IRN/West Azarbaijan': 'Azerbaijan', 'IRN/East Azarbaijan': 'Azerbaijan', 'IRN/Ardebil': 'Azerbaijan', 'IRN/Zanjan': 'Khamseh', 'IRN/Kordestan': 'Kurdistan', 'IRN/Lorestan': 'Luristan', 'IRN/Khuzestan': 'Arabistan', 'IRN/Markazi': 'Iraq-i Ajam', 'IRN/Alborz': 'Tehran', 'IRN/Ilam': 'Pusht-i Kuh',
  'IRN/Razavi Khorasan': 'Khorasan', 'IRN/North Khorasan': 'Khorasan', 'IRN/South Khorasan': 'Khorasan', 'IRN/Sistan and Baluchestan': 'Seistan and Baluchistan', 'IRN/Esfahan': 'Isfahan', 'IRN/Chahar Mahall and Bakhtiari': 'Bakhtiari', 'IRN/Kohgiluyeh and Buyer Ahmad': 'Fars', 'IRN/Hormozgan': 'Gulf Ports', 'IRN/Bushehr': 'Gulf Ports', 'IRN/Golestan': 'Astarabad', 'IRN/Semnan': 'Khorasan',
  // Japan's regions; Korea's provinces under Japanese names are not used
  'NZL/': 'New Zealand',
};
/** Divisions named by the larger region Natural Earth gives (Japan's regions, Thailand's, New Zealand's islands). */
const BY_GROUP = new Set(['JPN', 'THA', 'NZL', 'KOR', 'PRK']);
const THAI: Record<string, string> = { Northern: 'Northern Siam', Northeastern: 'Isan', Central: 'Central Siam', Eastern: 'Eastern Siam', Western: 'Western Siam', Southern: 'Southern Siam' };

function periodName(d: Division): string {
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
}

/** Lands whose regions are named after the land alone (one name, with directions where there are several). */
const BY_LAND = new Set(['Upper Senegal and Niger', 'Nigeria', 'Kamerun', 'Belgian Congo', 'Angola', 'German East Africa', 'Sudan', 'Abyssinia', 'Mozambique', 'Madagascar', 'Chad', 'Niger Territory', 'Mauritania', 'Algeria', 'Libya', 'Egypt', 'Río de Oro', 'Italian Somaliland', 'British East Africa', 'Northern Rhodesia', 'Southern Rhodesia', 'Bechuanaland', 'German South West Africa', 'Ubangi-Shari', 'Middle Congo', 'Gabon', 'French Guinea', 'Ivory Coast', 'Gold Coast', 'Senegal', 'Dahomey', 'Uganda', 'Tunisia', 'Hejaz', 'Yemen', 'Aden', 'Oman', 'Trucial Coast', 'Afghanistan', 'Mongolia', 'Inner Mongolia', 'Sinkiang', 'Kokonor', 'Tibet', 'Dutch Borneo', 'Sumatra', 'Celebes', 'Java', 'Moluccas', 'Dutch New Guinea', 'Lesser Sunda Islands', 'Kaiser-Wilhelmsland', 'Papua', 'Sarawak', 'North Borneo', 'Malaya', 'Laos', 'Cambodia', 'Tonkin', 'Annam', 'Cochinchina', 'Formosa', 'Karafuto', 'Greenland', 'Iceland', 'Alaska', 'Newfoundland', 'Northern Territories', 'Turkestan', 'Steppe', 'Burma', 'Ceylon', 'Nepal', 'Najd', 'Jabal Shammar', 'Asir', 'Hasa', 'Bolivia', 'Paraguay', 'Uruguay', 'Ecuador', 'Venezuela', 'Colombia', 'Guatemala', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Haiti', 'Santo Domingo', 'El Salvador', 'British Guiana', 'Dutch Guiana', 'French Guiana', 'Peru']);

export function regionName(land: string, _realm: string, divisions: Division[], single: boolean, shares: number[]): string {
  if (single || BY_LAND.has(land)) return land;
  const names: Array<[string, number]> = [];
  divisions.forEach((d, i) => {
    const n = periodName(d);
    const hit = names.find((x) => x[0] === n);
    if (hit) hit[1] += shares[i];
    else names.push([n, shares[i]]);
  });
  names.sort((a, b) => b[1] - a[1]);
  // two names joined, unless either is already a pair (Fez and Meknes)
  if (names.length > 1 && names[1][1] >= 0.3 && !/ and /.test(names[0][0] + names[1][0])) return `${names[0][0]} and ${names[1][0]}`;
  return names[0][0];
}

// ───────────────────────────── climate, terrain and density ────────────────

type Zone = 'polar' | 'icecap' | 'boreal' | 'temperate' | 'steppe' | 'desert' | 'med' | 'mountain' | 'highland' | 'rainforest' | 'savanna' | 'monsoon' | 'river';
const box = (lon: number, lat: number, w: number, e: number, s: number, n: number) => lon >= w && lon <= e && lat >= s && lat <= n;

/** The climate of a place, from boxes drawn round the world's great landscapes. */
export function zoneOf(lat: number, lon: number): Zone {
  const a = Math.abs(lat);
  if (box(lon, lat, -55, -20, 59, 84)) return 'icecap';
  if (box(lon, lat, 29.5, 33.5, 22, 31.6)) return 'river'; // the Nile valley and delta
  if (box(lon, lat, 44, 48.5, 30, 34)) return 'river'; // lower Mesopotamia
  if (box(lon, lat, 70, 75, 25, 32) && lon < 72.5) return 'river'; // the Indus
  // mountains first: they rise out of every climate
  if (box(lon, lat, 75, 104, 27.5, 37) || box(lon, lat, 68, 82, 36, 43) || box(lon, lat, 84, 100, 47.5, 53.5)) return 'mountain';
  if (box(lon, lat, -80, -72, -5, 11) || box(lon, lat, -79, -66, -18, -5) || box(lon, lat, -71, -66, -35, -18) || box(lon, lat, -74, -70, -46, -35)) return 'mountain';
  if (box(lon, lat, -125, -105, 37, 60) || box(lon, lat, -108, -97, 17, 26)) return 'mountain';
  if (box(lon, lat, 6, 14.5, 45.5, 47.6) || box(lon, lat, 40, 48, 41, 44) || box(lon, lat, 35, 41, 6, 15) || box(lon, lat, 66, 74, 33, 37) || box(lon, lat, 46, 54, 28, 35.5)) return 'mountain';
  if (box(lon, lat, 43, 46, 13, 17) || box(lon, lat, 6, 18, 60, 70) || box(lon, lat, 29, 44, 37, 41) || box(lon, lat, -9, 3, 30, 35)) return 'highland';
  if (a > 66) return 'polar';
  // deserts
  if (box(lon, lat, -17, 35, 16, 30.6) || box(lon, lat, 34, 56, 15, 30) || box(lon, lat, 54, 66, 25, 35) || box(lon, lat, 69, 74, 24, 29.5) || box(lon, lat, 52, 66, 37, 45) || box(lon, lat, 76, 112, 37, 45.5)) return 'desert';
  if (box(lon, lat, 12, 24, -28, -18) || box(lon, lat, 117, 142, -32, -19) || box(lon, lat, -71, -68, -27, -18) || box(lon, lat, -117, -104, 28, 37) || box(lon, lat, 41, 51, 3, 11)) return 'desert';
  // grasslands
  if (box(lon, lat, 30, 90, 45, 55) || box(lon, lat, 88, 122, 42, 52) || box(lon, lat, -110, -96, 30, 52) || box(lon, lat, -72, -63, -56, -39) || box(lon, lat, -17, 40, 11, 16.5) || box(lon, lat, 18, 30, -33, -26) || box(lon, lat, 114, 152, -38, -19)) return 'steppe';
  // the wet tropics
  if (box(lon, lat, -80, -44, -10, 8) || box(lon, lat, 9, 31, -6, 5) || box(lon, lat, -13, 9, 4, 8.5) || box(lon, lat, 95, 152, -10, 8) || box(lon, lat, -92, -76, 7, 18) || box(lon, lat, 47.5, 50.5, -25, -12)) return 'rainforest';
  if (box(lon, lat, 72, 122, 8, 28)) return 'monsoon';
  if (a < 23) return 'savanna';
  // mediterranean coasts
  if (box(lon, lat, -10, 40, 30, 44.5) || box(lon, lat, -124, -117, 32, 40) || box(lon, lat, -73, -70, -38, -30) || box(lon, lat, 17, 22, -35, -32) || box(lon, lat, 114, 119, -36, -30) || box(lon, lat, 135, 141, -38, -33)) return 'med';
  if (a > 54 || (lat > 50 && lon > 60) || (lat > 48 && lon < -55 && lon > -100)) return 'boreal';
  return 'temperate';
}

const BIOME: Record<Zone, Partial<Record<Terrain, number>>> = {
  polar: { marsh: 2.2, hills: 1.6, forest: 0.6, plains: 0.3 },
  icecap: { mountains: 2.4, hills: 1.6, marsh: 0.6 },
  boreal: { forest: 3.4, marsh: 2, plains: 0.5, hills: 0.4 },
  temperate: { plains: 3, forest: 2, hills: 1, marsh: 0.4 },
  steppe: { steppe: 3.4, plains: 1.6, hills: 0.3 },
  desert: { steppe: 3.6, hills: 1.2, mountains: 0.4 },
  med: { hills: 2.6, plains: 2, forest: 0.6, mountains: 0.6 },
  mountain: { mountains: 2.2, hills: 2.2, forest: 1, plains: 0.3 },
  highland: { hills: 3, mountains: 1, plains: 1.2, forest: 0.8 },
  rainforest: { forest: 3.6, marsh: 1.4, hills: 0.6, plains: 0.5 },
  savanna: { plains: 2.4, steppe: 1.6, forest: 1, hills: 0.6 },
  monsoon: { plains: 3.4, forest: 1.4, hills: 0.8, marsh: 0.8 },
  river: { plains: 4, marsh: 1, steppe: 0.6 },
};

/** How thinly settled each land was: its provinces are this many times the standard area. */
const LAND_SPARSE: Record<string, number> = {
  Britain: 0.2, Ireland: 0.32, France: 0.24, Germany: 0.2, 'Austria-Hungary': 0.26, Italy: 0.24, Spain: 0.38, Portugal: 0.32, Netherlands: 0.22, Belgium: 0.22, Switzerland: 0.26, Denmark: 0.3, Sweden: 0.55, Norway: 0.6, Finland: 0.6, Poland: 0.24, 'Baltic Provinces': 0.36, 'Great Russia': 0.5, 'Little Russia': 0.36, Caucasus: 0.4, Romania: 0.3, Bulgaria: 0.3, Serbia: 0.3, Greece: 0.3, Albania: 0.32,
  Anatolia: 0.45, Syria: 0.6, Iraq: 0.8, Persia: 1.2, Egypt: 0.6, Cyprus: 0.4, Algeria: 0.9, Tunisia: 0.6, Morocco: 0.6, 'Spanish Morocco': 0.4, Libya: 1.4,
  Siberia: 4, 'Russian Far East': 5, Steppe: 2.4, Turkestan: 1.3, Mongolia: 4, Tibet: 3.5, Sinkiang: 3.5, Kokonor: 3.5, 'Inner Mongolia': 2.2, Manchuria: 0.9, 'China Proper': 0.45, Korea: 0.42, Japan: 0.36, Formosa: 0.45, Karafuto: 2,
  'British India': 0.5, Burma: 1.1, Ceylon: 0.6, Nepal: 0.6, Afghanistan: 1.4, Siam: 0.9, Tonkin: 0.55, Annam: 0.8, Cochinchina: 0.55, Laos: 1.6, Cambodia: 1.1, Malaya: 0.8, Java: 0.4, Sumatra: 1.2, 'Dutch Borneo': 2.2, Celebes: 1.3, Moluccas: 1.4, 'Lesser Sunda Islands': 0.9, 'Dutch New Guinea': 3.4, Philippines: 0.7, 'Kaiser-Wilhelmsland': 2.8, Papua: 2.8, Sarawak: 2.2, 'North Borneo': 2.2,
  Hejaz: 2, Asir: 1.5, 'Jabal Shammar': 3, Najd: 2.5, Hasa: 2.5, Yemen: 1, Aden: 2, Oman: 1.8, 'Trucial Coast': 2, Qatar: 1, Kuwait: 1,
  Australia: 3, 'New Zealand': 1, Northeast: 0.5, Midwest: 0.75, South: 0.85, West: 1.9, Alaska: 5, Hawaii: 1, 'Western Canada': 2.2, 'Eastern Canada': 1.3, 'Northern Territories': 8, Newfoundland: 2.4, Greenland: 9, Iceland: 2, Mexico: 1,
  Brazil: 1.7, Argentina: 1.5, Chile: 1, Peru: 1.3, Bolivia: 1.6, Colombia: 1.2, Venezuela: 1.4, Ecuador: 1, Paraguay: 1.5, Uruguay: 0.9, 'British Guiana': 2.4, 'Dutch Guiana': 2.4, 'French Guiana': 2.4,
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

/** Regional wealth about 1914, relative to western Europe: scales town populations for density. */
const WEALTH: Record<string, number> = {
  GBR: 1.2, FRA: 1, DEU: 1.1, BEL: 1.1, NLD: 1.1, CHE: 1, DNK: 1, SWE: 0.9, NOR: 0.8, USA: 1.2, CAN: 1, AUS: 1, NZL: 1, ARG: 0.8, URY: 0.7, AUT: 0.8, CZE: 0.8, ITA: 0.7, ESP: 0.6, PRT: 0.5, IRL: 0.6, HUN: 0.6, POL: 0.6, RUS: 0.45, FIN: 0.5, JPN: 0.6, ZAF: 0.6, CHL: 0.6, MEX: 0.35, BRA: 0.35, CUB: 0.5,
};
const wealthOf = (adm0: string, lon: number, lat: number): number => {
  if (adm0 in WEALTH) return WEALTH[adm0];
  if (lat > 35 && lon > -25 && lon < 45) return 0.5; // the rest of Europe
  if (lon < -30) return 0.3; // the Americas
  if (lat < 35 && lon < 52 && lon > -25) return 0.12; // Africa
  return 0.22; // Asia and the Pacific
};

// ───────────────────────────── towns about 1914 ────────────────────────────

/** Towns of about 1914 (Natural Earth name, country, population in thousands; a longitude where the name repeats). */
const TOWNS: Array<[string, string, number, number?]> = [
  // Europe
  ['London', 'GBR', 7200], ['Paris', 'FRA', 2900], ['Berlin', 'DEU', 3700], ['Vienna', 'AUT', 2030], ['St. Petersburg', 'RUS', 2100], ['Moscow', 'RUS', 1600], ['Istanbul', 'TUR', 1000], ['Glasgow', 'GBR', 1000], ['Manchester', 'GBR', 2000], ['Birmingham', 'GBR', 1100], ['Liverpool', 'GBR', 750], ['Leeds', 'GBR', 450], ['Sheffield', 'GBR', 455], ['Newcastle', 'GBR', 270], ['Hamburg', 'DEU', 1000], ['Budapest', 'HUN', 880], ['Warsaw', 'POL', 850], ['Łódź', 'POL', 480], ['Naples', 'ITA', 720], ['Milan', 'ITA', 600], ['Rome', 'ITA', 540], ['Turin', 'ITA', 430], ['Palermo', 'ITA', 340], ['Genoa', 'ITA', 270], ['Madrid', 'ESP', 600], ['Barcelona', 'ESP', 590], ['Brussels', 'BEL', 720], ['Antwerp', 'BEL', 300], ['Amsterdam', 'NLD', 570], ['Rotterdam', 'NLD', 420], ['Lyon', 'FRA', 520], ['Marseille', 'FRA', 550], ['Bordeaux', 'FRA', 260], ['Lille', 'FRA', 400], ['Munich', 'DEU', 600], ['Leipzig', 'DEU', 590], ['Dresden', 'DEU', 550], ['Cologne', 'DEU', 520], ['Frankfurt', 'DEU', 415], ['Essen', 'DEU', 1200], ['Hannover', 'DEU', 300], ['Nürnberg', 'DEU', 330], ['Stuttgart', 'DEU', 290], ['Wroclaw', 'POL', 510], ['Kaliningrad', 'RUS', 250], ['København', 'DNK', 560], ['Stockholm', 'SWE', 340], ['Oslo', 'NOR', 250], ['Helsinki', 'FIN', 160], ['Lisbon', 'PRT', 435], ['Odesa', 'UKR', 630], ['Kiev', 'UKR', 610], ['Kharkiv', 'UKR', 250], ['Riga', 'LVA', 520], ['Prague', 'CZE', 620], ['Dublin', 'IRL', 400], ['Belfast', 'GBR', 390], ['Edinburgh', 'GBR', 400], ['Bucharest', 'ROU', 340], ['Athens', 'GRC', 170], ['Sofia', 'BGR', 100], ['Belgrade', 'SRB', 90], ['Thessaloniki', 'GRC', 160], ['Izmir', 'TUR', 300], ['Bern', 'CHE', 90], ['Zürich', 'CHE', 200], ['Durrës', 'ALB', 10], ['Kazan', 'RUS', 190], ['Saratov', 'RUS', 240], ['Baku', 'AZE', 230], ['Tbilisi', 'GEO', 300], ['Rostov', 'RUS', 200], ['Nizhny Novgorod', 'RUS', 110],
  // the Near East and Africa
  ['Cairo', 'EGY', 680], ['Alexandria', 'EGY', 400], ['Damascus', 'SYR', 250], ['Aleppo', 'SYR', 200], ['Baghdad', 'IRQ', 200], ['Beirut', 'LBN', 150], ['Tehran', 'IRN', 280], ['Tabriz', 'IRN', 200], ['Isfahan', 'IRN', 80], ['Mashhad', 'IRN', 80], ['Kabul', 'AFG', 150], ['Riyadh', 'SAU', 20], ['Mecca', 'SAU', 80], ['Muscat', 'OMN', 20], ['Algiers', 'DZA', 170], ['Tunis', 'TUN', 200], ['Casablanca', 'MAR', 80], ['Fez', 'MAR', 100], ['Johannesburg', 'ZAF', 250], ['Cape Town', 'ZAF', 160], ['Pretoria', 'ZAF', 60], ['Durban', 'ZAF', 90], ['Addis Ababa', 'ETH', 70], ['Khartoum', 'SDN', 120], ['Lagos', 'NGA', 75], ['Ibadan', 'NGA', 175], ['Kano', 'NGA', 60], ['Monrovia', 'LBR', 10], ['Dakar', 'SEN', 25], ['Accra', 'GHA', 20], ['Kinshasa', 'COD', 15], ['Luanda', 'AGO', 20], ['Nairobi', 'KEN', 15], ['Mombasa', 'KEN', 30], ['Dar es Salaam', 'TZA', 25], ['Zanzibar', 'TZA', 40], ['Antananarivo', 'MDG', 70], ['Maputo', 'MOZ', 15], ['Tripoli', 'LBY', 30],
  // Asia
  ['Tokyo', 'JPN', 2000], ['Ōsaka', 'JPN', 1400], ['Kyoto', 'JPN', 500], ['Nagoya', 'JPN', 450], ['Kōbe', 'JPN', 400], ['Yokohama', 'JPN', 400], ['Seoul', 'KOR', 250], ['Taipei', 'TWN', 100], ['Beijing', 'CHN', 1000], ['Shanghai', 'CHN', 1200], ['Guangzhou', 'CHN', 1000], ['Tianjin', 'CHN', 800], ['Wuhan', 'CHN', 800], ['Nanjing', 'CHN', 380], ['Hangzhou', 'CHN', 350], ['Fuzhou', 'CHN', 600, 119], ['Chengdu', 'CHN', 350], ['Chongqing', 'CHN', 350], ['Xian', 'CHN', 250], ['Shenyeng', 'CHN', 200], ['Harbin', 'CHN', 70], ['Changsha', 'CHN', 250], ['Suzhou', 'CHN', 300, 120.6], ['Jinan', 'CHN', 250], ['Kunming', 'CHN', 100], ['Lanzhou', 'CHN', 100], ['Taiyuan', 'CHN', 70], ['Dalian', 'CHN', 70], ['Qingdao', 'CHN', 60], ['Hong Kong', 'HKG', 450], ['Lhasa', 'CHN', 30], ['Ürümqi', 'CHN', 50], ['Ulaanbaatar', 'MNG', 60],
  ['Kolkata', 'IND', 1200], ['Mumbai', 'IND', 980], ['Chennai', 'IND', 520], ['Hyderabad', 'IND', 500, 78.5], ['Lucknow', 'IND', 260], ['Delhi', 'IND', 230], ['Lahore', 'PAK', 230], ['Karachi', 'PAK', 150], ['Bengaluru', 'IND', 190], ['Ahmedabad', 'IND', 215], ['Varanasi', 'IND', 200], ['Kanpur', 'IND', 180], ['Patna', 'IND', 140], ['Agra', 'IND', 185], ['Amritsar', 'IND', 150], ['Pune', 'IND', 160], ['Nagpur', 'IND', 100], ['Dhaka', 'BGD', 110], ['Colombo', 'LKA', 210], ['Yangon', 'MMR', 290], ['Mandalay', 'MMR', 140], ['Kathmandu', 'NPL', 80],
  ['Bangkok', 'THA', 600], ['Ho Chi Minh City', 'VNM', 200], ['Hanoi', 'VNM', 150], ['Jakarta', 'IDN', 230], ['Surabaya', 'IDN', 160], ['Semarang', 'IDN', 100], ['Manila', 'PHL', 230], ['Singapore', 'SGP', 300], ['Kuala Lumpur', 'MYS', 50], ['Tashkent', 'UZB', 270], ['Samarqand', 'UZB', 90], ['Bukhara', 'UZB', 80], ['Omsk', 'RUS', 130], ['Tomsk', 'RUS', 110], ['Irkutsk', 'RUS', 130], ['Vladivostok', 'RUS', 90], ['Yekaterinburg', 'RUS', 70], ['Samara', 'RUS', 140], ['Perm', 'RUS', 60],
  // the Americas
  ['New York', 'USA', 5600], ['Chicago', 'USA', 2400], ['Philadelphia', 'USA', 1700], ['St. Louis', 'USA', 700], ['Boston', 'USA', 1000], ['Cleveland', 'USA', 600], ['Baltimore', 'USA', 580], ['Pittsburgh', 'USA', 900], ['Detroit', 'USA', 560], ['Buffalo', 'USA', 450], ['San Francisco', 'USA', 600], ['Milwaukee', 'USA', 400], ['Cincinnati', 'USA', 380], ['New Orleans', 'USA', 350], ['Washington, D.C.', 'USA', 350], ['Los Angeles', 'USA', 400], ['Minneapolis', 'USA', 400], ['Seattle', 'USA', 280], ['Kansas City', 'USA', 270, -94.6], ['Indianapolis', 'USA', 260], ['Louisville', 'USA', 230], ['Portland', 'USA', 230, -122.7], ['Denver', 'USA', 230], ['Atlanta', 'USA', 170], ['Houston', 'USA', 100], ['Dallas', 'USA', 110], ['Honolulu', 'USA', 60],
  ['Montréal', 'CAN', 600], ['Toronto', 'CAN', 450], ['Winnipeg', 'CAN', 150], ['Vancouver', 'CAN', 120], ['Ottawa', 'CAN', 100], ['St. John\'s', 'CAN', 35],
  ['Mexico City', 'MEX', 470], ['Guadalajara', 'MEX', 120], ['Havana', 'CUB', 350], ['Guatemala City', 'GTM', 90], ['San Salvador', 'SLV', 60], ['Tegucigalpa', 'HND', 25], ['Managua', 'NIC', 30], ['San José', 'CRI', 35], ['Panama City', 'PAN', 45], ['Port-au-Prince', 'HTI', 100], ['Santo Domingo', 'DOM', 25],
  ['Rio de Janeiro', 'BRA', 1000], ['São Paulo', 'BRA', 450], ['Salvador', 'BRA', 300, -38.5], ['Recife', 'BRA', 200], ['Belém', 'BRA', 240], ['Porto Alegre', 'BRA', 130], ['Manaus', 'BRA', 75], ['Buenos Aires', 'ARG', 1500], ['Rosario', 'ARG', 220], ['Córdoba', 'ARG', 120], ['Montevideo', 'URY', 360], ['Santiago', 'CHL', 400], ['Valparaíso', 'CHL', 180], ['Lima', 'PER', 170], ['Bogota', 'COL', 120], ['Caracas', 'VEN', 90], ['Quito', 'ECU', 70], ['Guayaquil', 'ECU', 80], ['La Paz', 'BOL', 80], ['Asunción', 'PRY', 80],
  // Oceania
  ['Sydney', 'AUS', 750], ['Melbourne', 'AUS', 650], ['Adelaide', 'AUS', 190], ['Brisbane', 'AUS', 140], ['Perth', 'AUS', 100], ['Auckland', 'NZL', 100], ['Wellington', 'NZL', 70],
];
const TOWN = new Map<string, Array<[number, number | undefined]>>();
for (const [n, a, k, lon] of TOWNS) (TOWN.get(`${n}|${a}`) ?? TOWN.set(`${n}|${a}`, []).get(`${n}|${a}`)!).push([k * 1000, lon]);

export function popOf(p: { name: string; adm0: string; pop: number; lon: number; lat: number }): number {
  const hit = TOWN.get(`${p.name}|${p.adm0}`)?.find(([, lon]) => lon === undefined || Math.abs(lon - p.lon) < 3);
  if (hit) return hit[0];
  // the rest: present-day figures, scaled down by the growth since and by the region's wealth then
  return p.pop * 0.08 * wealthOf(p.adm0, p.lon, p.lat);
}

/** Names of 1914 for places renamed since (beyond the Europe map's). */
export const NAMES: Record<string, string> = {
  ...EU_NAMES,
  Beijing: 'Peking', Guangzhou: 'Canton', Tianjin: 'Tientsin', Wuhan: 'Hankow', Nanjing: 'Nanking', Hangzhou: 'Hangchow', Fuzhou: 'Foochow', Chongqing: 'Chungking', Chengdu: 'Chengtu', Xian: "Sian", Shenyeng: 'Mukden', Shenyang: 'Mukden', Changchun: 'Kwanchengtze', Jilin: 'Kirin', Jinan: 'Tsinan', Qingdao: 'Tsingtao', Dalian: 'Dairen', Lüshun: 'Port Arthur', Kunming: 'Yunnanfu', Ürümqi: 'Tihwa', Lanzhou: 'Lanchow', Taiyuan: 'Taiyuan', Xiamen: 'Amoy', Shantou: 'Swatow', Ningbo: 'Ningpo', Suzhou: 'Soochow', Guiyang: 'Kweiyang', Nanning: 'Nanning', Zhengzhou: 'Chengchow', Kaifeng: 'Kaifeng', Hohhot: 'Kweihwa', Baotou: 'Paotow', Xining: 'Sining', Kashgar: 'Kashgar', Kashi: 'Kashgar', Hotan: 'Khotan', Yining: 'Kulja', Qiqihar: 'Tsitsihar', Harbin: 'Harbin', Changsha: 'Changsha', Nanchang: 'Nanchang', Hefei: 'Luchow', Jiujiang: 'Kiukiang', Yichang: 'Ichang', Shashi: 'Shasi', Wuzhou: 'Wuchow', Haikou: 'Kiungchow',
  Seoul: 'Keijō', Busan: 'Fusan', Pyongyang: 'Heijō', Incheon: 'Chemulpo', Taipei: 'Taihoku', Kaohsiung: 'Takao', Tainan: 'Tainan', Taichung: 'Taichū', 'Yuzhno-Sakhalinsk': 'Toyohara',
  Kolkata: 'Calcutta', Mumbai: 'Bombay', Chennai: 'Madras', Bengaluru: 'Bangalore', Pune: 'Poona', Kanpur: 'Cawnpore', Varanasi: 'Benares', Vadodara: 'Baroda', Vishakhapatnam: 'Vizagapatam', Kochi: 'Cochin', Thiruvananthapuram: 'Trivandrum', Kozhikode: 'Calicut', Mangaluru: 'Mangalore', Mysuru: 'Mysore', Prayagraj: 'Allahabad', Odisha: 'Orissa', Cuttack: 'Cuttack', Puducherry: 'Pondicherry', Dhaka: 'Dacca', Yangon: 'Rangoon', Mawlamyine: 'Moulmein', Pathein: 'Bassein', Sittwe: 'Akyab',
  'Ho Chi Minh City': 'Saigon', 'Da Nang': 'Tourane', Jakarta: 'Batavia', Surabaya: 'Soerabaja', Bandung: 'Bandoeng', Makassar: 'Makassar', Ujungpandang: 'Makassar', Jayapura: 'Hollandia', Ambon: 'Amboina',
  Almaty: 'Verny', Bishkek: 'Pishpek', Ashgabat: 'Ashkhabad', Dushanbe: 'Dyushambe', Samarqand: 'Samarkand', Astana: 'Akmolinsk', 'Nur-Sultan': 'Akmolinsk', Semey: 'Semipalatinsk', Oskemen: 'Ust-Kamenogorsk', 'Öskemen': 'Ust-Kamenogorsk', Aqtöbe: 'Aktyubinsk', Aktobe: 'Aktyubinsk', Oral: 'Uralsk', Qostanay: 'Kustanai', Kostanay: 'Kustanai', Petropavl: 'Petropavlovsk', Qyzylorda: 'Perovsk', Kyzylorda: 'Perovsk', Shymkent: 'Chimkent', Taraz: 'Aulie-Ata', Turkmenbashi: 'Krasnovodsk', Türkmenbaşy: 'Krasnovodsk', Khujand: 'Khodjent', Mary: 'Merv', 'Türkmenabat': 'Charjui',
  Yekaterinburg: 'Ekaterinburg', Novosibirsk: 'Novonikolayevsk', 'Ulan-Ude': 'Verkhneudinsk', Kyzyl: 'Belotsarsk', Ulaanbaatar: 'Urga', Perm: 'Perm', Samara: 'Samara', 'Komsomolsk-na-Amure': 'Permskoye', Petropavlovsk: 'Petropavlovsk', 'Petropavlovsk-Kamchatsky': 'Petropavlovsk', Kirov: 'Vyatka', Izhevsk: 'Izhevsk', Ufa: 'Ufa',
  Kinshasa: 'Léopoldville', Lubumbashi: 'Élisabethville', Kisangani: 'Stanleyville', Mbandaka: 'Coquilhatville', Kananga: 'Luluabourg', Maputo: 'Lourenço Marques', Beira: 'Beira', Harare: 'Salisbury', 'Kabwe': 'Broken Hill', Antananarivo: 'Tananarive', "N'Djamena": 'Fort-Lamy', Ndjamena: 'Fort-Lamy', Bangui: 'Bangui', Malabo: 'Santa Isabel', Bata: 'Bata', Windhoek: 'Windhuk', Lüderitz: 'Lüderitzbucht', Gqeberha: 'Port Elizabeth', Tshwane: 'Pretoria', Bujumbura: 'Usumbura', Kigali: 'Kigali', Lilongwe: 'Lilongwe', Blantyre: 'Blantyre', Djibouti: 'Djibouti', Mogadishu: 'Mogadiscio', Asmara: 'Asmara', Massawa: 'Massaua', Hargeysa: 'Hargeisa', Berbera: 'Berbera', Banjul: 'Bathurst', 'Saint-Louis': 'Saint-Louis', Abidjan: 'Abidjan', 'Grand-Bassam': 'Grand-Bassam', Kumasi: 'Coomassie', Lomé: 'Lome', 'Porto-Novo': 'Porto-Novo', Cotonou: 'Cotonou', Yaoundé: 'Jaunde', Douala: 'Duala', Moundou: 'Moundou', Dodoma: 'Dodoma', Tabora: 'Tabora', Livingstone: 'Livingstone', Bulawayo: 'Bulawayo', Gaborone: 'Gaberones', Mahikeng: 'Mafeking', Maseru: 'Maseru', Mbabane: 'Mbabane', Laayoune: 'El Aaiún', Dakhla: 'Villa Cisneros', 'Ad Dakhla': 'Villa Cisneros',
  'Iqaluit': 'Frobisher Bay', 'Whitehorse': 'Whitehorse', 'Yellowknife': 'Fort Rae', Thunder: 'Port Arthur', 'Thunder Bay': 'Port Arthur', 'Ciudad Juárez': 'Ciudad Juárez', Bogota: 'Bogotá', Tshikapa: 'Tshikapa', Nuuk: 'Godthaab', 'Port Moresby': 'Port Moresby', Madang: 'Friedrich-Wilhelmshafen', Rabaul: 'Rabaul', Lae: 'Lae', Kokopo: 'Herbertshöhe', Kavieng: 'Käwieng', Wewak: 'Wewak', Darwin: 'Palmerston', Canberra: 'Canberra',
  'Washington, D.C.': 'Washington', 'Mexico City': 'Mexico City', 'Panama City': 'Panama', 'Guatemala City': 'Guatemala City', 'Ōsaka': 'Osaka', 'Kōbe': 'Kobe', 'Kitakyūshū': 'Kokura', 'Hachiōji': 'Hachioji', 'Ōtsu': 'Otsu', 'Ōita': 'Oita', 'Kōchi': 'Kochi',
};

/** Places Natural Earth lists that did not exist as towns in 1914 (or under a later name with no forerunner). */
export const NOT_YET = [
  ...EU_NOT_YET,
  'Brasília', 'Shenzhen', 'Dongguan', 'Irvine', 'Las Vegas', 'Amaravati', 'Islamabad', 'Abuja', 'Nouakchott', 'Lusaka', 'Karaganda', 'Qaraghandy', 'Norilsk', 'Magnitogorsk', 'Komsomolsk-na-Amure', 'Bratsk', 'Surgut', 'Nizhnevartovsk', 'Vorkuta', 'Ukhta', 'Novokuznetsk', 'Angarsk', 'Zelenogorsk', 'Temirtau', 'Ekibastuz', 'Rudny', 'Zhezqazghan', 'Baikonur', 'Navoiy', 'Zarafshon', 'Nukus', 'Daqing', 'Karamay', 'Shihezi', 'Panzhihua', 'Shiyan', 'Maoming', 'Zhuhai', 'Hechi', 'Gandhinagar', 'Chandigarh', 'Bhubaneswar', 'Navi Mumbai', 'Faridabad', 'Ghaziabad', 'Noida', 'Gurgaon', 'Kalyan', 'Bokaro', 'Rourkela', 'Bhilai', 'Durgapur', 'Jamshedpur', 'Belmopan', 'Ciudad Guayana', 'Palmas', 'Goiânia', 'Belo Horizonte', 'Boa Vista', 'Porto Velho', 'Macapá', 'Londrina', 'Maringá', 'Campo Grande', 'Ciudad Nezahualcóyotl', 'Ecatepec', 'Cancún', 'Tijuana', 'Mexicali', 'Lázaro Cárdenas', 'Ciudad Obregón', 'Arusha', 'Gaborone', 'Lilongwe', 'Kigali', 'Yamoussoukro', 'Kolwezi', 'Mbuji-Mayi', 'Port Harcourt', 'Kaduna', 'Jos', 'Tema', 'Tamale', 'Nouadhibou', 'Thiès', 'Kara', 'Sokodé', 'Bobo-Dioulasso', 'Juba', 'Port Sudan', 'Wad Medani', 'Rehoboth', 'Walvis Bay', 'Ndola', 'Kitwe', 'Chingola', 'Mufulira', 'Luanshya', 'Kabwe', 'Ruwi', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Doha', 'Al Jubayl', 'Dhahran', 'Ad Dammam', 'Dammam', 'Al Khobar', 'Hafar al Batin', 'Arar', 'Sakakah', 'Tabuk', 'Kuwait', 'Manama', 'Canberra', 'Townsville', 'Mount Isa', 'Gladstone', 'Karratha', 'Port Hedland', 'Wollongong', 'Elizabeth', 'Las Cruces', 'Anchorage', 'Fairbanks', 'Iqaluit', 'Yellowknife', 'Fort McMurray', 'Thompson', 'Labrador City', 'Happy Valley - Goose Bay', 'Sept-Îles', 'Kemerovo', 'Tolyatti', 'Novy Urengoy', 'Noyabrsk', 'Nefteyugansk', 'Kogalym', 'Khanty-Mansiysk', 'Salekhard', 'Neryungri', 'Mirny', 'Lensk', 'Udachny', 'Bilibino', 'Pevek', 'Magadan', 'Severobaykalsk', 'Ust-Ilimsk', 'Sayanogorsk', 'Rubtsovsk', 'Mezhdurechensk', 'Prokopyevsk', 'Leninsk-Kuznetsky', 'Seversk', 'Strezhevoy', 'Kostomuksha', 'Ust-Kut', 'Tynda', 'Sovetskaya Gavan', 'Nakhodka', 'Bolshoy Kamen', 'Dalnegorsk', 'Raychikhinsk', 'Gubkinsky', 'Muravlenko', 'Langepas', 'Megion', 'Raduzhny', 'Pyt-Yakh', 'Uray', 'Sovetsky', 'Beloyarsky', 'Nyagan', 'Yugorsk', 'Labytnangi', 'Nadym', 'Tarko-Sale', 'Igarka', 'Dudinka', 'Talnakh', 'Kayerkan', 'Snezhnogorsk', 'Aldan', 'Tommot', 'Nyurba', 'Vilyuysk', 'Zhigansk', 'Tiksi', 'Chersky', 'Anadyr', 'Egvekinot', 'Provideniya', 'Lavrentiya', 'Uelen',
];

// ───────────────────────────── geography ───────────────────────────────────

const RIDGES: RealMapDef['ridges'] = [
  ...EU_RIDGES.filter((r) => inList(r.name, 'Pyrenees|Western Alps|Central Alps|Greater Caucasus')),
  { name: 'Himalaya', halfKm: 40, pts: [[73.5, 35.3], [75.5, 34.3], [77.5, 32.9], [79.2, 31.0], [81.0, 29.9], [83.5, 28.9], [86.0, 28.0], [88.3, 27.9], [90.5, 28.0], [92.5, 27.9], [94.5, 28.7], [96.5, 28.8]] },
  { name: 'Andes', halfKm: 34, pts: [[-69.6, -18.0], [-68.9, -20.5], [-68.2, -23.5], [-68.6, -26.5], [-69.5, -29.0], [-70.0, -31.5], [-70.0, -33.0], [-70.2, -35.0], [-70.8, -37.5], [-71.4, -40.0], [-71.8, -43.0]] },
];
const PASSES: RealMapDef['passes'] = [
  ...EU_PASSES.filter((p) => inList(p.name, 'Roncesvalles|Brenner|St Gotthard|Mont Cenis|Darial')),
  { name: 'Nathu La', lon: 88.83, lat: 27.39 },
  { name: 'Uspallata Pass', lon: -70.07, lat: -32.82 },
];

const STRAITS: RealMapDef['straits'] = [
  { name: 'Strait of Dover', a: [1.5, 51.1], b: [1.85, 50.95] },
  { name: 'Strait of Gibraltar', a: [-5.6, 36.1], b: [-5.6, 35.8] },
  { name: 'Bosporus', a: [28.98, 41.05], b: [29.05, 41.0] },
  { name: 'Øresund', a: [12.6, 55.95], b: [12.75, 56.05] },
  { name: 'North Channel', a: [-5.85, 54.95], b: [-5.2, 55.15] },
  { name: 'Strait of Bonifacio', a: [9.2, 41.4], b: [9.25, 41.2] },
  { name: 'Palk Strait', a: [79.3, 9.2], b: [79.9, 9.7] },
  { name: 'Strait of Johor', a: [103.75, 1.45], b: [103.8, 1.35] },
  { name: 'Sunda Strait', a: [105.7, -5.85], b: [105.9, -6.1] },
  { name: 'Bali Strait', a: [114.4, -8.2], b: [114.6, -8.25] },
  { name: 'Shimonoseki Strait', a: [130.9, 33.95], b: [130.95, 33.9] },
  { name: 'Tsugaru Strait', a: [140.6, 41.25], b: [140.4, 41.45] },
  { name: 'La Pérouse Strait', a: [141.9, 45.4], b: [142.0, 45.95] },
  { name: 'Strait of Tartary', a: [140.6, 52.2], b: [141.7, 52.2] },
  { name: 'Hainan Strait', a: [110.2, 20.25], b: [110.2, 20.0] },
  { name: 'Strait of Hormuz', a: [56.3, 27.1], b: [56.4, 26.4] },
  { name: 'Bab-el-Mandeb', a: [43.4, 12.65], b: [43.3, 12.5] },
  { name: 'Torres Strait', a: [142.5, -10.7], b: [142.6, -9.3] },
  { name: 'Cook Strait', a: [174.6, -41.3], b: [174.2, -41.1] },
  { name: 'Strait of Belle Isle', a: [-57.0, 51.4], b: [-56.8, 51.6] },
  { name: 'Strait of Georgia', a: [-123.2, 49.3], b: [-123.6, 49.0] },
  { name: 'Strait of Magellan', a: [-70.6, -52.9], b: [-70.4, -53.3] },
];

const LAKES: Record<string, string> = {
  'Lake Superior': 'Lake Superior', 'Lake Michigan': 'Lake Michigan', 'Lake Huron': 'Lake Huron', 'Lake Erie': 'Lake Erie', 'Lake Ontario': 'Lake Ontario', 'Lake Winnipeg': 'Lake Winnipeg', 'Great Slave Lake': 'Great Slave Lake', 'Great Bear Lake': 'Great Bear Lake', 'Lake Athabasca': 'Lake Athabasca', 'Reindeer Lake': 'Reindeer Lake', 'Lake Manitoba': 'Lake Manitoba', 'Lake Winnipegosis': 'Lake Winnipegosis', 'Great Salt Lake': 'Great Salt Lake', 'Lago de Nicaragua': 'Lake Nicaragua', 'Lago Titicaca': 'Lake Titicaca',
  'Lake Victoria': 'Lake Victoria', 'Lake Tanganyika': 'Lake Tanganyika', 'Lake Malawi': 'Lake Nyasa', 'Lake Chad': 'Lake Chad', 'Lake Turkana': 'Lake Rudolf', 'Lake Albert': 'Lake Albert', 'Lake Tana': 'Lake Tana', 'Lac Moeru': 'Lake Mweru', 'Lake Rukwa': 'Lake Rukwa', 'Lake Bangweulu': 'Lake Bangweulu',
  'Lake Baikal': 'Lake Baikal', 'Lake Balkhash': 'Lake Balkhash', 'South Aral Sea': 'Aral Sea', 'North Aral Sea': 'Aral Sea', 'Issyk-Kul': 'Issyk-Kul', 'Lake Ladoga': 'Lake Ladoga', 'Lake Onega': 'Lake Onega', 'Lake Urmia': 'Lake Urmia', 'Qinghai Hu': 'Kokonor', 'Khövsgöl Nuur': 'Lake Khövsgöl', 'Tonlé Sap': 'Tonlé Sap', 'Lake Van': 'Lake Van', 'Vänern': 'Lake Vänern', 'Lake Eyre North': 'Lake Eyre',
};

const RIVERS: Record<string, string> = {
  Mississippi: 'Mississippi', Missouri: 'Missouri', Ohio: 'Ohio', 'Rio Grande': 'Rio Grande', Colorado: 'Colorado', Columbia: 'Columbia', Yukon: 'Yukon', Mackenzie: 'Mackenzie', 'Saint Lawrence': 'St Lawrence', 'St. Lawrence': 'St Lawrence',
  Amazonas: 'Amazon', Paraná: 'Paraná', Orinoco: 'Orinoco', 'São  Francisco': 'São Francisco', Uruguay: 'Uruguay', Madeira: 'Madeira', Magdalena: 'Magdalena',
  Nile: 'Nile', Niger: 'Niger', Congo: 'Congo', Zambezi: 'Zambezi', Orange: 'Orange', Limpopo: 'Limpopo', Sénégal: 'Senegal',
  Volga: 'Volga', Danube: 'Danube', Dnipro: 'Dnieper', Don: 'Don', Rhine: 'Rhine', Rhein: 'Rhine', Vistula: 'Vistula', Ural: 'Ural', Ob: 'Ob', Irtysh: 'Irtysh', Ertis: 'Irtysh', Yenisey: 'Yenisei', Lena: 'Lena', Amur: 'Amur', Kolyma: 'Kolyma', Angara: 'Angara',
  Huang: 'Yellow River', 'Chang Jiang': 'Yangtze', Yangtze: 'Yangtze', Jinsha: 'Yangtze', Lancang: 'Mekong', Mekong: 'Mekong', Ganges: 'Ganges', Indus: 'Indus', Brahmaputra: 'Brahmaputra', Ayeyarwady: 'Irrawaddy', Tigris: 'Tigris', Euphrates: 'Euphrates', 'Amu  Darya': 'Oxus', 'Syr  Darya': 'Jaxartes', Godävari: 'Godavari', Krishna: 'Kistna',
  Murray: 'Murray', Darling: 'Darling',
};

const ISLAND_NAMES: Array<[string, number, number]> = [
  ['The Americas', -100, 40], ['Australia', 134, -25],
  ...EU_ISLANDS.filter(([n]) => n !== 'Crimea'),
  ['Greenland', -42, 72], ['Newfoundland', -56, 48.8], ['Vancouver Island', -125.5, 49.6], ['Cuba', -79, 21.7], ['Hispaniola', -71.5, 19], ['Jamaica', -77.3, 18.1], ['Puerto Rico', -66.5, 18.2], ['Trinidad', -61.3, 10.4], ['Tierra del Fuego', -68.5, -54], ['Falkland Islands', -59.5, -51.7], ['Chiloé', -73.9, -42.6], ['Baffin Island', -71, 68], ['Victoria Island', -110, 71], ['Banks Island', -121, 72.8], ['Southampton Island', -84, 64.3], ['Long Island', -73, 40.8], ['Hawaii', -155.5, 19.6], ['Cape Breton', -60.8, 46.2], ['Prince Edward Island', -63.2, 46.4], ['Anticosti', -63, 49.4], ['Kodiak', -153.5, 57.4],
  ['Madagascar', 47, -19], ['Zanzibar', 39.3, -6.1], ['Bioko', 8.7, 3.5], ['Socotra', 53.9, 12.5], ['Mauritius', 57.6, -20.3], ['Réunion', 55.5, -21.1],
  ['Honshu', 138, 36], ['Hokkaido', 143, 43.3], ['Kyushu', 131, 32.8], ['Shikoku', 133.5, 33.7], ['Sakhalin', 143, 50], ['Formosa', 121, 23.7], ['Hainan', 109.8, 19.2], ['Ceylon', 80.7, 7.8], ['Sumatra', 101.5, -0.5], ['Java', 110, -7.4], ['Borneo', 114, 1], ['Celebes', 121, -2], ['New Guinea', 140, -5], ['Luzon', 121, 16], ['Mindanao', 125, 7.8], ['Mindoro', 121, 13], ['Palawan', 118.5, 9.6], ['Panay', 122.5, 11.2], ['Negros', 123, 10], ['Samar', 125, 12], ['Timor', 125, -9.2], ['Flores', 121, -8.6], ['Sumbawa', 118, -8.7], ['Halmahera', 128, 1], ['Seram', 129.5, -3.1], ['Bangka', 106, -2.2], ['New Britain', 150.5, -5.7], ['New Ireland', 151.8, -3.6], ['Bougainville', 155.3, -6.2], ['Guadalcanal', 160, -9.6], ['New Caledonia', 165.5, -21.3], ['Viti Levu', 178, -17.8], ['Andaman Islands', 92.8, 12.5], ['Kamchatka', 159, 56],
  // the Arctic and the north Pacific
  ['Devon Island', -87, 75.3], ['Melville Island', -110, 75.6], ['Prince of Wales Island', -99, 72.6], ['Somerset Island', -93.5, 73.2], ['Bathurst Island', -100, 76], ['King William Island', -97.5, 69], ['Prince Patrick Island', -119, 76.6], ['Coats Island', -82.5, 62.8], ['Mansel Island', -80, 62], ['Bylot Island', -78.5, 73.2], ['Cornwallis Island', -95, 75.1], ['Akimiski', -81.3, 53], ['Nunivak', -166.5, 60], ['St Lawrence Island', -170, 63.4], ['Unimak', -164, 54.8], ['Prince of Wales Island (Alaska)', -132.8, 55.6], ['Chichagof', -135.8, 57.7], ['Baranof', -135, 57], ['Admiralty Island', -134.5, 57.7], ['Revillagigedo', -131.4, 55.6], ['Graham Island', -132.3, 53.6], ['Moresby Island', -131.9, 52.8], ['Disko', -53.5, 69.8], ['Kolguyev', 49, 69.1], ['Vaygach', 59, 70], ['Kotelny', 139, 75.5], ['Bolshoy Lyakhovsky', 141, 73.4], ['Karaginsky', 164, 59], ['Paramushir', 156, 50.3],
  // the East Indies, the Philippines and the western Pacific
  ['Buru', 126.6, -3.4], ['Obi', 127.7, -1.5], ['Taliabu', 124.8, -1.8], ['Aru Islands', 134.5, -6.2], ['Yamdena', 131.3, -7.6], ['Morotai', 128.4, 2.3], ['Bacan', 127.5, -0.6], ['Wetar', 126.3, -7.8], ['Lombok', 116.3, -8.6], ['Sumba', 119.9, -9.7], ['Alor', 124.7, -8.3], ['Nias', 97.5, 1.1], ['Siberut', 99, -1.3], ['Simeulue', 96.1, 2.6], ['Belitung', 107.9, -2.9], ['Enggano', 102.2, -5.3], ['Bintan', 104.5, 1.1], ['Buton', 122.9, -5.3], ['Muna', 122.6, -4.9], ['Peleng', 123.2, -1.4],
  ['Leyte', 124.8, 10.9], ['Cebu', 123.9, 10.3], ['Bohol', 124.2, 9.8], ['Masbate', 123.5, 12.2], ['Catanduanes', 124.2, 13.8], ['Basilan', 122, 6.6], ['Jolo', 121, 6], ['Malaita', 161, -9], ['Santa Isabel', 159.3, -8], ['San Cristobal', 161.8, -10.6], ['New Georgia', 157.5, -8.3], ['Choiseul', 157, -7], ['Espiritu Santo', 166.9, -15.4], ['Malakula', 167.4, -16.2], ['Efate', 168.3, -17.7], ['Erromango', 169.1, -18.8], ['Tanna', 169.3, -19.5], ['Manus', 147, -2.1], ['New Hanover', 150.2, -2.5], ['Fergusson Island', 150.6, -9.5], ['Normanby Island', 151, -10], ['Goodenough Island', 149.7, -9.3],
  // Australia and the south Atlantic
  ['Melville Island (Australia)', 130.9, -11.6], ['Bathurst Island (Australia)', 130.4, -11.6], ['Groote Eylandt', 136.6, -14], ['Kangaroo Island', 137.2, -35.8], ['Fraser Island', 153.1, -25.2], ['Mornington Island', 139.6, -16.6], ['West Falkland', -60.3, -51.8], ['East Falkland', -58.7, -51.7], ['Andros', -78, 24.4], ['Great Abaco', -77.2, 26.4], ['Grand Bahama', -78.4, 26.6], ['Eleuthera', -76.2, 25.2], ['Great Inagua', -73.4, 21.1],
  ['Tasmania', 146.6, -42], ['North Island', 175.5, -38.5], ['South Island', 171, -43.5], ['Novaya Zemlya', 56, 73], ['Spitsbergen', 16, 77.5], ['Wrangel Island', -179.5, 71.2], ['New Siberian Islands', 140, 75], ['Severny Island', 57, 74.5],
];

const SEAS: Array<[string, number, number, number?]> = [
  ['North Atlantic Ocean', -40, 35, 44], ['South Atlantic Ocean', -15, -25, 44], ['North Pacific Ocean', -150, 30, 48], ['South Pacific Ocean', -130, -30, 48], ['Indian Ocean', 75, -20, 46], ['Arctic Ocean', 0, 77, 30],
  ['North Sea', 3.5, 56.0, 22], ['Baltic Sea', 19.0, 57, 20], ['Norwegian Sea', 3.0, 67.0, 24], ['Barents Sea', 40.0, 72, 24], ['Kara Sea', 70, 74.5, 22], ['Laptev Sea', 125, 75, 22], ['East Siberian Sea', 160, 73.5, 22], ['Chukchi Sea', -170, 69.5, 18], ['Bay of Biscay', -5.0, 45.3, 18], ['Mediterranean Sea', 18.0, 34.5, 26], ['Black Sea', 34.5, 43.2, 22], ['Caspian Sea', 50.5, 42.0, 22], ['Red Sea', 38.5, 20.5, 20], ['Persian Gulf', 51, 27.3, 18], ['Arabian Sea', 64, 15, 30], ['Bay of Bengal', 88, 15, 28], ['Andaman Sea', 96.5, 11, 18], ['South China Sea', 114, 13, 28], ['East China Sea', 125.5, 29.5, 22], ['Yellow Sea', 123, 36, 18], ['Sea of Japan', 135, 40.5, 22], ['Sea of Okhotsk', 148, 54, 24], ['Bering Sea', 178, 58, 26], ['Gulf of Alaska', -145, 57, 22], ['Philippine Sea', 132, 20, 26], ['Java Sea', 111, -5, 20], ['Celebes Sea', 122, 4, 18], ['Banda Sea', 127, -6, 18], ['Arafura Sea', 135, -9.5, 20], ['Coral Sea', 154, -16, 26], ['Tasman Sea', 160, -38, 26], ['Great Australian Bight', 131, -36, 20], ['Timor Sea', 127, -11.5, 18],
  ['Gulf of Mexico', -90, 25, 24], ['Caribbean Sea', -75, 15, 26], ['Hudson Bay', -85, 59, 24], ['Labrador Sea', -55, 58, 22], ['Gulf of St Lawrence', -62, 48.3, 16], ['Gulf of Guinea', 3, 2, 22], ['Mozambique Channel', 41.5, -18, 18], ['Gulf of Aden', 48, 12.3, 16], ['Baffin Bay', -66, 74, 20], ['Gulf of California', -111, 28, 16], ['Sargasso Sea', -60, 30, 24], ['Greenland Sea', -5, 75, 20], ['Irish Sea', -5.0, 53.7, 14], ['English Channel', -2.3, 50.0, 14], ['Aegean Sea', 25.0, 38.8, 16], ['Adriatic Sea', 15.8, 42.8, 14], ['Gulf of Bothnia', 20.5, 62.8, 14], ['White Sea', 37.5, 65.6, 14],
];

const DEPOSIT_HINTS: RealMapDef['depositHints'] = [
  // coal
  { kind: 'coal', lon: 7.2, lat: 51.45, km: 150, weight: 6 }, { kind: 'coal', lon: 18.9, lat: 50.3, km: 150, weight: 5 }, { kind: 'coal', lon: 3.2, lat: 50.4, km: 150, weight: 4 }, { kind: 'coal', lon: -2.0, lat: 53.0, km: 250, weight: 6 }, { kind: 'coal', lon: 38.0, lat: 48.0, km: 200, weight: 5 },
  { kind: 'coal', lon: -79.5, lat: 40.0, km: 350, weight: 7 }, { kind: 'coal', lon: -88.5, lat: 38.5, km: 300, weight: 4 }, { kind: 'coal', lon: 112.5, lat: 37.5, km: 300, weight: 5 }, { kind: 'coal', lon: 123.9, lat: 41.9, km: 200, weight: 4 }, { kind: 'coal', lon: 130.7, lat: 33.7, km: 150, weight: 4 }, { kind: 'coal', lon: 86.4, lat: 23.7, km: 200, weight: 4 }, { kind: 'coal', lon: 30.0, lat: -28.0, km: 250, weight: 3 }, { kind: 'coal', lon: 151.5, lat: -32.9, km: 200, weight: 4 }, { kind: 'coal', lon: 86.5, lat: 54.5, km: 300, weight: 2 },
  // iron
  { kind: 'iron', lon: 6.0, lat: 49.3, km: 150, weight: 6 }, { kind: 'iron', lon: 20.2, lat: 67.85, km: 200, weight: 6 }, { kind: 'iron', lon: 33.4, lat: 47.9, km: 150, weight: 5 }, { kind: 'iron', lon: -3.0, lat: 43.2, km: 150, weight: 4 }, { kind: 'iron', lon: -92.5, lat: 47.5, km: 250, weight: 7 }, { kind: 'iron', lon: 59.5, lat: 57.5, km: 300, weight: 5 }, { kind: 'iron', lon: 114.9, lat: 30.1, km: 200, weight: 4 }, { kind: 'iron', lon: -43.9, lat: -20.0, km: 250, weight: 3 }, { kind: 'iron', lon: 85.5, lat: 22.5, km: 200, weight: 3 },
  // oil
  { kind: 'oil', lon: 49.8, lat: 40.4, km: 150, weight: 8 }, { kind: 'oil', lon: 26.0, lat: 44.95, km: 120, weight: 6 }, { kind: 'oil', lon: 23.5, lat: 49.3, km: 100, weight: 4 }, { kind: 'oil', lon: 45.7, lat: 43.3, km: 120, weight: 4 }, { kind: 'oil', lon: 48.9, lat: 31.95, km: 200, weight: 6 }, { kind: 'oil', lon: -97.0, lat: 33.5, km: 400, weight: 8 }, { kind: 'oil', lon: -119.0, lat: 35.3, km: 200, weight: 6 }, { kind: 'oil', lon: -98.0, lat: 21.5, km: 250, weight: 6 }, { kind: 'oil', lon: 103.5, lat: -2.5, km: 300, weight: 5 }, { kind: 'oil', lon: 116.8, lat: -1.2, km: 200, weight: 4 }, { kind: 'oil', lon: 94.9, lat: 20.4, km: 200, weight: 4 }, { kind: 'oil', lon: -61.5, lat: 10.2, km: 120, weight: 3 }, { kind: 'oil', lon: -71.0, lat: 10.0, km: 200, weight: 3 }, { kind: 'oil', lon: 44.4, lat: 35.5, km: 150, weight: 4 },
  // rubber
  { kind: 'rubber', lon: -60, lat: -5, km: 900, weight: 6 }, { kind: 'rubber', lon: 101.5, lat: 3.5, km: 300, weight: 6 }, { kind: 'rubber', lon: 80.5, lat: 7.0, km: 150, weight: 4 }, { kind: 'rubber', lon: 22, lat: -2, km: 700, weight: 5 }, { kind: 'rubber', lon: 100, lat: 0.5, km: 400, weight: 4 }, { kind: 'rubber', lon: 106.5, lat: 11.5, km: 250, weight: 3 },
  // nitrates and phosphates
  { kind: 'nitrates', lon: -69.8, lat: -22.5, km: 400, weight: 9 }, { kind: 'nitrates', lon: 9.0, lat: 33.5, km: 250, weight: 4 }, { kind: 'nitrates', lon: -6.9, lat: 32.8, km: 250, weight: 3 },
];

// ───────────────────────────── the definition ──────────────────────────────

/** The frame: the whole world from 56° S to 78° N, cut at the Bering Strait (169° W). */
export const BOX = { west: -169, east: 191, south: -56, north: 78 };

export function earthDef(): RealMapDef {
  return {
    id: 'earth',
    revision: 1,
    startYear: 1914,
    campaignYears: { options: [20, 30, 40], default: 30 },
    nations: NATIONS,
    regions: [],
    classify: () => undefined,
    auto: {
      realmOf,
      groupOf: landOf,
      targetKm2: (land, _realm, lat, lon) => 3.4 * PROV_KM2 * sparseOf(land, lat, lon),
      sparse: (land, _realm, lat, lon) => sparseOf(land, lat, lon),
      biome: (_land, lat, lon) => BIOME[zoneOf(lat, lon)],
      integ: (land, realm) => (inList(realm, 'gbr|fra|ger|ita|spa|por|ned|bel|usa|jpn|den') && !inList(land, 'Britain|Ireland|France|Germany|Italy|Spain|Portugal|Netherlands|Belgium|Denmark|Northeast|Midwest|South|West|Japan|Alaska') ? [25, 55] : undefined),
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
    cities: { max: 260, minPop: 150000, spacingKm: 260 },
    depositHints: DEPOSIT_HINTS,
    climate: 'temperate',
    wrapOcean: true,
    meta: {
      name: 'The World, 1914',
      description:
        'The whole world in the summer of 1914, from the Arctic to Cape Horn: the European great powers and their empires, the United States and Japan, China three years into its republic, and the independent kingdoms of Asia and Africa. Historical borders, approximated from present-day divisions; colonies and protectorates are held by the powers that governed them, and realms too small for a province on this scale are drawn with a neighbour.',
      blurb: 'A huge historical campaign: over a thousand provinces and 57 realms on the eve of the Great War.',
      size: 'huge',
      difficulty: 'hard',
      style: 'Empires across oceans; every front at once',
      mechanics: ['Real geography', 'Historical borders of 1914', 'Colonial empires', 'Oceans that wrap around', 'Mountain passes', 'Straits and islands'],
      origin: 'builtin',
      attribution: [
        'Coastlines, lakes, rivers, first-level divisions and towns: Natural Earth (naturalearthdata.com), public domain.',
        'Borders of 1914 approximated from present-day divisions; historical names, town populations of about 1914, ridges, passes and straits are authored (tools/earth.data.ts, with tools/europe.data.ts for Europe). Arms are simplified, in national colours.',
      ],
    },
  };
}

const PROV_KM2 = 90000;
