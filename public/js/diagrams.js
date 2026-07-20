/**
 * Renders lesson diagrams (chord charts, strumming patterns, tabs) as SVG.
 * Each function returns an SVG string; renderDiagram dispatches on type.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Chord chart: frets[] is low E → high e; -1 muted, 0 open. */
function chordSvg(d) {
  const width = 170;
  const height = 210;
  const gridX = 30;
  const gridY = 55;
  const gridW = 110;
  const gridH = 120;
  const stringGap = gridW / 5;
  const fretGap = gridH / 4;

  const fretted = d.frets.filter(f => f > 0);
  const maxFret = fretted.length ? Math.max(...fretted) : 1;
  const minFret = fretted.length ? Math.min(...fretted) : 1;
  const baseFret = maxFret <= 4 ? 1 : minFret;

  let s = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(d.name)} chord chart">`;
  s += `<text x="${width / 2}" y="24" text-anchor="middle" font-size="19" font-weight="bold" fill="#f0e9df">${esc(d.name)}</text>`;

  // nut or base fret label
  if (baseFret === 1) {
    s += `<rect x="${gridX - 1}" y="${gridY - 4}" width="${gridW + 2}" height="5" fill="#f0e9df" rx="1"/>`;
  } else {
    s += `<text x="${gridX - 8}" y="${gridY + fretGap / 2 + 4}" text-anchor="end" font-size="11" fill="#a89a88">${baseFret}fr</text>`;
  }

  // grid
  for (let i = 0; i <= 4; i++) {
    s += `<line x1="${gridX}" y1="${gridY + i * fretGap}" x2="${gridX + gridW}" y2="${gridY + i * fretGap}" stroke="#5c5044" stroke-width="1.4"/>`;
  }
  for (let i = 0; i <= 5; i++) {
    s += `<line x1="${gridX + i * stringGap}" y1="${gridY}" x2="${gridX + i * stringGap}" y2="${gridY + gridH}" stroke="#5c5044" stroke-width="1.4"/>`;
  }

  // markers: frets array index 0 = low E = leftmost string
  d.frets.forEach((fret, i) => {
    const x = gridX + i * stringGap;
    if (fret === -1) {
      s += `<text x="${x}" y="${gridY - 10}" text-anchor="middle" font-size="13" fill="#e07a5f" font-weight="bold">✕</text>`;
    } else if (fret === 0) {
      s += `<circle cx="${x}" cy="${gridY - 14}" r="5" fill="none" stroke="#7bc47f" stroke-width="1.8"/>`;
    } else {
      const row = fret - baseFret; // 0-based row in the visible window
      const y = gridY + row * fretGap + fretGap / 2;
      s += `<circle cx="${x}" cy="${y}" r="9" fill="#e8a33d"/>`;
      const finger = Array.isArray(d.fingers) ? d.fingers[i] : 0;
      if (finger > 0) {
        s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#1d160c">${finger}</text>`;
      }
    }
  });

  // string letters
  const letters = ['E', 'A', 'D', 'G', 'B', 'e'];
  letters.forEach((l, i) => {
    s += `<text x="${gridX + i * stringGap}" y="${gridY + gridH + 18}" text-anchor="middle" font-size="10" fill="#a89a88">${l}</text>`;
  });

  s += '</svg>';
  return s;
}

/** Strumming pattern: 8 eighth-note slots of 'D', 'U', or ''. */
function strumSvg(d) {
  const slotW = 34;
  const width = slotW * 8 + 20;
  const height = 120;
  const baseY = 78;
  const counts = ['1', '&', '2', '&', '3', '&', '4', '&'];

  let s = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Strumming pattern ${esc(d.name)}">`;
  s += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#f0e9df">${esc(d.name)}</text>`;

  d.beats.forEach((b, i) => {
    const x = 10 + i * slotW + slotW / 2;
    const onBeat = i % 2 === 0;
    s += `<text x="${x}" y="${baseY + 26}" text-anchor="middle" font-size="${onBeat ? 13 : 11}" fill="${onBeat ? '#f0e9df' : '#a89a88'}" font-weight="${onBeat ? 'bold' : 'normal'}">${counts[i]}</text>`;
    if (b === 'D') {
      s += `<line x1="${x}" y1="${baseY - 38}" x2="${x}" y2="${baseY - 6}" stroke="#e8a33d" stroke-width="3"/>`;
      s += `<path d="M ${x - 6} ${baseY - 14} L ${x} ${baseY - 2} L ${x + 6} ${baseY - 14} Z" fill="#e8a33d"/>`;
    } else if (b === 'U') {
      s += `<line x1="${x}" y1="${baseY - 34}" x2="${x}" y2="${baseY - 2}" stroke="#7aa5d2" stroke-width="3"/>`;
      s += `<path d="M ${x - 6} ${baseY - 26} L ${x} ${baseY - 38} L ${x + 6} ${baseY - 26} Z" fill="#7aa5d2"/>`;
    } else {
      s += `<text x="${x}" y="${baseY - 14}" text-anchor="middle" font-size="12" fill="#5c5044">·</text>`;
    }
  });

  s += '</svg>';
  return s;
}

/** Tab: notes in sequence; string 1 = high e (top line). */
function tabSvg(d) {
  const noteGap = 30;
  const leftPad = 40;
  const width = Math.max(220, leftPad + d.notes.length * noteGap + 20);
  const lineGap = 16;
  const topY = 42;
  const names = ['e', 'B', 'G', 'D', 'A', 'E'];

  let s = `<svg xmlns="${SVG_NS}" width="${width}" height="${topY + lineGap * 5 + 30}" viewBox="0 0 ${width} ${topY + lineGap * 5 + 30}" role="img" aria-label="Tab ${esc(d.name)}">`;
  s += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#f0e9df">${esc(d.name)}</text>`;

  for (let i = 0; i < 6; i++) {
    const y = topY + i * lineGap;
    s += `<text x="${leftPad - 14}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#a89a88">${names[i]}</text>`;
    s += `<line x1="${leftPad}" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#5c5044" stroke-width="1"/>`;
  }

  d.notes.forEach((n, i) => {
    const x = leftPad + 14 + i * noteGap;
    const y = topY + (n.string - 1) * lineGap;
    s += `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" rx="4" fill="#221d17"/>`;
    s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="bold" fill="#e8a33d">${n.fret}</text>`;
  });

  s += '</svg>';
  return s;
}

export function renderDiagram(d) {
  try {
    if (d.type === 'chord') return chordSvg(d);
    if (d.type === 'strum') return strumSvg(d);
    if (d.type === 'tab') return tabSvg(d);
  } catch (err) {
    console.error('Failed to render diagram', d, err);
  }
  return '';
}
