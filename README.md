# ABCD

**A cold, outside-eye QA pass for your design assets.**

ABCD screens logos, ads, icons, packaging, and other marketing artwork for
*accidental* phallic, vulvar, or breast-like imagery — the kind everyone on the
team stopped seeing after staring at the file for hours — before it ships to a
client, a print run, or the public. It looks at the work cold and explains what
an outside viewer might read into it, with a severity, a confidence, an
approximate location, and a plain-language reason for every flag.

The detection engine is Claude's vision capability. ABCD wraps it in a web app
that draws flagged regions on your own asset and gives you the reasoning so you
can make the call. **The tool advises; you decide what ships.**

> Built with Next.js (App Router). This is the standalone app from
> [`docs/PRD.md`](docs/PRD.md). The public name is the clinical acronym **ABCD**,
> set in one place — [`lib/brand.js`](lib/brand.js) — so it can be changed
> trivially.

---

## What it does

- **Upload** single files or batches. Supported: PNG, JPEG, TIFF, WEBP, SVG, and
  PDF (each PDF page is screened separately). SVG and PDF are rasterized
  server-side so the vision model always sees a flat image.
- **Analyze** each image against three clinical categories — phallic, vulvar,
  breast — using a false-positive-averse prompt tuned to *not cry wolf*.
- **Overlay** translucent, explicitly-approximate regions on the image,
  color-coded by severity and linked to the report.
- **Report** every flag with category, severity, confidence, and a plain-language
  explanation, sorted by severity, with a clear all-clear state when nothing is
  found.
- **Strictness dial** — low / medium / high — controls how aggressively borderline
  shapes are flagged. Defaults to medium.
- **Bring-your-own-key** so confidential, unreleased assets go only to *your* own
  Anthropic account. No image is ever retained.

### The design decision that matters most

ABCD leans toward **silence** on genuinely ambiguous shapes. A tool that flags
innocent curves gets turned off in a week, so the flagging threshold is guarded
harder than anything else. A confident flag on a coincidental curve is the thing
that kills the product; the prompt is written accordingly.

### Approximate regions, by design

Vision models do not return pixel-tight bounding boxes. ABCD asks for normalized
coordinates on a 0–1000 scale and renders them as translucent regions **labeled
approximate**. The written report carries the real explanatory weight (it
describes the location in words too). See [`docs/PRD.md`](docs/PRD.md) Section 7.

---

## Quick start

Requires **Node.js ≥ 20** and, for PDF support, **poppler** (`pdftoppm` on your
`PATH` — `apt-get install poppler-utils` or `brew install poppler`).

```bash
git clone <this-repo>
cd curbside-copilot          # repo directory
npm install
cp .env.example .env         # optional; edit if you want a server key or demo mode
```

### Run it

**Development** (hot reload, on port 8787):

```bash
npm run dev
# open http://localhost:8787
```

**Production**:

```bash
npm run build
npm start
# open http://localhost:8787
```

**Try it with no API key or spend** — demo mode returns deterministic canned
results so you can exercise the whole UI (overlay, report, batch streaming,
all-clear state):

```bash
DEMO_MODE=1 npm run dev
```

---

## Bring-your-own-key

ABCD never ships with a key. There are two ways to supply one:

1. **In the app (recommended for privacy).** Paste your Claude API key into the
   key field. It is held in your browser session only, sent with your request,
   used server-side for that request, and never persisted. Your asset goes only
   to your own Anthropic account.
2. **Server-side fallback.** Set `ANTHROPIC_API_KEY` in `.env`. Used only when a
   request does not bring its own key. Handy for a trusted internal deployment.

Get a key from the [Anthropic Console](https://console.anthropic.com/).

## Configuration

All via environment variables (see [`.env.example`](.env.example)):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Server port (`npm run dev`/`start` pass `-p 8787`). |
| `ANTHROPIC_API_KEY` | *(empty)* | Optional server-side fallback key. |
| `CLAUDE_MODEL` | `claude-sonnet-5` | Vision model used for analysis. |
| `DEMO_MODE` | `0` | `1` = no API calls, canned results. |
| `MAX_FILE_SIZE_MB` | `25` | Hard per-file size cap. |
| `MAX_BATCH_FILES` | `50` | Hard per-batch file count cap. |

## Cost

ABCD makes **one vision API call per image** (and one per PDF page). Cost scales
linearly with batch size and is billed to whichever key made the request — with
BYO-key, that's the user. A typical logo screen is a single image plus a short
JSON response, so per-image cost is small, but a 50-file batch is 50 calls. Check
current per-token pricing for your chosen model on the
[Anthropic pricing page](https://www.anthropic.com/pricing) and size batches
accordingly. Requests are processed sequentially to respect rate limits rather
than firing all at once.

## Privacy

- Screened images are sent to **Anthropic's Claude API** and nowhere else.
- **No image is retained.** Files are rasterized in memory, sent for analysis,
  and discarded when the request finishes — nothing is written to disk or a
  database.
- Your API key lives in your browser session only; the app never stores it.
- Don't screen assets you are not permitted to send to a third-party API.

## How it works (architecture)

Single Next.js app — React UI and API route handlers in one project.

```
app/
  layout.jsx               root layout + metadata
  page.jsx                 client root: state, streaming orchestration
  globals.css              styles
  api-client.js            reads the NDJSON result stream
  severity.js              severity presentation helpers (accessible)
  components/              Uploader, Controls, ImageViewer (overlay),
                           ReportPanel, ResultsView, PrivacyNote
  api/
    config/route.js        GET public runtime config (never leaks the key)
    analyze/route.js       POST streaming NDJSON analysis (nodejs runtime)
lib/                       framework-agnostic server logic
  rasterize.js             sharp (raster + SVG) / poppler (PDF) → flat PNG pages
  prompt.js                detection prompt + strictness injection
  claude.js                Anthropic messages endpoint (vision), typed errors
  analyze.js               call → parse → validate, retry once, never crash a batch
  schema.js                parse/normalize model output to the contract
  schema.test.js           unit tests for the parser/normalizer
  demo.js                  deterministic canned results for DEMO_MODE
  config.js                env-driven config
  brand.js                 single source of truth for the public name
references/                taxonomy, detection prompt, output schema (the rubric)
docs/PRD.md                full product spec
docs/SKILL.md              the ABCD Claude skill (usable without building the app)
```

The `POST /api/analyze` route streams newline-delimited JSON — one result object
per image as it completes — so batch results appear live instead of blocking on
the whole set. Each result conforms to the schema in
[`references/output-schema.md`](references/output-schema.md). A single malformed
model response is retried once, then marked errored so the rest of the batch
continues.

## Testing

```bash
npm test          # unit tests for the response parser/normalizer
npm run build     # production build
```

## Roadmap

- **v1.1:** per-flag agree/disagree feedback capture to tune strictness
  thresholds from real dispute data; optional neutral region presets on top of
  strictness.
- **Later:** hosted SaaS with managed keys and batch queues (the monetization
  path — built around this open core); a design-tool plugin.

## Using it as a Claude skill instead

You don't have to run the app to use the screener. [`docs/SKILL.md`](docs/SKILL.md)
is an installable Claude skill: install it in a Claude product that supports
skills, upload a design, and ask Claude to screen it. Good for testing the rubric
on real assets.

## License

MIT — see [`LICENSE`](LICENSE). The detection logic is open. A future hosted
version with managed keys and batch queues can be built around it.
