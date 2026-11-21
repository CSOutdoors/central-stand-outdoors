import { generatePixelSterImage } from './engine/pixelster.js';
import { MAX_REFERENCE_PHOTOS, validatePhotoFile, validateReferenceSelection, formatFileSize } from './trophy-intake.js';
import { saveTrophy, listTrophies, deleteTrophy } from './trophy-gallery.js';

const $ = id => document.getElementById(id);
const photoInput = $('photo');
const cameraInput = $('cameraPhoto');
const referenceInput = $('references');
const sourceImage = $('sourceImage');
const uploadContent = $('uploadContent');
const drop = $('drop');
const preview = $('preview');
const createButton = $('create');
const statusBox = $('status');
const endpointKey = 'cso_trophy_engine_endpoint';
const providerKey = 'cso_trophy_engine_provider';
function currentProvider() {
  try { return localStorage.getItem(providerKey) || 'pixelster-free'; } catch { return 'pixelster-free'; }
}

let selectedStyle = 'Classic shoulder mount';
let primaryFile = null;
let primaryUrl = '';
let referenceFiles = [];
let referenceUrls = [];
let generatedDataUrl = '';

function currentEndpoint() {
  try { return localStorage.getItem(endpointKey) || ''; } catch { return ''; }
}
function showStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.add('show');
  statusBox.classList.toggle('error', error);
}
function hideStatus() {
  statusBox.textContent = '';
  statusBox.classList.remove('show', 'error');
}
function updateEngineState() {
  const provider = currentProvider();
  const connected = provider === 'pixelster-free' || Boolean(currentEndpoint());
  $('uploadConsentWrap').classList.toggle('hidden', !connected);
  $('privacyNotice').textContent = provider === 'pixelster-free'
    ? 'AI provider: FreeAPI PixelSter (Flux Kontext Dev), a third-party no-signup image-editing service. Your selected photo and prompt leave this iPhone only after consent and Create. The provider says it does not permanently store prompts or outputs; review its current privacy terms. Do not upload photos you do not have permission to share.'
    : connected
      ? 'Photo privacy: Nothing is uploaded until you check the consent box and tap Create. The configured service and its image provider will process your selected photos; review their current retention terms before continuing.'
      : 'Photo privacy: Your selected photos stay in this browser session. No AI service is connected, so no upload or generation occurs.';
  createButton.textContent = connected ? 'CREATE MY DIGITAL MOUNT' : 'PREVIEW MY TROPHY SETUP';
  $('endpointSaved').textContent = provider === 'pixelster-free' ? 'Free no-signup AI selected.' : connected ? 'Secure endpoint saved on this device.' : '';
}
function updateSummary() {
  $('sumStyle').textContent = selectedStyle.replace(' mount', '');
  $('sumBackground').textContent = $('background').value;
  $('sumName').textContent = $('name').value.trim() || 'Not named';
  $('sumYear').textContent = $('year').value.trim() || 'Not set';
  $('sumPhoto').textContent = primaryFile ? 'Ready' : 'Not added';
  $('sumReferences').textContent = String(referenceFiles.length);
  $('referenceCount').textContent = `${referenceFiles.length} of ${MAX_REFERENCE_PHOTOS} added`;
  $('clearPhotosBtn').classList.toggle('hidden', !primaryFile && !referenceFiles.length);
  $('addReferencesBtn').disabled = referenceFiles.length >= MAX_REFERENCE_PHOTOS;
  createButton.disabled = !primaryFile;
  if (!primaryFile) createButton.textContent = 'ADD A HARVEST PHOTO TO BEGIN';
  else createButton.textContent = (currentProvider() === 'pixelster-free' || currentEndpoint()) ? 'CREATE MY DIGITAL MOUNT' : 'PREVIEW MY TROPHY SETUP';
}
function renderPreview() {
  preview.replaceChildren();
  if (generatedDataUrl) {
    const image = document.createElement('img');
    image.src = generatedDataUrl;
    image.alt = 'AI-generated digital trophy artwork';
    preview.append(image);
    $('previewCaption').textContent = 'AI-generated artwork · Review antler details against your original photo.';
    return;
  }
  if (primaryUrl) {
    const image = document.createElement('img');
    image.src = primaryUrl;
    image.alt = 'Local preview of your original harvest photo';
    preview.append(image);
    $('previewCaption').textContent = 'Original harvest photo · Local preview only · No AI image has been generated.';
    return;
  }
  const placeholder = document.createElement('div');
  placeholder.className = 'preview-placeholder';
  const antler = document.createElement('div');
  antler.className = 'antler';
  antler.setAttribute('aria-hidden', 'true');
  antler.textContent = '♜';
  const title = document.createElement('strong');
  title.textContent = 'Your buck, beautifully remembered.';
  const detail = document.createElement('span');
  detail.textContent = 'Your selected photo will appear here.';
  placeholder.append(antler, title, detail);
  preview.append(placeholder);
  $('previewCaption').textContent = 'Local photo preview only · no image has been generated.';
}
function renderReferences() {
  const list = $('referenceList');
  for (const url of referenceUrls) URL.revokeObjectURL(url);
  referenceUrls = [];
  list.replaceChildren();
  referenceFiles.forEach((file, index) => {
    const row = document.createElement('div');
    row.className = 'reference-item';
    const thumb = document.createElement('img');
    const url = URL.createObjectURL(file);
    referenceUrls.push(url);
    thumb.src = url;
    thumb.alt = `Reference angle ${index + 1} thumbnail`;
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = file.name || `Reference photo ${index + 1}`;
    const size = document.createElement('small');
    size.textContent = formatFileSize(file.size);
    info.append(name, size);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-ref';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove reference photo ${index + 1}`);
    remove.addEventListener('click', () => {
      referenceFiles.splice(index, 1);
      renderReferences();
      updateSummary();
      showStatus('Reference photo removed.');
    });
    row.append(thumb, info, remove);
    list.append(row);
  });
}
function setPrimaryPhoto(file) {
  const validation = validatePhotoFile(file);
  if (!validation.ok) {
    showStatus(validation.error, true);
    return false;
  }
  if (primaryUrl) URL.revokeObjectURL(primaryUrl);
  primaryFile = file;
  primaryUrl = URL.createObjectURL(file);
  generatedDataUrl = '';
  $('resultActions').classList.add('hidden');
  sourceImage.src = primaryUrl;
  sourceImage.classList.remove('hidden');
  uploadContent.classList.add('hidden');
  drop.classList.add('has-image');
  $('photoMeta').textContent = `${file.name || 'Harvest photo'} · ${formatFileSize(file.size)}`;
  updateSummary();
  renderPreview();
  hideStatus();
  return true;
}
function handlePrimaryInput(input) {
  const file = input.files && input.files[0];
  if (file) setPrimaryPhoto(file);
  input.value = '';
}
function addReferencePhotos(files) {
  const selection = validateReferenceSelection(files, referenceFiles.length);
  const existing = new Set(referenceFiles.map(file => `${file.name}|${file.size}|${file.lastModified || 0}`));
  for (const file of selection.accepted) {
    const key = `${file.name}|${file.size}|${file.lastModified || 0}`;
    if (existing.has(key)) continue;
    referenceFiles.push(file);
    existing.add(key);
  }
  renderReferences();
  updateSummary();
  if (selection.errors.length) showStatus(selection.errors.join(' '), true);
  else if (selection.accepted.length) showStatus(`${selection.accepted.length} reference photo${selection.accepted.length === 1 ? '' : 's'} added. Photos remain local until you choose to create a mount.`);
}
function clearPhotos() {
  if (primaryUrl) URL.revokeObjectURL(primaryUrl);
  for (const url of referenceUrls) URL.revokeObjectURL(url);
  primaryFile = null;
  primaryUrl = '';
  referenceFiles = [];
  referenceUrls = [];
  generatedDataUrl = '';
  photoInput.value = '';
  cameraInput.value = '';
  referenceInput.value = '';
  sourceImage.removeAttribute('src');
  sourceImage.classList.add('hidden');
  uploadContent.classList.remove('hidden');
  drop.classList.remove('has-image');
  $('photoMeta').textContent = 'No primary photo selected';
  $('resultActions').classList.add('hidden');
  renderReferences();
  renderPreview();
  updateSummary();
  showStatus('Selected photos cleared from this page.');
}
function resizeImage(file, maxSide = 1536) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) { URL.revokeObjectURL(url); reject(new Error('This browser could not prepare the selected photo.')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare photo.')), 'image/jpeg', 0.9);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This iPhone browser could not read that photo format. Try a JPEG or PNG copy from Photos.'));
    };
    image.src = url;
  });
}
function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function renderGallery() {
  const list = $('galleryList');
  try {
    const trophies = await listTrophies();
    list.replaceChildren();
    if (!trophies.length) {
      const empty = document.createElement('span');
      empty.className = 'notice';
      empty.textContent = 'Your saved digital mounts will appear here.';
      list.append(empty);
      return;
    }
    trophies.forEach(trophy => {
      const card = document.createElement('div');
      card.style.cssText = 'display:grid;grid-template-columns:76px 1fr auto;gap:9px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:9px';
      const image = document.createElement('img');
      const imageUrl = URL.createObjectURL(trophy.imageBlob);
      image.src = imageUrl;
      image.alt = `${trophy.name} saved digital mount`;
      image.style.cssText = 'width:76px;height:76px;object-fit:cover;border-radius:6px';
      image.addEventListener('load', () => URL.revokeObjectURL(imageUrl), { once: true });
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = trophy.name;
      const detail = document.createElement('div');
      detail.className = 'notice';
      detail.textContent = [trophy.year, trophy.style].filter(Boolean).join(' · ');
      info.append(title, detail);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn secondary';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${trophy.name}`);
      remove.addEventListener('click', async () => {
        if (!confirm(`Delete “${trophy.name}” from this device?`)) return;
        try { await deleteTrophy(trophy.id); await renderGallery(); showStatus('Trophy deleted from this device.'); }
        catch (error) { showStatus(error.message, true); }
      });
      card.append(image, info, remove);
      list.append(card);
    });
  } catch (error) {
    list.textContent = error.message || 'Your local gallery is unavailable in this browser.';
  }
}

