import assert from 'node:assert/strict';
import { saveTrophy, deleteTrophy } from '../trophy-gallery.js';

await assert.rejects(() => saveTrophy(null), /finished trophy image is required/);
await assert.rejects(() => saveTrophy({ imageBlob: new Blob([]) }), /finished trophy image is required/);
await assert.rejects(() => deleteTrophy(''), /trophy ID is required/);
console.log(JSON.stringify({ passed: [
  'Refuses to save a missing trophy record',
  'Refuses to save an empty generated image',
  'Refuses a delete request without a trophy ID'
], total: 3 }, null, 2));
