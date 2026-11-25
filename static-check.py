from html.parser import HTMLParser
from pathlib import Path
from collections import Counter
import json

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.buttons = []
        self.scripts = []
        self.inputs = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'button':
            self.buttons.append(attrs)
        if tag == 'script':
            self.scripts.append(attrs)
        if tag == 'input':
            self.inputs.append(attrs)

html = (ROOT / 'index.html').read_text()
page = Page()
page.feed(html)
duplicates = [key for key, count in Counter(page.ids).items() if count > 1]
assert not duplicates, f'Duplicate IDs: {duplicates}'
assert all(button.get('type') == 'button' for button in page.buttons), 'Every button must have explicit type=button'
assert 'viewport-fit=cover' in html and 'apple-mobile-web-app-capable' in html
assert 'Content-Security-Policy' in html
assert './manifest.webmanifest' in html and './trophy-app.js' in html
assert 'type="module"' not in html, 'Trophy Studio home must not depend on runtime ES module loading'
assert (ROOT / 'trophy-app.js').is_file(), 'Missing production Trophy Studio bundle'
assert not __import__('re').search(r'^\s*(?:import|export)\s', (ROOT / 'trophy-app.js').read_text(), __import__('re').M), 'Production bundle must have no module imports or exports'
assert 'id="photo"' in html and 'id="cameraPhoto"' in html and 'capture="environment"' in html
assert 'for="photo"' in html and 'for="cameraPhoto"' in html, 'Native photo labels must work without a JavaScript click handler'
assert 'id="references"' in html and 'multiple' in html
assert 'id="uploadConsent"' in html and 'id="privacyNotice"' in html
assert 'id="generationUsage"' in html
assert 'id="reviewMount"' in html and 'id="saveToGallery"' in html
assert 'compare-grid' in html and 'I reviewed this mount against my original buck' in html
assert 'id="turnstileWidget"' in html and 'id="engineTurnstileSiteKey"' in html
assert 'challenges.cloudflare.com' in html and 'frame-src' in html
assert 'no image has been generated' in html
assert 'HUNTING COMPANION' in html and './hunt.html' in html
assert not any('onclick' in attr for attr in page.buttons), 'Use registered event listeners, not inline handlers'

manifest = json.loads((ROOT / 'manifest.webmanifest').read_text())
assert manifest['display'] == 'standalone'
assert manifest['start_url'] == './index.html'
assert 'Trophy Studio' in manifest['name']
for icon in manifest['icons']:
    assert (ROOT / icon['src'].replace('./', '')).is_file(), f"Missing icon {icon['src']}"
assert (ROOT / 'icons/apple-touch-icon.png').is_file()

sw = (ROOT / 'sw.js').read_text()
for path in ['./index.html', './hunt.html', './trophy-app.js', './lodge.js', './app.js', './manifest.webmanifest']:
    assert path in sw, f'Missing from service-worker app shell: {path}'

trophy_js = (ROOT / 'trophy.js').read_text()
assert 'fetch(endpoint' in trophy_js and 'uploadConsent' in trophy_js
assert 'localStorage.setItem(endpointKey' in trophy_js
assert 'cf-turnstile-response' in trophy_js and 'turnstile.render' in trophy_js
assert 'generatePixelSterImage' not in trophy_js and 'freeapi.pro' not in html
assert 'pixelster' not in (ROOT / 'trophy-app.js').read_text().lower()
assert 'GENERATION_ENABLED' in (ROOT / 'engine/worker.js').read_text()
worker_source = (ROOT / 'engine/worker.js').read_text()
assert 'summarizeUsage' in worker_source
assert 'imageInput: 8, textInput: 5, imageOutput: 30' in worker_source, 'Use direct Images API Standard rates, not Batch rates'
assert "RATE_CARD_CHECKED_ON = '2026-11-24'" in worker_source
assert 'formatGenerationUsage' in (ROOT / 'trophy-usage.js').read_text()
assert 'REGENERATE DIGITAL MOUNT' in trophy_js
assert 'invalidateGeneratedResult' in trophy_js and 'syncSaveButton' in trophy_js
assert 'reviewMount' in trophy_js and 'generatedSaved' in trophy_js
assert 'TURNSTILE_SECRET_KEY' in (ROOT / 'engine/worker.js').read_text()
assert 'CSOUsageGuard' in (ROOT / 'engine/worker.js').read_text()
assert (ROOT / 'engine/worker-free.js').is_file()
assert 'innerHTML' not in trophy_js, 'Avoid HTML string injection in Trophy Studio'
assert 'serviceWorker.register' in trophy_js

intake = (ROOT / 'trophy-intake.js').read_text()
assert 'MAX_REFERENCE_PHOTOS = 3' in intake
assert 'MAX_SOURCE_FILE_BYTES' in intake
assert 'validatePhotoFile' in intake and 'validateReferenceSelection' in intake

hunt = (ROOT / 'hunt.html').read_text()
assert './app.js' in hunt and './index.html' in hunt
app = (ROOT / 'app.js').read_text()
assert "const STORAGE_KEY = 'cso_gps_v4'" in app, 'Do not change existing hunting-companion storage compatibility'
assert 'getCurrentPosition' in app and 'watchPosition' not in app, 'Location must be requested only on demand'
assert 'maximumAge:0' in app, 'GPS save should request a fresh location fix'
assert 'https://api.weather.gov/points/' in app
assert 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' in app
assert 'innerHTML' not in app, 'Avoid HTML string injection in app.js'

print('Static checks passed: Trophy Studio home, iPhone photo/camera intake, consent and Turnstile, side-by-side result review/save gate, fail-closed secure backend, PWA metadata, offline shell, safe DOM updates, and preserved hunting-companion storage/GPS/weather wiring.')