function buildPrompt() {
  const name = $('name').value.trim();
  const year = $('year').value.trim();
  const background = $('background').value;
  const plaque = $('plaque').value;
  return `Create a premium, photorealistic digital taxidermy artwork based on the uploaded real whitetail deer harvest photograph(s). This is an EDIT of the supplied reference photography, not a new unrelated deer. MOUNT STYLE: ${selectedStyle}. DISPLAY SETTING: ${background}. PLAQUE: ${plaque}. Trophy name: ${name || 'No name supplied'}. Harvest year: ${year || 'Not supplied'}.\n\nCRITICAL SUBJECT PRESERVATION: Treat the original deer and antlers as the identity reference. Preserve the visible antler architecture as closely as possible: left/right beam shape, tine count, tine positions, curvature, spread, asymmetry, stickers, drop tines, and visible damage. Do not add, remove, straighten, mirror, enlarge, or invent antler points. Preserve the animal's recognizable face, coat color, and proportions. Do not turn it into a generic oversized trophy buck. If details are obscured in the reference, do not fabricate extra features.\n\nCreate a believable professionally mounted taxidermy presentation with anatomically plausible neck/head proportions, realistic hair texture, natural glass eyes, accurate skull/antler attachment, and professional studio lighting. Keep the full rack visible and inside the frame. Do not include extra deer, extra antlers, duplicate beams, text, logos, watermarks, or graphic overlays. ${$('preserve').checked ? 'Favor fidelity to the reference over dramatic embellishment.' : ''} The result must be clearly a stylized digital artwork based on the supplied harvest, not a claim of an exact physical replica.`;
}


