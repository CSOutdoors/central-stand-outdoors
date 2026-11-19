from html.parser import HTMLParser
from pathlib import Path
from collections import Counter
import json

ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.buttons=[]; self.scripts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='button':self.buttons.append(a)
        if tag=='script':self.scripts.append(a)
page=Page();page.feed((ROOT/'index.html').read_text())
dups=[k for k,v in Counter(page.ids).items() if v>1]
assert not dups, f'Duplicate IDs: {dups}'
assert all(b.get('type')=='button' for b in page.buttons), 'Every button must have explicit type=button'
html=(ROOT/'index.html').read_text()
assert 'viewport-fit=cover' in html and 'apple-mobile-web-app-capable' in html
assert 'Content-Security-Policy' in html
assert './manifest.webmanifest' in html and './app.js' in html and './sw.js' in (ROOT/'app.js').read_text()
manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
assert manifest['display']=='standalone'
for icon in manifest['icons']:
    assert (ROOT/icon['src'].replace('./','')).is_file(), f"Missing icon {icon['src']}"
assert (ROOT/'icons/apple-touch-icon.png').is_file()
sw=(ROOT/'sw.js').read_text()
for f in ['./index.html','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png']:
    assert f in sw, f'Missing from service-worker app shell: {f}'
app=(ROOT/'app.js').read_text()
assert 'innerHTML' not in app, 'Avoid HTML string injection in app.js'
assert 'getCurrentPosition' in app and 'watchPosition' not in app, 'Location must be requested only on demand, not continuously tracked'
assert 'maximumAge:0' in app, 'GPS save should request a fresh location fix'
assert 'https://api.weather.gov/points/' in app
assert 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/' in app
print('Static checks passed: unique IDs, explicit button types, iPhone viewport metadata, CSP, PWA manifest/icons, service-worker shell, no innerHTML sinks, GPS/NWS/USGS wiring.')
