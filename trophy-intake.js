export const MAX_REFERENCE_PHOTOS = 3;
export const MAX_SOURCE_FILE_BYTES = 30 * 1024 * 1024;
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

export function validatePhotoFile(file) {
  if (!file || typeof file !== 'object') return { ok: false, error: 'Choose an image file to continue.' };
  const name = String(file.name || '');
  const type = String(file.type || '').toLowerCase();
  const size = Number(file.size);
  const knownImageExtension = IMAGE_EXTENSION.test(name);
  const hasImageType = type.startsWith('image/');
  const typeAllowsExtensionFallback = !type || type === 'application/octet-stream';
  if (!hasImageType && !(typeAllowsExtensionFallback && knownImageExtension)) {
    return { ok: false, error: 'Choose a photo in JPG, PNG, WebP, HEIC, or another supported image format.' };
  }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'That photo is empty or could not be read. Choose another image.' };
  if (size > MAX_SOURCE_FILE_BYTES) return { ok: false, error: 'That photo is larger than 30 MB. Choose a smaller copy.' };
  return { ok: true, error: '', size };
}

export function validateReferenceSelection(files, existingCount = 0) {
  const accepted = [];
  const errors = [];
  let remaining = Math.max(0, MAX_REFERENCE_PHOTOS - Math.max(0, Number(existingCount) || 0));
  for (const file of Array.from(files || [])) {
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      errors.push(`${String(file?.name || 'Photo')}: ${validation.error}`);
      continue;
    }
    if (remaining <= 0) {
      errors.push(`You can add no more than ${MAX_REFERENCE_PHOTOS} reference photos.`);
      continue;
    }
    accepted.push(file);
    remaining -= 1;
  }
  return { accepted, errors, remaining };
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
