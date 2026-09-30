// Bundled typefaces (SIL Open Font License 1.1; see THIRD_PARTY_NOTICES.md).
// Only the Latin subsets ship. Map lettering is drawn on a canvas, so the
// renderer waits for `fontsReady` before placing labels.

import alegreya from '@fontsource-variable/alegreya/files/alegreya-latin-wght-normal.woff2?url';
import alegreyaItalic from '@fontsource-variable/alegreya/files/alegreya-latin-wght-italic.woff2?url';
import alegreyaSc500 from '@fontsource/alegreya-sc/files/alegreya-sc-latin-500-normal.woff2?url';
import alegreyaSc700 from '@fontsource/alegreya-sc/files/alegreya-sc-latin-700-normal.woff2?url';
import sourceSans from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url';

const faces: Array<[string, string, FontFaceDescriptors]> = [
  ['Alegreya Variable', alegreya, { weight: '400 900', style: 'normal', display: 'swap' }],
  ['Alegreya Variable', alegreyaItalic, { weight: '400 900', style: 'italic', display: 'swap' }],
  ['Alegreya SC', alegreyaSc500, { weight: '500', style: 'normal', display: 'swap' }],
  ['Alegreya SC', alegreyaSc700, { weight: '700', style: 'normal', display: 'swap' }],
  ['Source Sans 3 Variable', sourceSans, { weight: '200 900', style: 'normal', display: 'swap' }],
];

function load(): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  const all = faces.map(([family, url, desc]) => {
    const f = new FontFace(family, `url(${url}) format('woff2')`, desc);
    document.fonts.add(f);
    return f.load().catch(() => undefined);
  });
  // never block the game on fonts: fall back after 2.5 s
  return Promise.race([Promise.all(all).then(() => undefined), new Promise<void>((r) => setTimeout(r, 2500))]);
}

export const fontsReady: Promise<void> = load();
