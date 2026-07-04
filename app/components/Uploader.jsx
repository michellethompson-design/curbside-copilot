import React, { useRef, useState } from 'react';

const ACCEPT = '.png,.jpg,.jpeg,.tif,.tiff,.webp,.svg,.pdf,image/*,application/pdf';

function humanMB(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

// Drag-and-drop and click-to-browse upload, single or batch.
export default function Uploader({ config, disabled, onFiles }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    onFiles(files.slice(0, config.maxBatchFiles));
  }

  return (
    <section
      className={`dropzone ${dragOver ? 'dropzone-over' : ''} ${disabled ? 'dropzone-disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
      }}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="dropzone-inner">
        <div className="dropzone-icon" aria-hidden="true">⇪</div>
        <p className="dropzone-title">Drop assets here, or click to browse</p>
        <p className="dropzone-sub">
          PNG, JPEG, TIFF, WEBP, SVG, PDF · up to {humanMB(config.maxFileSizeBytes)} MB each ·
          up to {config.maxBatchFiles} per batch
        </p>
      </div>
    </section>
  );
}
