'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fetchConfig, analyze } from './api-client.js';
import Uploader from './components/Uploader.jsx';
import Controls from './components/Controls.jsx';
import ResultsView from './components/ResultsView.jsx';
import PrivacyNote from './components/PrivacyNote.jsx';

export default function Page() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);

  const [apiKey, setApiKey] = useState('');
  const [strictness, setStrictness] = useState('medium');

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Load the persisted key from session on mount (client only).
  useEffect(() => {
    setApiKey(sessionStorage.getItem('abcd_api_key') || '');
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((c) => {
        setConfig(c);
        setStrictness(c.defaultStrictness || 'medium');
      })
      .catch((e) => setConfigError(e.message));
  }, []);

  // Keep the key only for the session, never in localStorage.
  useEffect(() => {
    if (apiKey) sessionStorage.setItem('abcd_api_key', apiKey);
    else sessionStorage.removeItem('abcd_api_key');
  }, [apiKey]);

  const canRun = config && (config.demoMode || config.hasServerKey || apiKey.trim());

  async function run(files) {
    if (!files || files.length === 0) return;
    setStatus('running');
    setError(null);
    setItems([]);
    setSelectedId(null);
    setProgress({ done: 0, total: files.length });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await analyze(
        files,
        { apiKey: apiKey.trim(), strictness },
        {
          onStart: (m) => setProgress({ done: 0, total: m.totalFiles }),
          onResult: (m) => {
            setItems((prev) => [...prev, m]);
            setSelectedId((cur) => cur ?? m.image_id);
            setProgress((p) => ({ ...p, done: p.done + 1 }));
          },
          onFatal: (m) => {
            setError(m.message);
            setStatus('done');
          },
          onDone: () => setStatus('done'),
        },
        controller.signal
      );
      setStatus('done');
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      setStatus('done');
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setStatus('done');
  }

  if (configError) {
    return (
      <div className="app">
        <div className="fatal">Could not reach the server: {configError}</div>
      </div>
    );
  }
  if (!config) {
    return (
      <div className="app">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  const brand = config.brand;

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◔</span>
          <div>
            <h1>{brand.name}</h1>
            <p className="tagline">{brand.tagline}</p>
          </div>
        </div>
        {config.demoMode && (
          <span className="badge badge-demo" title="No Claude API is called; canned results.">
            Demo mode
          </span>
        )}
      </header>

      <Controls
        config={config}
        apiKey={apiKey}
        setApiKey={setApiKey}
        strictness={strictness}
        setStrictness={setStrictness}
      />

      <Uploader config={config} disabled={status === 'running' || !canRun} onFiles={run} />

      {!canRun && (
        <p className="hint hint-warn">Add your Claude API key above to start screening.</p>
      )}

      {status === 'running' && (
        <div className="progress" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Screening {progress.done} of {progress.total}…
          <button className="link-btn" onClick={cancel}>Cancel</button>
        </div>
      )}

      {error && <div className="fatal" role="alert">{error}</div>}

      <ResultsView items={items} selectedId={selectedId} onSelect={setSelectedId} status={status} />

      <PrivacyNote config={config} />

      <footer className="footer">
        <span>{brand.name} · open source (MIT) · your assets are never retained</span>
      </footer>
    </div>
  );
}
