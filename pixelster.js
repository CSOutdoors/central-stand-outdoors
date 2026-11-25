/**
 * ARCHIVED — not used by the CSO production bundle or active generation path.
 * Anonymous prototype adapter for FreeAPI PixelSter image-to-image.
 * The provider documents POST /api/pti, no API key, and an imageUrl result.
 * This is a third-party prototype dependency, not a production SLA.
 */
export async function generatePixelSterImage(imageDataUrl, prompt, fetchImpl = fetch) {
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl)) {
    throw new Error('The selected photo could not be prepared as a supported image.');
  }
  const response = await fetchImpl('https://freeapi.pro/api/pti', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ratio: '3:2', imageBase64: imageDataUrl })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.imageUrl) {
    throw new Error(data.error || `Free AI service could not complete the image (${response.status || 'network error'}).`);
  }
  const imageResponse = await fetchImpl(data.imageUrl);
  if (!imageResponse.ok) throw new Error('The free AI image was created, but your browser could not retrieve it.');
  const imageBlob = await imageResponse.blob();
  if (!imageBlob.type.startsWith('image/')) throw new Error('The AI provider returned an unsupported result format.');
  const bytes = new Uint8Array(await imageBlob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${imageBlob.type};base64,${btoa(binary)}`;
}
