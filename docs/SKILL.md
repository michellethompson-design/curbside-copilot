---
name: abcd-screener
description: Screen logos, ads, and marketing assets for unintentional phallic, vulvar, or breast-like imagery before they ship. Use this skill whenever the user wants to check a design, logo, icon, ad, packaging, or any marketing piece for accidental suggestive shapes, asks to "run something through ABCD," mentions checking artwork for awkward or NSFW resemblance, or uploads a design and wants a brand-safety or visual QA pass. Trigger it even when the user does not say the word "ABCD," as long as they are asking whether an image accidentally looks suggestive.
---

# ABCD Screener

ABCD screens design assets for accidental anatomical resemblance so a designer can catch it before a client, a print run, or the public does. The point is to flag *unintentional* suggestion in professional work, not to moderate intentional adult content.

Designers miss this because they have stared at the file for hours and stopped seeing it fresh. ABCD looks at it cold and explains what an outside viewer might read into it.

## What this skill does

Given one or more images, this skill:
1. Analyzes each image for accidental phallic, vulvar, or breast-like forms, including shapes formed by negative space and by the juxtaposition of separate elements.
2. Returns a structured list of flags with category, severity, confidence, an approximate location, and a plain-language explanation.
3. Optionally renders a visual report: the image with translucent regions over each flag, plus a written breakdown beside it.

## Core principle: protect trust by not crying wolf

The single biggest failure mode is flagging neutral shapes. A designer who gets three bad flags stops using the tool. Lean toward silence on genuinely ambiguous or innocent shapes. A flag should clear this bar: would a reasonable outside viewer plausibly read this as suggestive at a glance? If not, do not flag it.

State uncertainty honestly. A low-confidence flag is fine when labeled as such. A confident flag on a coincidental curve is the thing that kills the product.

## Workflow

### Step 1: Read the rubric

Read `references/taxonomy.md` for the category definitions, the severity scale, and the strictness levels. Apply the clinical definitions there rather than improvising. This keeps results consistent across runs and across different assets.

### Step 2: Analyze each image

For each image, work through the full composition:
- The primary shapes and the logo mark itself.
- Negative space, which is where accidental imagery most often hides.
- Juxtaposition: two innocent elements placed so they read as one suggestive whole.
- Silhouette and outline, squinting past the detail.
- Orientation: a shape that is fine upright may read differently rotated or mirrored.

If you are calling the Claude API as the engine (in an app build) rather than viewing the image yourself, use the prompt in `references/detection-prompt.md` verbatim as the system instruction and require the JSON output in `references/output-schema.md`.

### Step 3: Produce output in the schema

Return results matching `references/output-schema.md`. Every flag carries:
- `category`: phallic, vulvar, or breast
- `severity`: low, medium, or high (defined in the taxonomy)
- `confidence`: 0.0 to 1.0
- `explanation`: what triggers it and where it sits in the composition, in plain words
- `region`: approximate normalized coordinates, marked approximate

When nothing meets the bar, return an empty flags array and a clear all-clear. Do not pad the result with weak flags to look thorough.

### Step 4: Offer the visual report

After giving the text result, offer to render an HTML report the user can open: the uploaded image with translucent boxes drawn from the region coordinates, color-coded by severity, beside a panel listing each flag and its explanation. Build this as a single self-contained HTML file. Read the region coordinates as normalized 0 to 1000 on each axis and multiply by the rendered image size to place boxes. Label every box as an approximate region, since coordinates from vision analysis are not pixel-tight.

## Strictness

By default, run at the medium strictness defined in the taxonomy. If the user asks for a stricter or looser pass, switch levels and say which level you used. Strictness changes how aggressively borderline shapes get flagged. It does not change the category definitions.

Do not frame strictness in terms of named countries or cultures. If a user wants a market-specific pass, treat it as a strictness choice plus any specific concerns they name, described in neutral terms.

## Tone of the report

Designers are handing you their work. Be matter-of-fact and a little dry rather than prudish or smirking. Describe what you see clinically, explain the risk, and let them decide. The tool advises. The human ships.

## Examples

**Example 1 (a real flag):**
Input: A rocket-themed logo where the rocket body and two lower fuel pods form a recognizable shape.
Output: One high-severity phallic flag, region over the lower-center of the mark, explanation noting the rounded pods read as testicular beneath the elongated body, recommendation to hold and adjust the pod spacing or size.

**Example 2 (an all-clear):**
Input: A clean wordmark with a leaf icon.
Output: Empty flags array, all-clear state, one line noting the leaf and letterforms read as intended with no suggestive resemblance.

**Example 3 (an honest low-confidence flag):**
Input: An abstract swoosh that curves back on itself.
Output: One low-confidence, low-severity flag, explanation noting the doubled curve could read suggestively when mirrored but reads as neutral motion in the upright original, recommendation to review rather than hold.
