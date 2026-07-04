import React, { useState } from 'react';
import ImageViewer from './ImageViewer.jsx';
import ReportPanel from './ReportPanel.jsx';
import { sevOf, RECOMMENDATION } from '../severity.js';

function BatchRailItem({ item, selected, onSelect }) {
  const rec = item.error
    ? { className: 'rec-hold', label: 'Error' }
    : RECOMMENDATION[item.summary?.overall_recommendation] || RECOMMENDATION.clear;
  const count = item.summary?.flag_count ?? 0;
  return (
    <button
      className={`rail-item ${selected ? 'rail-item-selected' : ''}`}
      onClick={() => onSelect(item.image_id)}
    >
      {item.image_data_url && (
        <img className="rail-thumb" src={item.image_data_url} alt="" aria-hidden="true" />
      )}
      <span className="rail-meta">
        <span className="rail-name" title={item.filename}>{item.filename}</span>
        <span className={`rail-status ${rec.className}`}>
          {item.error ? 'Error' : count === 0 ? 'Clear' : `${count} flag${count === 1 ? '' : 's'}`}
        </span>
      </span>
    </button>
  );
}

function ResultDetail({ result }) {
  const [activeFlagId, setActiveFlagId] = useState(null);
  return (
    <div className="detail">
      <div className="detail-head">
        <h2 className="detail-name">{result.filename}</h2>
      </div>
      <div className="detail-body">
        <ImageViewer
          result={result}
          activeFlagId={activeFlagId}
          onHoverFlag={setActiveFlagId}
        />
        <ReportPanel
          result={result}
          activeFlagId={activeFlagId}
          onHoverFlag={setActiveFlagId}
        />
      </div>
    </div>
  );
}

export default function ResultsView({ items, selectedId, onSelect, status }) {
  if (items.length === 0) {
    if (status === 'running') return null;
    return null;
  }
  const selected = items.find((i) => i.image_id === selectedId) || items[0];
  const isBatch = items.length > 1;

  return (
    <section className={`results ${isBatch ? 'has-rail' : ''}`} aria-label="Screening results">
      {isBatch && (
        <div className="rail" role="list">
          {items.map((it) => (
            <BatchRailItem
              key={it.image_id}
              item={it}
              selected={it.image_id === selected.image_id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      <ResultDetail key={selected.image_id} result={selected} />
    </section>
  );
}
