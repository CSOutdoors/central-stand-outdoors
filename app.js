(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'cso_gps_v4';
  const LEGACY_KEYS = ['cso_gps_v3','cso_field_v2'];
  const DIRECTIONS = ['N','NE','E','SE','S','SW','W','NW'];
  const TYPES = {stand:'Stand',camera:'Camera',food:'Food Plot',access:'Access Point',sighting:'Deer Sighting'};
  const state = {version:1,property:{name:'',lat:null,lon:null},points:[],weather:null};
  let map = null, markers = {}, gpsMarker = null, accuracyCircle = null, lastFix = null, toastTimer = null, mapCentered = false, weatherRefreshFailed = false;

  function newId(){
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function finiteCoord(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;}
  function cleanText(v,max){return typeof v==='string'?v.slice(0,max):'';}
  function normalizeState(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Backup data must be a JSON object.');
    const p=raw.property&&typeof raw.property==='object'?raw.property:{};
    const propLat=p.lat==null||p.lat===''?null:Number(p.lat), propLon=p.lon==null||p.lon===''?null:Number(p.lon);
    const property = {name:cleanText(p.name,80),lat:propLat,lon:propLon};
    if(property.lat===null||property.lon===null||!finiteCoord(property.lat,property.lon)){property.lat=null;property.lon=null;}
    const inputPoints=Array.isArray(raw.points)?raw.points:[];
    if(inputPoints.length>5000) throw new Error('Backup contains more than 5,000 locations.');
    const points=[];
    const usedIds=new Set();
    for(const item of inputPoints){
      if(!item||typeof item!=='object') continue;
      if(item.lat===null||item.lat===undefined||item.lat===''||item.lon===null||item.lon===undefined||item.lon==='') continue;
      const lat=Number(item.lat),lon=Number(item.lon),type=Object.hasOwn(TYPES,item.type)?item.type:null;
      if(!type||!finiteCoord(lat,lon)) continue;
      const winds=Array.isArray(item.winds)?item.winds.filter(w=>DIRECTIONS.includes(w)):[];
      const accuracy=Number(item.accuracy);
      let id=cleanText(item.id,80)||newId();if(usedIds.has(id))id=newId();usedIds.add(id);
      points.push({id,name:cleanText(item.name,80)||TYPES[type],type,winds,notes:cleanText(item.notes,1000),lat,lon,accuracy:Number.isFinite(accuracy)&&accuracy>0?accuracy:null,created:cleanText(item.created,40)||new Date().toISOString()});
    }
    let weather=null;
    if(raw.weather&&typeof raw.weather==='object'){
      const w=raw.weather;
      const minRaw=w.windSpeedMinMph??w.windMph,maxRaw=w.windSpeedMaxMph??w.windMph;
      const min=Number(minRaw),max=Number(maxRaw);
      if(minRaw!==null&&minRaw!==undefined&&minRaw!==''&&maxRaw!==null&&maxRaw!==undefined&&maxRaw!==''&&Number.isFinite(min)&&Number.isFinite(max)) weather={windSector:DIRECTIONS.includes(w.windSector)?w.windSector:null,windDirectionRaw:cleanText(w.windDirectionRaw,20),windSpeedMinMph:min,windSpeedMaxMph:Math.max(min,max),temperature:cleanText(String(w.temperature??''),12),temperatureUnit:cleanText(w.temperatureUnit||'F',2),summary:cleanText(w.summary||'',180),startTime:cleanText(w.startTime||'',40),fetchedAt:cleanText(w.fetchedAt||'',40)};
    }
    return {version:1,property,points,weather};
  }
  function loadState(){
    try{
      const current=localStorage.getItem(STORAGE_KEY);
      if(current){Object.assign(state,normalizeState(JSON.parse(current)));return;}
      for(const key of LEGACY_KEYS){
        const legacy=localStorage.getItem(key);
        if(legacy){Object.assign(state,normalizeState(JSON.parse(legacy)));saveState(state);showToast('Older CSO data was migrated to the new storage format.');return;}
      }
    }catch(err){$('storageStatus').textContent='Saved data could not be read: '+err.message;}
  }
  function saveState(next){
    const normalized=normalizeState(next);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));}
    catch(err){throw new Error(err&&err.name==='QuotaExceededError'?'Device storage is full. Export a backup and remove unneeded data.':'Browser storage is unavailable. Check Safari privacy settings and try again.');}
    Object.assign(state,normalized);
  }
  function showToast(message){const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.style.display='none';},3200);}
  function setStatus(id,message,kind){const el=$(id);el.textContent=message;el.classList.toggle('bad',kind==='error');el.classList.toggle('good',kind==='success');}
  function makeWindChecks(){
    const root=$('windChecks');
    for(const dir of DIRECTIONS){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=dir;input.setAttribute('aria-label',`Wind from ${dir}`);label.append(input,document.createTextNode(dir));root.append(label);}
  }
  function makeMap(){
    if(!window.L||typeof L.map!=='function'){$('map').classList.add('hidden');$('mapFallback').style.display='block';setStatus('mapStatus','Interactive map library did not load. Saved coordinates are still available.','error');return;}
    try{
      map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([40.75,-89.4],11);
      const tiles=L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Imagery: USDA, <a href="https://www.usgs.gov/">USGS The National Map: Orthoimagery</a>'});
      tiles.on('tileerror',()=>setStatus('mapStatus','USGS map tiles could not be loaded. Check your connection; saved locations remain on this device.','error'));
      tiles.addTo(map);
      setStatus('mapStatus','Map imagery is supplied by the USGS National Map.','');
    }catch(err){$('map').classList.add('hidden');$('mapFallback').style.display='block';setStatus('mapStatus','Map initialization failed: '+err.message,'error');map=null;}
  }
  function popupNode(point){const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=point.name;const kind=document.createElement('div');kind.textContent=TYPES[point.type];const winds=document.createElement('div');winds.textContent='Safe wind from: '+(point.winds.length?point.winds.join(', '):'not set');const notes=document.createElement('div');notes.textContent=point.notes;box.append(strong,kind,winds,notes);return box;}
  function draw(){
    if(!map)return;
    Object.values(markers).forEach(m=>map.removeLayer(m));markers={};
    for(const point of state.points){
      const marker=L.marker([point.lat,point.lon],{title:point.name,alt:`${point.name}, ${TYPES[point.type]} location`}).addTo(map).bindPopup(popupNode(point));
      markers[point.id]=marker;
    }
    if(lastFix){if(gpsMarker)map.removeLayer(gpsMarker);if(accuracyCircle)map.removeLayer(accuracyCircle);gpsMarker=L.circleMarker([lastFix.lat,lastFix.lon],{radius:8,color:'#fff',weight:3,fillColor:'#277bd1',fillOpacity:1}).addTo(map).bindPopup('Your current GPS location');accuracyCircle=L.circle([lastFix.lat,lastFix.lon],{radius:lastFix.accuracy||0,color:'#277bd1',weight:1,fillOpacity:.08}).addTo(map);}
  }
  function renderList(){
    const root=$('pointList');root.replaceChildren();
    if(!state.points.length){const empty=document.createElement('div');empty.className='sub';empty.textContent='No locations saved yet.';root.append(empty);return;}
    for(const point of state.points){
      const item=document.createElement('article');item.className='item';
      const name=document.createElement('div');name.className='itemname';name.textContent=point.name;
      const meta=document.createElement('div');meta.className='itemmeta';meta.textContent=`${TYPES[point.type]} · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · GPS ±${point.accuracy?Math.round(point.accuracy)+' m':'unknown'}`;
      const wind=document.createElement('div');wind.className='itemmeta';wind.textContent=point.winds.length?'Safe wind from: '+point.winds.join(', '):'No wind rule set';
      const actions=document.createElement('div');actions.className='actions';
      const show=document.createElement('button');show.type='button';show.className='secondary small';show.textContent='Show on map';show.disabled=!map;show.addEventListener('click',()=>{if(map){map.setView([point.lat,point.lon],16);markers[point.id]?.openPopup();$('mapHeading').scrollIntoView({behavior:'smooth',block:'start'});}});
      const del=document.createElement('button');del.type='button';del.className='warn small';del.textContent='Delete';del.setAttribute('aria-label',`Delete ${point.name}`);del.addEventListener('click',()=>deletePoint(point.id));
      actions.append(show,del);item.append(name,meta,wind,actions);root.append(item);
    }
  }
  function renderWeather(){
    const w=state.weather;if(!w){$('windValue').textContent='—';$('tempValue').textContent='—';$('weatherSummary').textContent='No forecast loaded.';return;}
    $('windValue').textContent=w.windDirectionRaw?`${w.windDirectionRaw} · ${Math.round(w.windSpeedMinMph)}–${Math.round(w.windSpeedMaxMph)} mph`:'Variable wind';
    $('tempValue').textContent=w.temperature?`${w.temperature}°${w.temperatureUnit}`:'—';
    $('weatherSummary').textContent=`${w.summary||'Forecast loaded'}${w.startTime?' · '+w.startTime:''}${w.fetchedAt?' · Updated '+new Date(w.fetchedAt).toLocaleString():''}`;
  }
  function renderAdvisor(){
    const stands=state.points.filter(p=>p.type==='stand');let message='';
    if(!stands.length)message='Save a tree stand or blind with GPS to start.';
    else if(!state.weather)message='Your stands are saved. Load a forecast to compare wind direction with each stand’s configured safe-wind directions.';
    else if(weatherRefreshFailed)message='The latest NWS refresh failed. The saved forecast may be outdated; retry before relying on a wind recommendation.';
    else if(!state.weather.fetchedAt||!Number.isFinite(Date.parse(state.weather.fetchedAt))||Date.now()-Date.parse(state.weather.fetchedAt)>3*60*60*1000)message='The saved weather forecast is older than 3 hours or has no valid timestamp. Refresh the forecast before using a wind recommendation.';
    else if(!state.weather.windSector)message='The NWS forecast reports variable or unsupported wind direction. No stand match is calculated; check conditions locally.';
    else{const matches=stands.filter(s=>s.winds.includes(state.weather.windSector));message=`Forecast wind FROM ${state.weather.windSector}, ${Math.round(state.weather.windSpeedMinMph)}–${Math.round(state.weather.windSpeedMaxMph)} mph. `+(matches.length?`Configured wind match: ${matches.map(s=>s.name).join(', ')}.`:'No stand matches this configured wind direction.')+' Verify wind at stand height and account for access, terrain, and thermals.';}
    $('advisor').textContent=message;
  }
  function renderAll(){renderList();renderWeather();renderAdvisor();draw();if(map&&!mapCentered){const target=state.property.lat!==null?[state.property.lat,state.property.lon]:(state.points[0]?[state.points[0].lat,state.points[0].lon]:null);if(target){map.setView(target,14);mapCentered=true;}}}
  function windSector(direction){
    const degrees={N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};
    if(!Object.hasOwn(degrees,direction))return null;
    return DIRECTIONS[Math.round(degrees[direction]/45)%8];
  }
  function parseWindSpeed(text){
    const matches=String(text||'').match(/[\d.]+/g);if(!matches||!matches.length)throw new Error('The NWS wind speed could not be read.');
    let values=matches.map(Number).filter(Number.isFinite);if(!values.length)throw new Error('The NWS wind speed could not be read.');
    const lower=String(text).toLowerCase();const factor=lower.includes('km/h')?0.621371:lower.includes('knot')?1.15078:1;
    values=values.map(v=>v*factor);return {min:Math.min(...values),max:Math.max(...values)};
  }
  function getGPS(){
    return new Promise((resolve,reject)=>{
      if(!window.isSecureContext){reject(new Error('GPS requires a secure HTTPS website (or localhost during development).'));return;}
      if(!navigator.geolocation){reject(new Error('This browser does not support location services.'));return;}
      navigator.geolocation.getCurrentPosition(position=>{
        const c=position.coords,lat=Number(c.latitude),lon=Number(c.longitude),accuracy=Number(c.accuracy);
        if(!finiteCoord(lat,lon)||!Number.isFinite(accuracy)||accuracy<0){reject(new Error('The device returned an invalid GPS reading. Try again.'));return;}
        lastFix={lat,lon,accuracy};if(map){if(gpsMarker)map.removeLayer(gpsMarker);if(accuracyCircle)map.removeLayer(accuracyCircle);gpsMarker=L.circleMarker([lat,lon],{radius:8,color:'#fff',weight:3,fillColor:'#277bd1',fillOpacity:1}).addTo(map).bindPopup('Your current GPS location');accuracyCircle=L.circle([lat,lon],{radius:accuracy,color:'#277bd1',weight:1,fillOpacity:.08}).addTo(map);map.setView([lat,lon],16);}
        const quality=accuracy>100?`GPS accuracy is weak (±${Math.round(accuracy)} m). Move to a clearer area and retry if this pin must be precise.`:`Location found · estimated accuracy ±${Math.round(accuracy)} m.`;
        setStatus('gpsStatus',`${quality} Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}.`,accuracy>100?'error':'success');resolve(lastFix);
      },error=>{
        const messages={1:'Location permission was denied. Enable location access for this site in Safari settings, then try again.',2:'Location is unavailable. Move outdoors or check Location Services and try again.',3:'GPS request timed out. Move to a clearer area and try again.'};
        reject(new Error(messages[error.code]||'Could not get your location. Try again.'));
      },{enableHighAccuracy:true,timeout:25000,maximumAge:0});
    });
  }
  async function withGpsButton(button,action){button.disabled=true;const old=button.textContent;button.textContent='Getting GPS…';try{const fix=await getGPS();await action(fix);}catch(err){setStatus('gpsStatus',err.message,'error');showToast(err.message);}finally{button.disabled=false;button.textContent=old;}}
  function deletePoint(id){const next={...state,points:state.points.filter(p=>p.id!==id)};try{saveState(next);renderAll();showToast('Location deleted.');}catch(err){showToast(err.message);}}
  function updateProperty(fix){const next={...state,property:{name:$('propertyName').value.trim()||'My Property',lat:fix.lat,lon:fix.lon}};try{saveState(next);renderAll();showToast('Property center saved on this device.');}catch(err){showToast(err.message);}}
  function savePoint(fix){
    const type=$('pointType').value;if(!Object.hasOwn(TYPES,type))throw new Error('Choose a valid location type.');
    const winds=type==='stand'?[...$('windChecks').querySelectorAll('input:checked')].map(x=>x.value):[];
    const count=state.points.filter(p=>p.type===type).length+1;
    const point={id:newId(),name:$('pointName').value.trim()||`${TYPES[type]} ${count}`,type,winds,notes:$('pointNotes').value.trim(),lat:fix.lat,lon:fix.lon,accuracy:fix.accuracy,created:new Date().toISOString()};
    const next={...state,points:[...state.points,point]};saveState(next);$('pointName').value='';$('pointNotes').value='';$('windChecks').querySelectorAll('input').forEach(x=>x.checked=false);renderAll();showToast(`${point.name} saved on this device.`);
  }
  async function fetchWithTimeout(url,options,ms=16000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
  async function loadWeather(){
    weatherRefreshFailed=false;
    $('weatherBtn').disabled=true;const old=$('weatherBtn').textContent;$('weatherBtn').textContent='Loading forecast…';setStatus('weatherSummary','Requesting the nearby NWS hourly forecast…','');
    try{
      let lat=state.property.lat,lon=state.property.lon;
      if(lat===null||lon===null){const fix=await getGPS();lat=fix.lat;lon=fix.lon;}
      // Keep requests simple for browser CORS. Browser JavaScript cannot set a custom User-Agent; NWS recommends an identifying User-Agent, so a server-side proxy may be needed if direct browser access is restricted or rate-limited.
      const pointResponse=await fetchWithTimeout(`https://api.weather.gov/points/${lat},${lon}`,{headers:{Accept:'application/geo+json'}});
      if(!pointResponse.ok)throw new Error(`NWS location lookup returned HTTP ${pointResponse.status}.`);
      const pointData=await pointResponse.json(),hourlyUrl=pointData.properties?.forecastHourly;
      if(!hourlyUrl)throw new Error('NWS did not provide an hourly forecast for this location.');
      const forecastResponse=await fetchWithTimeout(hourlyUrl,{headers:{Accept:'application/geo+json'}});
      if(!forecastResponse.ok)throw new Error(`NWS hourly forecast returned HTTP ${forecastResponse.status}.`);
      const forecast=await forecastResponse.json(),period=forecast.properties?.periods?.[0];if(!period)throw new Error('NWS returned no hourly forecast periods.');
      const speed=parseWindSpeed(period.windSpeed),sector=windSector(period.windDirection);
      const next={...state,weather:{windSector:sector,windDirectionRaw:cleanText(period.windDirection,20),windSpeedMinMph:speed.min,windSpeedMaxMph:speed.max,temperature:cleanText(String(period.temperature??''),12),temperatureUnit:cleanText(period.temperatureUnit||'F',2),summary:cleanText(period.shortForecast||'',180),startTime:cleanText(period.startTime||'',40),fetchedAt:new Date().toISOString()}};
      saveState(next);renderAll();showToast('NWS forecast updated.');
    }catch(err){weatherRefreshFailed=true;const msg=err.name==='AbortError'?'The NWS request timed out. Try again when service is available.':`Forecast unavailable: ${err.message}`;setStatus('weatherSummary',msg,'error');renderAdvisor();showToast('Could not load the forecast.');}
    finally{$('weatherBtn').disabled=false;$('weatherBtn').textContent=old;}
  }
  function exportBackup(){
    const payload={schema:'cso-backup',version:1,exportedAt:new Date().toISOString(),state:normalizeState(state)};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`cso-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast('Backup file prepared. Keep it somewhere private.');
  }
  async function restoreBackup(file){
    if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error('Backup file is larger than 5 MB.');
      const parsed=JSON.parse(await file.text());
      if(parsed.schema&&parsed.schema!=='cso-backup')throw new Error('This file is not a recognized CSO backup.');
      if(parsed.schema==='cso-backup'&&parsed.version!==1)throw new Error('This backup version is not supported by this app.');
      const rawState=parsed.schema==='cso-backup'?parsed.state:parsed;
      if(!rawState||typeof rawState!=='object'||!Array.isArray(rawState.points))throw new Error('Backup is missing its saved locations list.');
      const candidate=normalizeState(rawState);
      if(candidate.points.length!==rawState.points.length)throw new Error('Backup contains invalid location records. Nothing was restored.');
      if(!confirm(`Restore ${candidate.points.length} location(s) and replace the data currently saved in this browser? Export your current data first if you want to keep it.`))return;
      saveState(candidate);$('propertyName').value=state.property.name;mapCentered=false;renderAll();showToast(`Restored ${state.points.length} location(s).`);
    }catch(err){showToast(`Restore failed: ${err.message}`);}
    finally{$('restoreFile').value='';}
  }
  function updateConnection(){const online=navigator.onLine;$('connectionStatus').textContent=online?'ONLINE':'OFFLINE · saved data available';$('connectionStatus').classList.toggle('bad',!online);if(!online)setStatus('mapStatus','You are offline. Saved data works; live map tiles and NWS forecasts need internet.','error');else if(map)setStatus('mapStatus','Online · USGS map tiles load from the internet.','');}
  function registerWorker(){if('serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js').catch(err=>setStatus('mapStatus','Offline app-shell setup failed: '+err.message,'error'));}}

  $('locateBtn').dataset.originalLabel=$('locateBtn').textContent;
  $('saveProperty').dataset.originalLabel=$('saveProperty').textContent;
  $('savePoint').dataset.originalLabel=$('savePoint').textContent;
  makeWindChecks();loadState();$('propertyName').value=state.property.name||'';makeMap();renderAll();updateConnection();
  $('locateBtn').addEventListener('click',()=>withGpsButton($('locateBtn'),async()=>showToast('Your location is shown on the map.')));
  $('saveProperty').addEventListener('click',()=>withGpsButton($('saveProperty'),async fix=>updateProperty(fix)));
  $('savePoint').addEventListener('click',()=>withGpsButton($('savePoint'),async fix=>{try{savePoint(fix);}catch(err){showToast(err.message);}}));
  $('weatherBtn').addEventListener('click',loadWeather);
  $('exportBtn').addEventListener('click',exportBackup);
  $('restoreFile').addEventListener('change',event=>restoreBackup(event.target.files?.[0]));
  window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
  if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>showToast('CSO offline app shell updated.'));
  registerWorker();
})();
