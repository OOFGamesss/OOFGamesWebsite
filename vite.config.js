// Vite multi-page build configuration covering the hub and all plugin/game pages.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = resolve(import.meta.dirname);
const root = resolve(projectRoot, 'src');
const publicDir = resolve(projectRoot, 'public');
const outDir = resolve(projectRoot, 'dist');

function gameImageManifests() {
  const generateManifests = () => {
    const baseDir = resolve(publicDir, 'game-images');
    if (!existsSync(baseDir)) return;

    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const gameDir = resolve(baseDir, entry.name);
      const images = readdirSync(gameDir)
        .filter((name) => /^\d+\.png$/i.test(name))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

      writeFileSync(resolve(gameDir, 'manifest.json'), JSON.stringify(images));
    }
  };

  return {
    name: 'game-image-manifests',
    buildStart: generateManifests,
    configureServer: generateManifests
  };
}

function chocoboRaceDevFallback() {
  const racePrefix = '/chocobo-racing/race/';
  const raceIndex = '/chocobo-racing/race/index.html';
  return {
    name: 'chocobo-race-dev-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        if (url.startsWith(racePrefix) && !url.startsWith(raceIndex)) {
          const rest = url.slice(racePrefix.length);
          if (rest && !rest.startsWith('?') && !rest.split('?')[0].includes('.')) {
            req.url = raceIndex;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root,
  publicDir,
  plugins: [tailwindcss(), gameImageManifests(), chocoboRaceDevFallback()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        notFound: resolve(root, '404.html'),
        account: resolve(root, 'account/index.html'),
        developer: resolve(root, 'developer/index.html'),
        gambaWhere: resolve(root, 'gamba-where/index.html'),
        chocoboRacing: resolve(root, 'chocobo-racing/index.html'),
        chocoboRace: resolve(root, 'chocobo-racing/race/index.html'),
        minigamesEmporium: resolve(root, 'minigames-emporium/index.html'),
        eightBallPool: resolve(root, 'minigames-emporium/games/8ballpool/index.html'),
        bar777: resolve(root, 'minigames-emporium/games/bar777/index.html'),
        beerpong: resolve(root, 'minigames-emporium/games/beerpong/index.html'),
        coinskipper: resolve(root, 'minigames-emporium/games/coinskipper/index.html'),
        darts: resolve(root, 'minigames-emporium/games/darts/index.html'),
        dealornodeal: resolve(root, 'minigames-emporium/games/dealornodeal/index.html'),
        drt: resolve(root, 'minigames-emporium/games/drt/index.html'),
        gamblederby: resolve(root, 'minigames-emporium/games/gamblederby/index.html'),
        higherlower: resolve(root, 'minigames-emporium/games/higherlower/index.html'),
        minefieldgambit: resolve(root, 'minigames-emporium/games/minefieldgambit/index.html'),
        raffle: resolve(root, 'minigames-emporium/games/raffle/index.html'),
        raidboss: resolve(root, 'minigames-emporium/games/raidboss/index.html'),
        russianroulette: resolve(root, 'minigames-emporium/games/russianroulette/index.html'),
        votingmadness: resolve(root, 'minigames-emporium/games/votingmadness/index.html')
      }
    }
  }
});
