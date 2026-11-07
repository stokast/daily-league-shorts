// Every font the ad draws with. Geist Pixel Square is Spawn's own UI font (geist on npm, OFL);
// the rest are OFL Google fonts from @fontsource, used only on the made-up games' title screens.
const FS = '/node_modules/@fontsource';
const fs = (pkg, weight = 400) => `${FS}/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`;

export const FONTS = [
  { family: 'Geist Pixel', src: '/node_modules/geist/dist/fonts/geist-pixel/GeistPixel-Square.woff2' },
  { family: 'Geist Mono', src: '/node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.woff2', weight: 500 },
  { family: 'Inter', src: fs('inter', 400), weight: 400 },
  { family: 'Inter', src: fs('inter', 700), weight: 700 },
  { family: 'Inter', src: fs('inter', 900), weight: 900 },
  { family: 'Anton', src: fs('anton') },
  { family: 'Audiowide', src: fs('audiowide') },
  { family: 'Bangers', src: fs('bangers') },
  { family: 'Bebas Neue', src: fs('bebas-neue') },
  { family: 'Black Ops One', src: fs('black-ops-one') },
  { family: 'Bungee', src: fs('bungee') },
  { family: 'Chakra Petch', src: fs('chakra-petch', 600), weight: 600 },
  { family: 'Chakra Petch', src: fs('chakra-petch', 700), weight: 700 },
  { family: 'Cinzel Decorative', src: fs('cinzel-decorative', 900), weight: 900 },
  { family: 'Cinzel Decorative', src: fs('cinzel-decorative', 700), weight: 700 },
  { family: 'Creepster', src: fs('creepster') },
  { family: 'Fredoka', src: fs('fredoka', 600), weight: 600 },
  { family: 'Fredoka', src: fs('fredoka', 700), weight: 700 },
  { family: 'Lilita One', src: fs('lilita-one') },
  { family: 'Luckiest Guy', src: fs('luckiest-guy') },
  { family: 'Monoton', src: fs('monoton') },
  { family: 'Nosifer', src: fs('nosifer') },
  { family: 'Orbitron', src: fs('orbitron', 900), weight: 900 },
  { family: 'Orbitron', src: fs('orbitron', 600), weight: 600 },
  { family: 'Permanent Marker', src: fs('permanent-marker') },
  { family: 'Pirata One', src: fs('pirata-one') },
  { family: 'Press Start 2P', src: fs('press-start-2p') },
  { family: 'Righteous', src: fs('righteous') },
  { family: 'Russo One', src: fs('russo-one') },
  { family: 'Rye', src: fs('rye') },
  { family: 'Sedgwick Ave Display', src: fs('sedgwick-ave-display') },
  { family: 'Silkscreen', src: fs('silkscreen', 400), weight: 400 },
  { family: 'Silkscreen', src: fs('silkscreen', 700), weight: 700 },
  { family: 'Staatliches', src: fs('staatliches') },
  { family: 'Teko', src: fs('teko', 600), weight: 600 },
  { family: 'Teko', src: fs('teko', 400), weight: 400 },
  { family: 'Titan One', src: fs('titan-one') },
  { family: 'Zen Dots', src: fs('zen-dots') },
];

export async function loadFonts() {
  await Promise.all(FONTS.map(async (f) => {
    const face = new FontFace(f.family, `url(${f.src})`, { weight: String(f.weight || 400) });
    await face.load();
    document.fonts.add(face);
  }));
  await document.fonts.ready;
}
