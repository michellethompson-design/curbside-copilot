import React from 'react';
import { sevOf } from '../severity.js';

// Renders the analyzed raster with translucent approximate regions drawn from
// normalized 0–1000 coordinates. Regions are explicitly labeled approximate —
// vision coordinates are not pixel-tight (PRD Section 7).
export default function ImageViewer({ result, activeFlagId, onHoverFlag }) {
  return (
    <div className="viewer">
      <div className="viewer-frame">
        {result.image_data_url ? (
          <img className="viewer-img" src={result.image_data_url} alt={result.filename} />
        ) : (
          <div className="viewer-noimg">No preview available</div>
        )}

        <div className="overlay" aria-hidden="true">
          {(result.flags || []).map((flag) => {
            const r = flag.region;
            const style = {
              left: `${(r.x_min / 1000) * 100}%`,
              top: `${(r.y_min / 1000) * 100}%`,
              width: `${((r.x_max - r.x_min) / 1000) * 100}%`,
              height: `${((r.y_max - r.y_min) / 1000) * 100}%`,
            };
            const active = activeFlagId === flag.id;
            return (
              <div
                key={flag.id}
                className={`region ${sevOf(flag.severity).className} ${active ? 'region-active' : ''}`}
                style={style}
                onMouseEnter={() => onHoverFlag(flag.id)}
                onMouseLeave={() => onHoverFlag(null)}
              >
                <span className="region-tag">
                  {flag.category} · {sevOf(flag.severity).label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {result.flags?.length > 0 && (
        <p className="viewer-caption">
          Regions are <strong>approximate</strong>. They point you to the area — the written report
          carries the detail.
        </p>
      )}
    </div>
  );
}
