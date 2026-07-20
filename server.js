import path from 'node:path';
import { createApp } from './src/app.js';

const rootDir = import.meta.dirname;
const port = Number(process.env.PORT) || 4321;

let app;
try {
  app = createApp({
    dataDir: path.join(rootDir, 'data'),
    lessonsDir: path.join(rootDir, 'data', 'lessons'),
    publicDir: path.join(rootDir, 'public')
  });
} catch (err) {
  console.error('Failed to start:', err.message);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`🎸 Guitar practice site running at http://localhost:${port}`);
});