async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not prepare the image for the free AI service.'));
    reader.readAsDataURL(blob);
  });
}



$('chooseBtn').addEventListener('click', () => photoInput.click());
$('cameraBtn').addEventListener('click', () => cameraInput.click());
photoInput.addEventListener('change', () => handlePrimaryInput(photoInput));
cameraInput.addEventListener('change', () => handlePrimaryInput(cameraInput));
$('addReferencesBtn').addEventListener('click', () => referenceInput.click());
referenceInput.addEventListener('change', () => {
  addReferencePhotos(Array.from(referenceInput.files || []));
  referenceInput.value = '';
});
$('clearPhotosBtn').addEventListener('click', clearPhotos);
sourceImage.addEventListener('error', () => showStatus('This photo could not be previewed in this browser. Try a JPEG or PNG copy.', true));

document.querySelectorAll('.style').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.style').forEach(item => {
    item.classList.remove('selected');
    item.setAttribute('aria-pressed', 'false');
  });
  button.classList.add('selected');
  button.setAttribute('aria-pressed', 'true');
  selectedStyle = button.dataset.style;
  updateSummary();
}));
['background', 'name', 'year', 'plaque'].forEach(id => $(id).addEventListener('input', updateSummary));

$('saveEndpoint').addEventListener('click', () => {
  const provider = $('engineProvider').value;
  const value = $('engineEndpoint').value.trim();
  if (provider === 'pixelster-free') {
    localStorage.removeItem(endpointKey);
    localStorage.setItem(providerKey, provider);
    updateEngineState(); updateSummary();
    showStatus('Free no-signup AI selected. Your harvest photo is not sent until you check the consent box and tap Create.');
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a secure HTTPS service URL without embedded credentials.');
    localStorage.setItem(endpointKey, url.href.replace(/\/$/, ''));
    localStorage.setItem(providerKey, provider);
    updateEngineState(); updateSummary();
    showStatus('Secure service URL saved on this device. Generation requires a working backend and explicit photo consent.');
  } catch (error) {
    $('endpointSaved').textContent = error.message || 'Enter a valid HTTPS service URL.';
    if (error instanceof TypeError) $('endpointSaved').textContent = 'Enter a valid HTTPS service URL.';
  }
});
$('engineProvider').addEventListener('change', () => {
  localStorage.setItem(providerKey, $('engineProvider').value);
  updateEngineState(); updateSummary();
});

