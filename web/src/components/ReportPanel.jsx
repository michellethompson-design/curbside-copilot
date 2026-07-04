import React from 'react';
import { sevOf, bySeverityDesc, RECOMMENDATION } from '../severity.js';

// The written report. Sorted by severity. Screen-reader friendly: severity and
// confidence are stated in text, not conveyed by color alone.
export default function ReportPanel({ result, activeFlagId, onHoverFlag }) {
  if (result.error) {
    return (
      <div className="report">
        <div className="report-error" role="alert">
          <strong>Could not screen this file.</strong>
          <p>{result.error}</p>
        </div>
      </div>
    );
  }

  const rec = RECOMMENDATION[result.summary?.overall_recommendation] || RECOMMENDATION.clear;
  const flags = [...(result.flags || [])].sort(bySeverityDesc);

  return (
    <div className="report">
      <div className={`recommendation ${rec.className}`}>
        <span className="rec-dot" aria-hidden="true" />
        <span className="rec-label">{rec.label}</span>
        <span className="rec-count">
          {result.summary.flag_count} flag{result.summary.flag_count === 1 ? '' : 's'}
        </span>
      </div>

      {flags.length === 0 ? (
        <div className="all-clear">
          <div className="all-clear-check" aria-hidden="true">✓</div>
          <p className="all-clear-title">All clear</p>
          <p className="all-clear-sub">
            Nothing rose to the flagging bar at {result.strictness_profile} strictness. Reads as
            intended.
          </p>
        </div>
      ) : (
        <ul className="flag-list">
          {flags.map((flag) => {
            const sev = sevOf(flag.severity);
            const active = activeFlagId === flag.id;
            return (
              <li
                key={flag.id}
                className={`flag-card ${active ? 'flag-card-active' : ''}`}
                onMouseEnter={() => onHoverFlag(flag.id)}
                onMouseLeave={() => onHoverFlag(null)}
              >
                <div className="flag-head">
                  <span className={`sev-chip ${sev.className}`}>
                    <span aria-hidden="true">{sev.glyph}</span> {sev.label}
                  </span>
                  <span className="flag-category">{flag.category}</span>
                  <span className="flag-confidence">
                    {Math.round(flag.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="flag-explanation">{flag.explanation}</p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="report-foot muted">
        Screened at <strong>{result.strictness_profile}</strong> strictness. {' '}
        The tool advises; you decide what ships.
      </p>
    </div>
  );
}
