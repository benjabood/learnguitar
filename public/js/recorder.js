/**
 * Thin MediaRecorder wrapper. Usage:
 *   const rec = createRecorder();
 *   await rec.start();
 *   const blob = await rec.stop(); // audio blob, mime in blob.type
 */
export function isRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function createRecorder() {
  let mediaRecorder = null;
  let stream = null;
  let chunks = [];

  return {
    get isRecording() {
      return mediaRecorder?.state === 'recording';
    },

    async start() {
      if (!isRecordingSupported()) {
        throw new Error('Recording is not supported in this browser.');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error('Microphone access was denied. Allow the mic to record your practice.');
      }
      chunks = [];
      const mime = pickMimeType();
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    },

    stop() {
      return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
          reject(new Error('Not recording.'));
          return;
        }
        mediaRecorder.onstop = () => {
          const type = (mediaRecorder.mimeType || 'audio/webm').split(';')[0];
          const blob = new Blob(chunks, { type });
          stream.getTracks().forEach(t => t.stop());
          stream = null;
          mediaRecorder = null;
          resolve(blob);
        };
        mediaRecorder.stop();
      });
    },

    cancel() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
      }
      stream?.getTracks().forEach(t => t.stop());
      stream = null;
      mediaRecorder = null;
      chunks = [];
    }
  };
}
