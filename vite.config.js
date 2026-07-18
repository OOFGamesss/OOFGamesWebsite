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

function prettyPathDevFallback(name, prefix) {
  const index = `${prefix}index.html`;
  return {
    name,
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        if (url.startsWith(prefix) && !url.startsWith(index)) {
          const restPath = url.slice(prefix.length).split('?')[0].replace(/^\/+|\/+$/g, '');
          if (restPath && !restPath.includes('/') && !restPath.includes('.')) {
            req.url = index;
          }
        }
        next();
      });
    },
  };
}

const chocoboRaceDevFallback = () =>
  prettyPathDevFallback('chocobo-race-dev-fallback', '/chocobo-racing/race/');
const drtBracketDevFallback = () =>
  prettyPathDevFallback('drt-bracket-dev-fallback', '/mini-games-emporium/drt/bracket/');

function sitemap() {
  const origin = 'https://oofgames.fyi';
  return {
    name: 'sitemap',
    apply: 'build',
    enforce: 'post',
    writeBundle(_options, bundle) {
      const urls = Object.values(bundle)
        .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.html'))
        .filter((chunk) => !/<meta\s+name="robots"[^>]*noindex/i.test(String(chunk.source)))
        .map((chunk) => `${origin}/${chunk.fileName.replace(/(^|\/)index\.html$/, '$1')}`)
        .sort();

      const body = urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n');
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
      );
    }
  };
}

export default defineConfig({
  root,
  publicDir,
  plugins: [tailwindcss(), gameImageManifests(), chocoboRaceDevFallback(), drtBracketDevFallback(), sitemap()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        notFound: resolve(root, '404.html'),
        account: resolve(root, 'account/index.html'),
        admin: resolve(root, 'admin/index.html'),
        developer: resolve(root, 'developer/index.html'),
        gambaWhere: resolve(root, 'gamba-where/index.html'),
        lottery: resolve(root, 'lottery/index.html'),
        chocoboRacing: resolve(root, 'chocobo-racing/index.html'),
        chocoboRace: resolve(root, 'chocobo-racing/race/index.html'),
        minigamesEmporium: resolve(root, 'mini-games-emporium/index.html'),
        eightBallPool: resolve(root, 'mini-games-emporium/8ballpool/index.html'),
        bar777: resolve(root, 'mini-games-emporium/bar777/index.html'),
        beerpong: resolve(root, 'mini-games-emporium/beerpong/index.html'),
        coinskipper: resolve(root, 'mini-games-emporium/coinskipper/index.html'),
        darts: resolve(root, 'mini-games-emporium/darts/index.html'),
        dealornodeal: resolve(root, 'mini-games-emporium/dealornodeal/index.html'),
        drt: resolve(root, 'mini-games-emporium/drt/index.html'),
        drtBracket: resolve(root, 'mini-games-emporium/drt/bracket/index.html'),
        higherlower: resolve(root, 'mini-games-emporium/higherlower/index.html'),
        minefieldgambit: resolve(root, 'mini-games-emporium/minefieldgambit/index.html'),
        raffle: resolve(root, 'mini-games-emporium/raffle/index.html'),
        raidboss: resolve(root, 'mini-games-emporium/raidboss/index.html'),
        russianroulette: resolve(root, 'mini-games-emporium/russianroulette/index.html'),
        votingmadness: resolve(root, 'mini-games-emporium/votingmadness/index.html')
      }
    }
  }
});
