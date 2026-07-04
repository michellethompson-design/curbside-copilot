import React, { useState } from 'react';

// BYO-key input + strictness dial. The key lives only in session memory and is
// sent per-request; it is never stored to disk by the app.
export default function Controls({ config, apiKey, setApiKey, strictness, setStrictness }) {
  const [reveal, setReveal] = useState(false);
  const levels = config.strictnessLevels || ['low', 'medium', 'high'];

  const strictnessBlurb = {
    low: 'Flags only strong, hard-to-miss resemblance. Fewest false positives.',
    medium: 'Flags clear resemblance and readable borderline cases. The everyday setting.',
    high: 'Flags subtle and conditional cases too, including rotated or mirrored readings.',
  };

  return (
    <section className="controls" aria-label="Screening settings">
      <div className="control-group">
        <label htmlFor="apikey">
          Claude API key
          {config.hasServerKey && <span className="muted"> (optional — server key available)</span>}
          {config.demoMode && <span className="muted"> (not needed in demo mode)</span>}
        </label>
        <div className="key-row">
          <input
            id="apikey"
            type={reveal ? 'text' : 'password'}
            placeholder="sk-ant-…"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="hint">
          Your key is used only for your request and never stored. Bring your own key so confidential
          assets go only to your own Anthropic account.
        </p>
      </div>

      <div className="control-group">
        <label id="strictness-label">Detection strictness</label>
        <div
          className="segmented"
          role="radiogroup"
          aria-labelledby="strictness-label"
        >
          {levels.map((lvl) => (
            <button
              key={lvl}
              role="radio"
              aria-checked={strictness === lvl}
              className={`seg ${strictness === lvl ? 'seg-active' : ''}`}
              onClick={() => setStrictness(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
        <p className="hint">{strictnessBlurb[strictness]}</p>
      </div>
    </section>
  );
}
