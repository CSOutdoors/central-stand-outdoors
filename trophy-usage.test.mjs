import assert from 'node:assert/strict';
import { formatGenerationUsage } from '../trophy-usage.js';

const usage = {
  inputTokens: 1200,
  outputTokens: 1000,
  estimatedCostUsd: 0.039,
  rateCardCheckedOn: '2026-11-24'
};
const formatted = formatGenerationUsage(usage);
assert.match(formatted, /Estimated OpenAI model cost: \$0\.039/);
assert.match(formatted, /1,200 input tokens/);
assert.match(formatted, /1,000 output tokens/);
assert.match(formatted, /Standard rates checked 2026-11-24/);
assert.match(formatGenerationUsage(null), /usage details were unavailable/i);
assert.match(formatGenerationUsage({ estimatedCostUsd: 'not-a-number' }), /usage details were unavailable/i);
console.log(JSON.stringify({
  passed: [
    'Formats provider-reported token usage and a standard-rate cost estimate',
    'Discloses the date of the rate card and excludes hosting/tax from the estimate',
    'Does not invent a cost when provider usage is absent or malformed'
  ],
  total: 3
}, null, 2));
