import React, { useState } from 'react';

// Clear, visible statement of where the image goes and what is stored (PRD 6.5).
export default function PrivacyNote({ config }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="privacy">
      <button className="privacy-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> Where does my asset go?
      </button>
      {open && (
        <div className="privacy-body">
          <ul>
            <li>
              When you screen an asset, its image is sent to{' '}
              <strong>Anthropic’s Claude API</strong> for analysis and nowhere else.
            </li>
            <li>
              {config.demoMode ? (
                <>This instance is in <strong>demo mode</strong>: no image leaves the server and no
                API is called.</>
              ) : (
                <>
                  With <strong>bring-your-own-key</strong>, your key is used only for your request and
                  the image goes only to <strong>your own</strong> Anthropic account.
                </>
              )}
            </li>
            <li>
              <strong>No image is retained.</strong> Files are rasterized in memory, sent for
              analysis, and discarded when your request finishes. Nothing is written to disk or a
              database.
            </li>
            <li>Your API key is held in your browser session only and is never stored by the app.</li>
            <li>
              Don’t screen assets you are not permitted to send to a third-party API.
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
