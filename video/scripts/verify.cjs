// Verify the published artifact bytes and source timing without rendering or an API call.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const file of manifest.files) {
 const target = path.resolve(root, file.path);
 assert.ok(target.startsWith(root + path.sep), 'Invalid manifest path');
 const data = fs.readFileSync(target);
 assert.equal(data.length, file.bytes, 'File size: ' + file.path);
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, 'Checksum: ' + file.path);
}
const captions = JSON.parse(fs.readFileSync(path.join(root, 'src/captions.json'), 'utf8'));
const shots = JSON.parse(fs.readFileSync(path.join(root, 'src/narration.json'), 'utf8'));
assert.equal(captions.length, 33);
assert.deepEqual(captions.map(x => x.text), shots.flatMap(x => x.lines));
const srt = fs.readFileSync(path.join(root, 'exports/映销-90秒-中文字幕.srt'), 'utf8');
assert.deepEqual(srt.trim().split(/\r?\n\s*\r?\n/).map(x => x.split(/\r?\n/)[2]), captions.map(x => x.text));
for (const caption of captions) {
 assert.ok(caption.from >= 0 && caption.from + caption.duration <= manifest.composition.frames);
 assert.ok(fs.statSync(path.join(root, 'public', caption.src)).size > 44);
}
console.log(`Verified ${manifest.files.length} files, two unchanged videos, 33 narration WAVs and matching subtitles; no render or API call.`);
