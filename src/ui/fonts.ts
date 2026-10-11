// Bundled typefaces from the atlas pack (SIL Open Font License 1.1; the notices
// ship in licenses/ and THIRD_PARTY_NOTICES.md): Barlow Condensed for short
// headings and map lettering, Source Sans 3 for the interface, with tabular
// figures. Map lettering is drawn on a canvas, so the renderer waits for
// `fontsReady` before placing labels.

import barlow500 from '../assets/fonts/BarlowCondensed-Medium.woff2?url';
import barlow600 from '../assets/fonts/BarlowCondensed-SemiBold.woff2?url';
import sourceSans from '../assets/fonts/SourceSans3-Variable.woff2?url';

/** CSS font stacks, shared by the stylesheet and the canvas renderers. */
export const HEADING = "'Barlow Condensed', 'Arial Narrow', sans-serif";
export const SANS = "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const faces: Array<[string, string, FontFaceDescriptors]> = [
  ['Barlow Condensed', barlow500, { weight: '500', style: 'normal', display: 'swap' }],
  ['Barlow Condensed', barlow600, { weight: '600', style: 'normal', display: 'swap' }],
  ['Source Sans 3', sourceSans, { weight: '200 900', style: 'normal', display: 'swap' }],
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
