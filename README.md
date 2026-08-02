# calaba
calaba website

---

## Deployment

This site deploys automatically to GitHub Pages via the workflow at
`.github/workflows/deploy.yml` on every push to `main`.

**One-time GitHub repo setup:** In the repo's **Settings → Pages**, set
**Source** to **"GitHub Actions"** (not "Deploy from a branch"). The site
will be available at `https://trey0five.github.io/calaba/`.

## Local development

```bash
npm install
npm run dev       # Vite dev server
npm run build     # Type-check + production build to dist/
npm run preview   # Preview the production build at http://localhost:4173/calaba/
```
