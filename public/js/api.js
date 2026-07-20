async function req(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error('Cannot reach the server. Is it still running?');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-json error page */
  }
  if (!res.ok || !body || body.success !== true) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body.data;
}

export const api = {
  overview: () => req('/api/overview'),
  lesson: day => req(`/api/lessons/${day}`),
  complete: day => req(`/api/lessons/${day}/complete`, { method: 'POST' }),
  uncomplete: day => req(`/api/lessons/${day}/complete`, { method: 'DELETE' }),
  uploadRecording: (day, blob) =>
    req(`/api/lessons/${day}/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob
    }),
  deleteRecording: filename => req(`/api/recordings/${filename}`, { method: 'DELETE' })
};
