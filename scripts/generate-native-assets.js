// Generates the source assets @capacitor/assets rasterizes into the iOS/Android
// icon + splash sets. Reuses the phase-10 Pokéball renderer (generate-icons.js).
// Run: `node scripts/generate-native-assets.js`, then `npx capacitor-assets generate`.
const fs = require("fs");
const path = require("path");
const { render, encodePng } = require("./generate-icons");

const OUT = path.resolve(__dirname, "../assets");
fs.mkdirSync(OUT, { recursive: true });

function writeSquare(name, size, ratio, transparentBg) {
  const png = encodePng(render(size, ratio, transparentBg), size);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`wrote assets/${name} (${size}px, ${png.length} bytes)`);
}

// App icon — 1024×1024, opaque dark brand bg (stores reject transparency here).
writeSquare("icon.png", 1024, 0.44, false);
// Adaptive-icon foreground — transparent bg, extra padding for the safe zone;
// @capacitor/assets pairs it with the `--iconBackgroundColor` flag.
writeSquare("icon-foreground.png", 1024, 0.5, true);
// Splash — 2732×2732, small centered ball on the brand bg (light + dark same).
writeSquare("splash.png", 2732, 0.14, false);
writeSquare("splash-dark.png", 2732, 0.14, false);

console.log("done — now run: npx capacitor-assets generate");
