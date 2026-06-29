// Load METEOR_SETTINGS from SETTINGS_FILE inside the Node process.
// Avoids Linux MAX_ARG_STRLEN (128 KiB) limit on a single env var when
// passing large settings JSON (e.g. Cyrillic labels) via execve.
const fs = require('fs');
const path = require('path');

if (process.env.METEOR_SETTINGS) {
  return;
}

const settingsFile = process.env.SETTINGS_FILE;
if (!settingsFile) {
  return;
}

const base = process.env.APP_SOURCE_FOLDER || process.cwd();
const abs = path.isAbsolute(settingsFile)
  ? settingsFile
  : path.join(base, settingsFile);

process.env.METEOR_SETTINGS = fs.readFileSync(abs, 'utf8');
