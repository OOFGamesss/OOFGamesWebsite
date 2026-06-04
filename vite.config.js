// Vite multi-page build configuration covering the hub and all plugin/game pages.

import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const root = resolve(import.meta.dirname);

export default defineConfig({
  root,
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        notFound: resolve(root, '404.html'),
        gambaWhere: resolve(root, 'pages/gamba-where/index.html'),
        chocoboRacing: resolve(root, 'pages/chocobo-racing/index.html'),
        minigamesEmporium: resolve(root, 'pages/minigames-emporium/index.html'),
        eightBallPool: resolve(root, 'pages/minigames-emporium/games/8ballpool/index.html'),
        bar777: resolve(root, 'pages/minigames-emporium/games/bar777/index.html'),
        beerpong: resolve(root, 'pages/minigames-emporium/games/beerpong/index.html'),
        coinskipper: resolve(root, 'pages/minigames-emporium/games/coinskipper/index.html'),
        darts: resolve(root, 'pages/minigames-emporium/games/darts/index.html'),
        dealornodeal: resolve(root, 'pages/minigames-emporium/games/dealornodeal/index.html'),
        drt: resolve(root, 'pages/minigames-emporium/games/drt/index.html'),
        gamblederby: resolve(root, 'pages/minigames-emporium/games/gamblederby/index.html'),
        hotshots: resolve(root, 'pages/minigames-emporium/games/hotshots/index.html'),
        minefieldgambit: resolve(root, 'pages/minigames-emporium/games/minefieldgambit/index.html'),
        raffle: resolve(root, 'pages/minigames-emporium/games/raffle/index.html'),
        raidboss: resolve(root, 'pages/minigames-emporium/games/raidboss/index.html'),
        russianroulette: resolve(root, 'pages/minigames-emporium/games/russianroulette/index.html'),
        votingmadness: resolve(root, 'pages/minigames-emporium/games/votingmadness/index.html')
      }
    }
  }
});
