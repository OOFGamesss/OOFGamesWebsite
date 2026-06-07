# OOF Games - Frontend

The static presentation layer for [oofgames.fyi](https://oofgames.fyi) - a decoupled gaming ecosystem hub. This repo contains only the frontend; it is served as a static site from a CDN and talks to the backend over HTTPS.

## Stack

- **[Vite](https://vitejs.dev/)** - multi-page build
- **[Tailwind CSS](https://tailwindcss.com/)** - styling
- **Vanilla JS** - no framework

## Architecture

```
Browser → oofgames.fyi      → GitHub Pages (this repo, static CDN)
Browser → api.oofgames.fyi  → Backend API (separate service)
```

The API base URL is auto-selected by hostname in [`src/api/api-client.js`](src/api/api-client.js):
production calls go to `https://api.oofgames.fyi`, local dev to `http://127.0.0.1:8000`.

## Project structure

Vite's `root` is `src/`, so paths under it serve from the web root (e.g. `src/pages/gamba-where/` → `/pages/gamba-where/`).

```
frontend/
├── public/                   # static assets served at / (images, game-images)
├── src/                      # application source (Vite root)
│   ├── index.html, 404.html  # top-level entry pages
│   ├── api/                  # network requests & HTTP client
│   ├── assets/               # raw CSS / local style assets
│   ├── components/           # reusable JS components (carousel, widgets)
│   ├── pages/                # plugin & game pages (multi-page entries)
│   ├── utils/                # reusable helpers (e.g. card-hover)
│   └── main.js               # hub entry script
├── dist/                     # production build output
├── package.json
└── vite.config.js            # multi-page build config
```

## Local development

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build (http://localhost:4173)
```

## Deployment

Pushing to `main` triggers the [GitHub Pages workflow](.github/workflows/deploy-frontend.yml),
which builds the site and publishes `dist/` to the custom domain `oofgames.fyi`.

## License

Released under the [MIT License](LICENSE).
