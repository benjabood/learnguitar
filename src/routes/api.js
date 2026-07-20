import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { computeProgress, computeStreak, localDateStr, dateForDay, TOTAL_DAYS } from '../lib/schedule.js';
import { ACHIEVEMENTS, evaluateAchievements } from '../lib/achievements.js';
import {
  saveRecording,
  listRecordings,
  countRecordings,
  deleteRecording,
  isValidRecordingFilename,
  mimeForFilename,
  extForMime
} from '../lib/recordings.js';

const MAX_RECORDING_SIZE = '25mb';

const ok = data => ({ success: true, data, error: null });
const fail = error => ({ success: false, data: null, error });

export function createApiRouter({ store, lessons, recordingsDir, now = () => localDateStr() }) {
  const router = express.Router();
  const lessonsByDay = new Map(lessons.map(l => [l.day, l]));

  function parseDay(param) {
    const day = Number(param);
    return Number.isInteger(day) && day >= 1 && day <= TOTAL_DAYS ? day : null;
  }

  function achievementList(state) {
    return ACHIEVEMENTS.map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description,
      unlockedAt: state.achievements[a.id] || null
    }));
  }

  function buildOverview() {
    const state = store.getState();
    const today = now();
    const progress = computeProgress(state, today);
    const streak = computeStreak(state.completions, today);
    const recordingDays = {};
    for (const r of listRecordings(recordingsDir)) {
      recordingDays[r.day] = (recordingDays[r.day] || 0) + 1;
    }
    return {
      startDate: state.startDate,
      today,
      totalDays: TOTAL_DAYS,
      progress,
      streak,
      completions: state.completions,
      achievements: achievementList(state),
      recordingDays,
      lessons: lessons.map(l => ({
        day: l.day,
        week: l.week,
        title: l.title,
        isReview: l.isReview,
        focus: l.focus,
        date: dateForDay(state.startDate, l.day)
      }))
    };
  }

  /**
   * Re-evaluate achievements against current state and persist newly
   * earned ones. Returns the ids earned by this call.
   */
  function evaluateAndStore() {
    const today = now();
    let newIds = [];
    store.update(s => {
      const progress = computeProgress(s, today);
      const wasBehind3 = s.wasBehind3 || progress.behind >= 3;
      const ctx = {
        completedCount: progress.completedCount,
        streak: computeStreak(s.completions, today),
        ahead: progress.ahead,
        behind: progress.behind,
        wasBehind3,
        recordingsCount: countRecordings(recordingsDir),
        completions: s.completions
      };
      newIds = evaluateAchievements(ctx, Object.keys(s.achievements));
      const achievements = { ...s.achievements };
      for (const id of newIds) {
        achievements[id] = today;
      }
      return { ...s, wasBehind3, achievements };
    });
    return newIds;
  }

  function newAchievementDetails(ids) {
    return ACHIEVEMENTS.filter(a => ids.includes(a.id)).map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      description: a.description
    }));
  }

  router.get('/overview', (req, res) => {
    res.json(ok(buildOverview()));
  });

  router.get('/lessons/:day', (req, res) => {
    const day = parseDay(req.params.day);
    if (day === null) {
      return res.status(400).json(fail(`day must be an integer 1-${TOTAL_DAYS}`));
    }
    const lesson = lessonsByDay.get(day);
    if (!lesson) {
      return res.status(404).json(fail(`No lesson found for day ${day}`));
    }
    const state = store.getState();
    res.json(
      ok({
        ...lesson,
        date: dateForDay(state.startDate, day),
        completedOn: state.completions[day] || null,
        recordings: listRecordings(recordingsDir, day)
      })
    );
  });

  router.post('/lessons/:day/complete', (req, res) => {
    const day = parseDay(req.params.day);
    if (day === null) {
      return res.status(400).json(fail(`day must be an integer 1-${TOTAL_DAYS}`));
    }
    const today = now();
    const already = Boolean(store.getState().completions[day]);
    if (!already) {
      store.update(s => ({ ...s, completions: { ...s.completions, [day]: today } }));
    }
    const newIds = already ? [] : evaluateAndStore();
    res.json(
      ok({
        day,
        alreadyCompleted: already,
        newAchievements: newAchievementDetails(newIds),
        overview: buildOverview()
      })
    );
  });

  router.delete('/lessons/:day/complete', (req, res) => {
    const day = parseDay(req.params.day);
    if (day === null) {
      return res.status(400).json(fail(`day must be an integer 1-${TOTAL_DAYS}`));
    }
    store.update(s => {
      const completions = { ...s.completions };
      delete completions[day];
      return { ...s, completions };
    });
    res.json(ok({ day, overview: buildOverview() }));
  });

  router.post(
    '/lessons/:day/recordings',
    express.raw({ type: 'audio/*', limit: MAX_RECORDING_SIZE }),
    (req, res) => {
      const day = parseDay(req.params.day);
      if (day === null) {
        return res.status(400).json(fail(`day must be an integer 1-${TOTAL_DAYS}`));
      }
      const mime = req.headers['content-type'];
      if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !extForMime(mime)) {
        return res.status(400).json(fail('Request body must be non-empty audio/* data'));
      }
      const filename = saveRecording(recordingsDir, day, req.body, mime);
      const newIds = evaluateAndStore();
      res.status(201).json(
        ok({
          filename,
          day,
          newAchievements: newAchievementDetails(newIds),
          recordings: listRecordings(recordingsDir, day)
        })
      );
    }
  );

  router.get('/lessons/:day/recordings', (req, res) => {
    const day = parseDay(req.params.day);
    if (day === null) {
      return res.status(400).json(fail(`day must be an integer 1-${TOTAL_DAYS}`));
    }
    res.json(ok(listRecordings(recordingsDir, day)));
  });

  router.get('/recordings/:filename', (req, res) => {
    const { filename } = req.params;
    if (!isValidRecordingFilename(filename)) {
      return res.status(400).json(fail('Invalid recording filename'));
    }
    const filePath = path.join(recordingsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(fail('Recording not found'));
    }
    res.setHeader('Content-Type', mimeForFilename(filename));
    res.sendFile(filename, { root: recordingsDir });
  });

  router.delete('/recordings/:filename', (req, res) => {
    const { filename } = req.params;
    if (!isValidRecordingFilename(filename)) {
      return res.status(400).json(fail('Invalid recording filename'));
    }
    const deleted = deleteRecording(recordingsDir, filename);
    if (!deleted) {
      return res.status(404).json(fail('Recording not found'));
    }
    res.json(ok({ deleted: filename }));
  });

  return router;
}
