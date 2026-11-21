import assert from 'node:assert/strict';
import {
  MAX_REFERENCE_PHOTOS,
  MAX_SOURCE_FILE_BYTES,
  validatePhotoFile,
  validateReferenceSelection,
  formatFileSize
} from '../trophy-intake.js';

const jpeg = { name: 'harvest.jpg', type: 'image/jpeg', size: 2_000_000, lastModified: 1 };
const heic = { name: 'rack.heic', type: 'image/heic', size: 3_000_000, lastModified: 2 };
const extensionOnly = { name: 'camera.webp', type: '', size: 800_000, lastModified: 3 };

assert.equal(validatePhotoFile(jpeg).ok, true);
assert.equal(validatePhotoFile(heic).ok, true);
assert.equal(validatePhotoFile(extensionOnly).ok, true);
assert.equal(validatePhotoFile({ name: 'notes.pdf', type: 'application/pdf', size: 2000 }).ok, false);
assert.equal(validatePhotoFile({ name: 'spoofed.jpg', type: 'application/pdf', size: 2000 }).ok, false);
assert.equal(validatePhotoFile({ name: 'empty.jpg', type: 'image/jpeg', size: 0 }).ok, false);
assert.equal(validatePhotoFile({ name: 'huge.jpg', type: 'image/jpeg', size: MAX_SOURCE_FILE_BYTES + 1 }).ok, false);

const selection = validateReferenceSelection([jpeg, heic, extensionOnly, { name: 'fourth.jpg', type: 'image/jpeg', size: 1000 }]);
assert.equal(selection.accepted.length, MAX_REFERENCE_PHOTOS);
assert.equal(selection.remaining, 0);
assert.ok(selection.errors.some(error => error.includes('no more than 3')));

const remaining = validateReferenceSelection([extensionOnly], 2);
assert.equal(remaining.accepted.length, 1);
assert.equal(remaining.remaining, 0);
const full = validateReferenceSelection([jpeg], 3);
assert.equal(full.accepted.length, 0);
assert.equal(full.remaining, 0);
assert.match(formatFileSize(1024), /1 KB/);
assert.match(formatFileSize(1_572_864), /1.5 MB/);

console.log(JSON.stringify({
  passed: [
    'Accepts supported iPhone image MIME types and recognized extensions including HEIC',
    'Rejects non-image, empty, and oversized source files',
    'Caps additional reference angles at three',
    'Respects the remaining reference-photo slots',
    'Formats photo sizes for the mobile intake list'
  ],
  total: 5
}, null, 2));
