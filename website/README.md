# Forge website

The landing page, user guide, privacy policy and changelog, built with Docusaurus and deployed to GitHub Pages by [.github/workflows/pages.yml](../.github/workflows/pages.yml).

The content is not duplicated here. `npm run sync` (run automatically before `start` and `build`) copies `/docs`, `/docs/images`, `PRIVACY.md` and `CHANGELOG.md` into the site, so edit those files and the site follows. Generated files are git-ignored.

## Run locally

```sh
cd website
npm ci
npm start        # http://localhost:3000
npm run build    # static site in website/build
```

## Configure

- **Play Store link:** edit `playStoreUrl` in [site.config.js](site.config.js), or set a repository variable `PLAY_STORE_URL` (Settings → Secrets and variables → Actions → Variables) to change it without a commit.
- **Repository:** the GitHub links use the repository the workflow runs in. For local builds, edit `githubRepo` in site.config.js.
- **Landing page:** [src/pages/index.js](src/pages/index.js). Screenshots come from `docs/images`.
- **Custom domain:** add it in Settings → Pages. The workflow picks up the new address on the next run.

## Enable GitHub Pages (once)

1. Push the repository to GitHub with the default branch named `main`.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Run the **Website** workflow from the Actions tab, or push a change to `docs/`.

The site is then at `https://<user>.github.io/<repo>/`, and the privacy policy for Play Console at `https://<user>.github.io/<repo>/privacy`.
