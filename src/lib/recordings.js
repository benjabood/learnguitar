import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// day-NN-<epoch ms>-<random hex>.<ext>; the random suffix prevents
// same-millisecond uploads from overwriting each other.
const FILENAME_RE = /^day-(\d{2})-(\d+)(?:-[a-f0-9]{8})?\.(webm|ogg|m4a|mp3|wav)$/;

const EXT_BY_MIME = Object.freeze({
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav'
});

const MIME_BY_EXT = Object.freeze({
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav'
});

export function isValidRecordingFilename(name) {
  return FILENAME_RE.test(String(name || ''));
}

export function extForMime(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[base] || null;
}

export function mimeForFilename(name) {
  const m = FILENAME_RE.exec(String(name || ''));
  return m ? MIME_BY_EXT[m[3]] : null;
}

export function saveRecording(dir, day, buffer, mime) {
  const ext = extForMime(mime);
  if (!ext) {
    throw new Error(`Unsupported audio type: ${mime}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  const suffix = crypto.randomBytes(4).toString('hex');
  const filename = `day-${String(day).padStart(2, '0')}-${Date.now()}-${suffix}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer, { flag: 'wx' });
  return filename;
}

export function listRecordings(dir, day = null) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .map(f => FILENAME_RE.exec(f))
    .filter(Boolean)
    .filter(m => day === null || Number(m[1]) === Number(day))
    .map(m => {
      const filename = m[0];
      const stat = fs.statSync(path.join(dir, filename));
      return {
        filename,
        day: Number(m[1]),
        createdAt: Number(m[2]),
        size: stat.size
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function countRecordings(dir) {
  return listRecordings(dir).length;
}

export function deleteRecording(dir, filename) {
  if (!isValidRecordingFilename(filename)) {
    throw new Error(`Invalid recording filename: ${filename}`);
  }
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}
