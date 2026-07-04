# ABCD — Product Requirements Document

**Codename:** ABCD
**Public name:** ABCD (clinical acronym; see Open Decisions)
**Document owner:** Michelle Thompson
**Status:** Draft v1, ready for build handoff
**Intended reader:** A developer or build agent constructing the app

---

## 1. Summary

ABCD is a content-screening tool for designers. A user uploads a logo, ad, or marketing piece, and the tool flags unintentional phallic, vulvar, or breast-like imagery before the asset ships. Output is a visual overlay on the image plus a written report explaining each flag.

The detection engine is the Claude API's vision capability. The product wraps that engine in a web interface, so designers see flagged regions on their own asset and understand why each one triggered.

---

## 2. Problem

Brands and agencies regularly ship logos and ads containing accidental suggestive imagery that nobody on the team caught. The cost of a miss is public ridicule and reputational damage. Catching it currently depends on someone happening to notice, which does not scale across a design team producing dozens of assets a week.

There is no lightweight, trustworthy QA step a designer can run before sending work to a client or to print.

---

## 3. Goals and non-goals

**Goals**
- Let a designer screen a single image or a batch in under a minute per asset.
- Show flagged regions directly on the image, not as a detached list.
- Explain every flag in plain language so the designer can judge it.
- Keep false positives low enough that designers keep the tool turned on.
- Protect confidential, unreleased assets.

**Non-goals (v1)**
- Detecting explicit, intentional adult content (this tool is about accidental suggestion, not moderation of porn).
- Auto-fixing or auto-editing the asset.
- Real-time screening inside design software (no Figma/Photoshop plugin in v1).
- Named-culture sensitivity profiles (deferred; see Sensitivity section).

---

## 4. Target users

1. **In-house brand and design teams** at mid-to-large companies where a public mishap is expensive. Primary buyer.
2. **Agencies** handling multiple client brands, who need a repeatable QA gate.
3. **Social and content teams** producing high volumes of marketing assets.

Willingness to pay tracks how damaging a public slip would be to the user's brand.

---

## 5. Scope and phasing

**MVP (v1.0)**
- Single image upload and batch upload.
- Three detection categories: phallic, vulvar, breast-like forms.
- One fixed detection strictness (the default profile).
- Approximate-region overlay plus side-panel report.
- Brought-your-own-API-key mode for privacy.

**v1.1**
- Detection strictness dial (low / medium / high aggressiveness).
- Optional region presets layered on top of strictness.
- Dispute/feedback capture on individual flags to tune thresholds.

**Later**
- Hosted SaaS version with managed keys and batch queues.
- Design-tool plugin.

The data schema in Section 9 must support the v1.1 dial from day one so it drops in without a rewrite.

---

## 6. Functional requirements

### 6.1 Upload
- Accept single files and multi-file batches.
- Supported types: PNG, JPEG, TIFF, WEBP, SVG, and PDF (for multi-page collateral).
- SVG and PDF are rasterized server-side before analysis so the vision model receives a flat image.
- Enforce a max file size and a max batch count (set sensible defaults, e.g. 25 MB per file, 50 files per batch; tune later).

### 6.2 Analysis
- Each image is sent to the Claude API vision endpoint with a structured prompt (Section 8).
- The model returns structured JSON conforming to the schema in Section 9.
- Batch jobs process images and surface results as each completes, rather than blocking on the whole set.

### 6.3 Overlay
- Render the uploaded image in a viewer.
- Draw translucent regions over each flagged area using the normalized coordinates the model returns.
- Label each region as approximate. Do not promise pixel-tight boxes (see Section 7).
- Clicking a region highlights its matching entry in the report, and vice versa.
- Color-code regions by severity.

### 6.4 Report panel
- A side panel lists every flag with: category, severity, a plain-language explanation of what triggered it, and a confidence indicator.
- Sort flags by severity by default.
- If nothing is flagged, show a clear all-clear state rather than an empty panel.

### 6.5 Privacy controls
- Brought-your-own-key mode: the user supplies their own Claude API key, so their asset goes only to their own API account.
- Clear, visible statement of where the image is sent and whether anything is stored.
- No image retention by default. If a hosted version stores anything, it must be opt-in and stated.

