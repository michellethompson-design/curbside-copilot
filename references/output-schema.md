# Output Schema

Every analyzed image returns one JSON object in this shape. The app's overlay and report render directly from it, so keep the field names and types exact.

```json
{
  "image_id": "string",
  "filename": "string",
  "analyzed_at": "ISO-8601 timestamp",
  "strictness_profile": "low | medium | high",
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
      "explanation": "Plain-language description of what triggers the flag and where it sits in the composition.",
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

## Field notes

- `region` coordinates are normalized 0 to 1000 on each axis. To draw on a rendered image, multiply by the rendered width and height. `is_approximate` is always true; label boxes accordingly in the UI.
- `confidence` runs 0.0 to 1.0.
- `overall_recommendation` drives the headline UI state: `clear` (nothing found), `review` (worth a look, designer's call), `hold` (do not ship as is).
- `highest_severity` is `none` when there are no flags.
- When there are no flags, `flags` is an empty array and the summary reflects an all-clear.

## Parsing guidance for the build

- Validate the response against this schema before rendering.
- Strip any stray markdown fences before parsing JSON.
- A single malformed response must not crash a batch. Retry once, then mark that image as errored and continue the rest of the batch.
