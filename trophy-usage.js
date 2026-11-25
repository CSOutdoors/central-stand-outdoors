export function formatGenerationUsage(usage) {
  if (!usage || typeof usage.estimatedCostUsd !== 'number' || !Number.isFinite(usage.estimatedCostUsd) || usage.estimatedCostUsd < 0) {
    return 'The image was returned, but provider usage details were unavailable, so CSO cannot estimate this generation cost.';
  }
  const cost = usage.estimatedCostUsd;
  const rounded = cost < 0.01
    ? Math.round((cost + Number.EPSILON) * 10000) / 10000
    : Math.round((cost + Number.EPSILON) * 1000) / 1000;
  const formattedCost = cost < 0.01 ? `$${rounded.toFixed(4)}` : `$${rounded.toFixed(3)}`;
  const input = Number.isFinite(Number(usage.inputTokens)) ? Number(usage.inputTokens).toLocaleString() : 'unknown';
  const output = Number.isFinite(Number(usage.outputTokens)) ? Number(usage.outputTokens).toLocaleString() : 'unknown';
  const checked = String(usage.rateCardCheckedOn || 'date unavailable');
  return `Estimated OpenAI model cost: ${formattedCost} · ${input} input tokens · ${output} output tokens · Standard rates checked ${checked}. Estimate only; excludes hosting and any applicable taxes.`;
}