---

## 7. The overlay localization problem (read before building the overlay)

Vision models do not reliably return pixel-perfect bounding boxes. A naive "draw a tight box around the offending shape" feature will under-deliver and erode trust.

**Required approach for v1:**
- Ask the model for normalized coordinates on a 0 to 1000 scale for both axes, representing an approximate bounding region per flag.
- Render these as translucent regions clearly labeled as approximate.
- Put the real explanatory weight in the written report, which describes the location in words ("the negative space between the two figures on the lower left") in addition to the box.

**Acceptable fallback if boxes prove too noisy in testing:**
- Overlay a coarse grid (for example 4x4) and have the model name which cells contain the concern. Less precise, more robust.

Decide between these two during a short spike before committing the overlay UI.

---

## 8. Detection prompt design

The prompt sent to the Claude API per image must:
- Define the three categories precisely and clinically, framed as accidental visual resemblance in a professional design context, not as moderation of intentional adult content.
- Instruct the model to consider the whole composition, including negative space, juxtaposition of elements, and silhouette, since accidental imagery often lives in negative space.
- Require a severity rating per flag (see scale below).
- Require a confidence rating per flag.
- Require approximate coordinates per flag.
- Instruct the model to return only valid JSON matching the schema, with no preamble or markdown fences.
- Instruct the model to return an empty flags array when nothing rises to the threshold, rather than inventing borderline flags.

The strictness profile (Section 10) is injected into this prompt to shift how aggressively the model flags.

A false-positive-averse instruction is mandatory: the model should err toward not flagging genuinely neutral shapes, because the product dies if designers stop trusting it.

---

## 9. Output schema (the contract the build agent needs)

Every analysis returns one JSON object per image:

```json
{
  "image_id": "string",
  "filename": "string",
  "analyzed_at": "ISO-8601 timestamp",
  "strictness_profile": "default | low | medium | high",
  "summary": {
    "flag_count": 0,
    "highest_severity": "none | low | medium | high",
    "overall_recommendation": "clear | review | hold"
  },
  "flags": [
    {
      "id": "string",
      "category": "phallic | vulvar | breast",
      "severity": "low | medium | high",
      "confidence": 0.0,
      "explanation": "Plain-language description of what triggered the flag and where it sits in the composition.",
      "region": {
        "x_min": 0,
        "y_min": 0,
        "x_max": 1000,
        "y_max": 1000,
        "is_approximate": true
      }
    }
  ]
}
```

Notes for the build agent:
- Coordinates are normalized 0 to 1000 on each axis. Multiply by rendered image dimensions to draw.
- `confidence` is 0.0 to 1.0.
- `overall_recommendation` drives the headline state in the UI.
- Validate and safely parse the model response. Strip any stray markdown fences before parsing. Handle malformed responses without crashing the batch.

---

## 10. Sensitivity / strictness (v1.1, design schema now)

**Framing decision:** The dial controls detection strictness, meaning how aggressively the tool flags borderline shapes. It is not a "this country is prudish" toggle. Naming whole cultures as more or less sensitive bakes in stereotypes and creates a liability. Region presets, if added later, sit on top of strictness as optional tuning, described in neutral terms.

**Proposed v1.1 levels:**
- **Low:** flags only strong, obvious resemblance. Fewest false positives.
- **Medium (default):** flags clear resemblance and notable borderline cases.
- **High:** flags subtle and borderline cases. Most cautious, most false positives.

The dial changes the strictness instruction injected into the detection prompt. Same model, different threshold language. No second model required.

Capture per-flag user feedback (agree / disagree) starting in v1.1 so real dispute data sets where the thresholds actually belong.

---

## 11. Technical architecture

**Frontend**
- React (or Vue) single-page app.
- Image viewer with an overlay layer for translucent regions.
- Side report panel linked to overlay regions.
- Upload component supporting drag-and-drop, single and batch.

