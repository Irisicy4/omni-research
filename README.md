# OmniResearch — papers & datasets front end

A two-tab static site for AI/ML researchers:

- **Tab 1 — Feed.** Xiaohongshu-style waterfall of new papers (arXiv / top venues).
  Cards show a one-line *summary* as the headline plus the *full paper title* as a subtitle.
- **Tab 2 — Datasets.** Multimodal Dataset Registry (port of
  [`Irisicy4/awesome-mmdataset-website`](https://github.com/Irisicy4/awesome-mmdataset-website))
  with the same form and filtering, plus localStorage persistence.

Theme: purple `#7c3aed` × sky `#0ea5e9`, matching the v0 dataset registry.

## File layout

```
.
├── index.html              # SPA entry
├── styles.css              # all CSS (theme tokens at the top)
├── app.js                  # all front-end logic (no build step)
├── data/
│   └── datasets-seed.json  # seed datasets for Tab 2
└── papers/
    ├── manifest.json       # flat index: image + summary + title per paper
    ├── 20260512/
    │   ├── 2605.10234.md
    │   ├── 2605.10567.md
    │   ├── 2605.10892.md
    │   └── 2605.11045.md
    ├── 20260511/
    │   ├── 2605.09435.md
    │   └── 2605.09812.md
    └── 20260510/
        ├── 2605.08345.md
        └── 2605.08721.md
```

Each `<arxivid>.md` is rendered (via `marked.js`) inside the paper detail modal when
clicked. YAML frontmatter is stripped; the rest is markdown.

## Adding a new paper

1. Create `papers/YYYYMMDD/<arxiv_id>.md` with frontmatter (see existing files).
2. Append an entry to `papers/manifest.json` with:
   `arxiv_id`, `date` (`YYYY-MM-DD`), `title` (paper title), `summary` (headline),
   `authors`, `venue`, `tags`, and optionally `image` (any URL — picsum.photos works).
3. Refresh the page.

> **Why a manifest?** The feed needs to render hundreds of cards without fetching
> hundreds of `.md` files. The manifest is the cheap "feed view"; each card lazily
> loads its `.md` on click. When you swap in a real ingestion bot you can either
> regenerate the manifest on push, or replace this with a real DB endpoint.

## Local preview

```sh
cd omni-research
python -m http.server 8000
# open http://localhost:8000
```

(Anything serving static files works — `npx serve`, `caddy file-server`, etc.)

## Hosting on GitHub Pages

1. Create a new **public** GitHub repo (any name, e.g. `omni-research`).
2. Push these files:
   ```sh
   git init
   git add .
   git commit -m "Initial OmniResearch MVP"
   git branch -M main
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
3. In the GitHub repo: **Settings → Pages → Source: Deploy from a branch → main / root**.
4. The site will appear at `https://<you>.github.io/<repo>/` in a minute or two.

The empty `.nojekyll` file keeps GitHub Pages from running Jekyll over the project —
required because some directories (`papers/`) start with non-letter chars in some
ingestion scenarios and Jekyll silently drops them.

## Wiring up a real papers DB later

The user-facing contract is just `papers/manifest.json` + the per-paper `.md` files.
Three swap-in options when scaling beyond mock:

| Approach | What changes |
|:---|:---|
| **Bot writes to this repo** | A cron job fetches arXiv, writes `.md` files and rebuilds `manifest.json`, commits. Site stays purely static. |
| **Separate content repo** | Point `PAPER_MANIFEST_URL` in `app.js` at a `raw.githubusercontent.com` URL of another repo. Add CORS-friendly host. |
| **Real API** | Replace `loadPapers()` with a fetch to your backend. The card schema is the only contract. |

For Tab 2, current persistence is localStorage. To switch to a shared backend, replace
`loadLocalDatasets` / `saveLocalDatasets` in `app.js` with calls to Firestore (the
v0 repo already shows the config shape) or any HTTP endpoint.
