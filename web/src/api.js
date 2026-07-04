// Frontend API client. Reads the NDJSON stream from /api/analyze and invokes
// callbacks as each per-image result arrives, so batch results appear live.

export async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Could not load app config');
  return res.json();
}

// files: FileList | File[]; opts: { apiKey, strictness }
// handlers: { onStart, onResult, onFatal, onDone }
export async function analyze(files, opts, handlers, signal) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  form.append('strictness', opts.strictness || 'medium');

  const headers = {};
  if (opts.apiKey) headers['x-api-key'] = opts.apiKey;

  const res = await fetch('/api/analyze', { method: 'POST', body: form, headers, signal });

  // A non-streaming error (e.g. no key, no files) comes back as JSON.
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok && contentType.includes('application/json')) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error('No response stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // ignore partial/garbled line defensively
    }
    if (msg.type === 'start') handlers.onStart?.(msg);
    else if (msg.type === 'result') handlers.onResult?.(msg);
    else if (msg.type === 'fatal') handlers.onFatal?.(msg);
    else if (msg.type === 'done') handlers.onDone?.(msg);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      dispatch(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