**Backend**
- Handles file upload, rasterization of SVG/PDF, and the Claude API calls.
- Sends each image to the Claude vision endpoint with the structured prompt.
- Parses and validates the JSON response against the Section 9 schema.
- Returns results to the frontend, streaming per-image completion for batches.

**Claude API integration**
- Use the standard messages endpoint with image input.
- Never hard-code or expose an API key in client code.
- In BYO-key mode, the user's key is used server-side for their request and not persisted.
- Respect rate limits; queue batch requests rather than firing all at once.

**Distribution**
- Open-source repository on GitHub.
- Clear README covering setup, BYO-key configuration, supported file types, and the privacy model.
- Core detection logic stays open. A future hosted wrapper with managed keys and batch queues is the monetization path and stays separate.

---

## 12. Non-functional requirements

- **Performance:** under roughly one minute per asset end to end, network permitting.
- **Cost:** per-image vision call. Document expected cost per image in the README so users running large batches understand the bill. BYO-key shifts cost to the user.
- **Privacy:** confidential, unreleased assets must never go anywhere the user did not explicitly choose. No retention by default.
- **Reliability:** a single malformed model response must not kill a batch. Failed images report a clear error and the batch continues.
- **Accessibility:** report panel readable by screen readers; do not rely on color alone for severity.

---

## 13. Edge cases and failure handling

- **Model returns no flags:** show a clear all-clear state.
- **Model returns malformed JSON:** retry once, then mark the image as errored without crashing.
- **Very large or very small images:** rasterize and resize to a sane analysis resolution; map coordinates back to display size.
- **Multi-page PDF:** treat each page as a separate analyzed image.
- **Animated or layered SVG:** flatten to a static raster before analysis.
- **Borderline shape the designer disagrees with:** the report explanation must give enough reasoning for the designer to overrule it confidently. The tool advises, the human decides.

---

## 14. Success metrics

- **Trust:** percentage of flags users mark as fair once feedback ships. Target this climbing over time.
- **Retention:** teams still running assets through the tool after week four.
- **Catch rate:** qualitative, gathered from users reporting it caught something they would have shipped.
- **False-positive rate:** disputed flags as a share of total flags. The number to drive down.

---

## 15. Open decisions

1. **Public product name.** ~~The internal codename may not land with brand-safety buyers at large companies. Decide on a public-facing name separate from the codename.~~ **Resolved:** the public name is the clinical acronym **ABCD**, deliberately never spelled out. It is set in one place — `lib/brand.js` — so it can be changed trivially without touching the rest of the codebase. The vulgar codename expansion is deliberately kept out of this repo's git history.
2. **Overlay method.** Approximate bounding boxes versus coarse grid. **Resolved (build):** shipped approximate normalized boxes (0–1000 per axis), rendered as translucent regions explicitly labeled "approximate," with the written report carrying the detail. The schema/renderer are box-based; a coarse-grid fallback can be layered later if boxes prove too noisy on real assets.
3. **Hosted versus open-only.** Confirm whether a hosted paid tier is in the near-term plan or strictly later. *(Still owner's call — the MVP is open-only and BYO-key; nothing in the build blocks a future hosted wrapper.)*
4. **Default strictness for MVP.** ~~Confirm medium.~~ **Resolved:** ships at **medium** by default. The low/medium/high dial is also wired in now (the schema always supported it), defaulting to medium.
5. **File size and batch limits.** ~~Set and confirm.~~ **Resolved (defaults, tunable via env):** 25 MB per file, 50 files per batch (`MAX_FILE_SIZE_MB`, `MAX_BATCH_FILES`).

---

## 16. Suggested build sequence

1. Spike the detection prompt against a set of real and deliberately suggestive sample images. Tune category definitions and the false-positive instruction until results feel right at the default strictness.
2. Decide the overlay method from the spike results.
3. Build the backend: upload, rasterization, single-image Claude call, schema validation.
4. Build the frontend: viewer, overlay, report panel, single-image flow.
5. Add batch upload and per-image streaming results.
6. Add BYO-key mode and the privacy statement.
7. Write the README and open-source the repo.
8. (v1.1) Add the strictness dial and per-flag feedback capture.