$('saveToGallery').addEventListener('click', async () => {
  if (!generatedDataUrl) return;
  const button = $('saveToGallery');
  button.disabled = true;
  try {
    await saveTrophy({
      imageBlob: dataUrlToBlob(generatedDataUrl),
      name: $('name').value.trim() || 'My Whitetail Trophy',
      year: $('year').value.trim(),
      style: selectedStyle
    });
    await renderGallery();
    showStatus('Your digital trophy is saved in this iPhone browser gallery. It is not cloud-backed up.');
  } catch (error) { showStatus(error.message || 'Could not save this trophy.', true); }
  finally { button.disabled = false; }
});

createButton.addEventListener('click', async () => {
  if (!primaryFile) return;
  const provider = currentProvider();
  const endpoint = currentEndpoint();
  if (provider !== 'pixelster-free' && !endpoint) {
    showStatus('Choose the free no-signup AI option or connect a configured AI backend. No photo was uploaded.');
    return;
  }
  if (!$('uploadConsent').checked) {
    showStatus('Please confirm that you want to send these selected photos to the configured image service before creating your mount.', true);
    return;
  }
  createButton.disabled = true;
  createButton.textContent = 'PREPARING YOUR PHOTOS…';
  showStatus('Preparing your selected reference photos…');
  try {
    showStatus(provider === 'pixelster-free' ? 'Preparing your photo for the free image-editing model…' : 'Preparing your selected reference photos…');
    if (provider === 'pixelster-free') {
      const prepared = await resizeImage(primaryFile, 1536);
      if (prepared.size > 3.4 * 1024 * 1024) throw new Error('This photo is still too large for the free provider (3.5 MB limit). Choose a smaller photo.');
      showStatus('Sending your photo to FreeAPI PixelSter for AI editing…');
      generatedDataUrl = await generatePixelSterImage(await blobToDataUrl(prepared), buildPrompt());
    } else {
      const form = new FormData();
      const inputMaxSide = provider === 'cloudflare-free' ? 500 : 1536;
      form.append('image', await resizeImage(primaryFile, inputMaxSide), 'harvest.jpg');
      for (let index = 0; index < referenceFiles.length; index += 1) {
        form.append('references', await resizeImage(referenceFiles[index], inputMaxSide), `reference-${index + 1}.jpg`);
      }
      form.append('prompt', buildPrompt()); form.append('style', selectedStyle);
      showStatus('Sending your photos to the configured service for processing…');
      const response = await fetch(endpoint, { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Image service error (${response.status}).`);
      if (!data.image) throw new Error('The image service returned no finished image.');
      generatedDataUrl = `data:${data.mimeType || 'image/png'};base64,${data.image}`;
    }
    renderPreview();
    const filename = ($('name').value.trim() || 'cso-digital-mount').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    $('downloadResult').href = generatedDataUrl;
    $('downloadResult').download = `${filename || 'cso-digital-mount'}.png`;
    $('resultActions').classList.remove('hidden');
    showStatus('Your AI-generated digital mount is ready. Review the rack carefully against your original harvest photos before saving.');
  } catch (error) {
    showStatus(error.message || 'Something went wrong while creating your mount.', true);
  } finally {
    createButton.disabled = !primaryFile;
    createButton.textContent = (currentProvider() === 'pixelster-free' || currentEndpoint()) ? 'CREATE MY DIGITAL MOUNT' : 'PREVIEW MY TROPHY SETUP';
  }
});

const endpoint = currentEndpoint();
$('engineEndpoint').value = endpoint;
$('engineProvider').value = currentProvider();
updateEngineState();
updateSummary();
renderPreview();
renderGallery();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update().catch(() => {})).catch(() => showStatus('The app shell could not be cached for offline use. Trophy Studio remains available while online.', true));
}
