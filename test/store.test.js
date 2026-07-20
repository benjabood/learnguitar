import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createStore } from '../src/lib/store.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-store-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createStore', () => {
  test('initializes default state with a startDate when no file exists', () => {
    const store = createStore(tmpDir);
    const state = store.getState();
    expect(state.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.completions).toEqual({});
    expect(state.achievements).toEqual({});
    expect(state.wasBehind3).toBe(false);
  });

  test('persists updates to disk and reloads them', () => {
    const store = createStore(tmpDir);
    store.update(s => ({ ...s, completions: { ...s.completions, 1: '2026-07-01' } }));

    const reloaded = createStore(tmpDir);
    expect(reloaded.getState().completions).toEqual({ 1: '2026-07-01' });
  });

  test('update returns the new state and does not mutate the previous snapshot', () => {
    const store = createStore(tmpDir);
    const before = store.getState();
    const after = store.update(s => ({ ...s, wasBehind3: true }));
    expect(after.wasBehind3).toBe(true);
    expect(before.wasBehind3).toBe(false);
  });

  test('getState returns a defensive copy', () => {
    const store = createStore(tmpDir);
    const a = store.getState();
    a.completions[99] = 'tampered';
    expect(store.getState().completions[99]).toBeUndefined();
  });

  test('recovers from a corrupt state file', () => {
    fs.writeFileSync(path.join(tmpDir, 'state.json'), '{not json!!!', 'utf8');
    const store = createStore(tmpDir);
    expect(store.getState().completions).toEqual({});
    // corrupt file should have been backed up, not silently destroyed
    const backups = fs.readdirSync(tmpDir).filter(f => f.startsWith('state.json.corrupt'));
    expect(backups.length).toBe(1);
  });

  test('resets an invalid startDate to today instead of crashing later', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'state.json'),
      JSON.stringify({ startDate: 'not-a-date', completions: { 1: '2026-07-01' } }),
      'utf8'
    );
    const store = createStore(tmpDir);
    expect(store.getState().startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(store.getState().completions).toEqual({ 1: '2026-07-01' });
  });

  test('update rejects non-object results', () => {
    const store = createStore(tmpDir);
    expect(() => store.update(() => null)).toThrow();
    expect(() => store.update(() => 'nope')).toThrow();
  });
});
