(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'cso_gps_v4';
  const LEGACY_KEYS = ['cso_gps_v3','cso_field_v2'];
  const DIRECTIONS = ['N','NE','E','SE','S','SW','W','NW'];
  const TYPES = {stand:'Stand',camera:'Camera',food:'Food Plot',access:'Access Point',sighting:'Deer Sighting'};
  const state = {version:1,property:{name:'',lat:null,lon:null},points:[],parcels:[],weather:null};
  let map = null, markers = {}, mapLayers = {}, gpsMarker = null, accuracyCircle = null, scentLayers = [], scentFrame = 0, lastFix = null, toastTimer = null, mapCentered = false, weatherRefreshFailed = false, scentVisible = false, mapMode = 'idle', pendingMapPoint = null, boundaryVertices = [], boundaryPreview = null, boundaryLayers = [];
  const selectedWindDirs = new Set();

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
      points.push({id,name:cleanText(item.name,80)||TYPES[type],type,winds,notes:cleanText(item.notes,1000),lat,lon,accuracy:Number.isFinite(accuracy)&&accuracy>0?accuracy:null,windFromDeg:item.windFromDeg===null||item.windFromDeg===undefined||item.windFromDeg===''?null:Number(item.windFromDeg),windObservedAt:cleanText(item.windObservedAt||'',40),created:cleanText(item.created,40)||new Date().toISOString()});
    }
    let weather=null;
    if(raw.weather&&typeof raw.weather==='object'){
      const w=raw.weather;
      const minRaw=w.windSpeedMinMph??w.windMph,maxRaw=w.windSpeedMaxMph??w.windMph;
      const min=Number(minRaw),max=Number(maxRaw);
      if(minRaw!==null&&minRaw!==undefined&&minRaw!==''&&maxRaw!==null&&maxRaw!==undefined&&maxRaw!==''&&Number.isFinite(min)&&Number.isFinite(max)) weather={windSector:DIRECTIONS.includes(w.windSector)?w.windSector:null,windDirectionRaw:cleanText(w.windDirectionRaw,20),windSpeedMinMph:min,windSpeedMaxMph:Math.max(min,max),temperature:cleanText(String(w.temperature??''),12),temperatureUnit:cleanText(w.temperatureUnit||'F',2),summary:cleanText(w.summary||'',180),startTime:cleanText(w.startTime||'',40),fetchedAt:cleanText(w.fetchedAt||'',40)};
    }
    const parcels=Array.isArray(raw.parcels)?raw.parcels.slice(0,100).map(parcel=>({id:cleanText(parcel.id,80)||newId(),name:cleanText(parcel.name,80)||'Property boundary',coordinates:Array.isArray(parcel.coordinates)?parcel.coordinates.slice(0,500).map(pair=>[Number(pair[0]),Number(pair[1])]).filter(pair=>finiteCoord(pair[0],pair[1])):[]})).filter(parcel=>parcel.coordinates.length>=3):[];
    for(const point of points){const deg=point.windFromDeg===null||point.windFromDeg===undefined?NaN:Number(point.windFromDeg);point.windFromDeg=Number.isFinite(deg)&&deg>=0&&deg<360?deg:null;point.windObservedAt=cleanText(point.windObservedAt||'',40);}
    if(weather){weather.lat=weather.lat===null||weather.lat===undefined?null:(Number.isFinite(Number(weather.lat))?Number(weather.lat):null);weather.lon=weather.lon===null||weather.lon===undefined?null:(Number.isFinite(Number(weather.lon))?Number(weather.lon):null);weather.locationLabel=cleanText(weather.locationLabel||'',80);weather.hourly=Array.isArray(raw.weather.hourly)?raw.weather.hourly.slice(0,168).filter(h=>h&&typeof h==='object'&&typeof h.startTime==='string').map(h=>({startTime:cleanText(h.startTime,40),windDirectionRaw:cleanText(h.windDirectionRaw||'',20),windSector:DIRECTIONS.includes(h.windSector)?h.windSector:null,windSpeedMinMph:h.windSpeedMinMph!==null&&h.windSpeedMinMph!==undefined&&Number.isFinite(Number(h.windSpeedMinMph))?Number(h.windSpeedMinMph):null,windSpeedMaxMph:h.windSpeedMaxMph!==null&&h.windSpeedMaxMph!==undefined&&Number.isFinite(Number(h.windSpeedMaxMph))?Number(h.windSpeedMaxMph):null,temperature:h.temperature!==null&&h.temperature!==undefined&&Number.isFinite(Number(h.temperature))?Number(h.temperature):null,temperatureUnit:cleanText(h.temperatureUnit||'F',2),summary:cleanText(h.summary||'',120),isDaytime:!!h.isDaytime})):[];}
    return {version:1,property,points,parcels,weather};
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
    const root=$('windChecks');root.replaceChildren();
    const layout=[['NW','N','NE'],['W','CENTER','E'],['SW','S','SE']];
    const arrows={N:'↑',NE:'↗',E:'→',SE:'↘',S:'↓',SW:'↙',W:'←',NW:'↖'};
    for(const row of layout)for(const dir of row){
      if(dir==='CENTER'){const center=document.createElement('div');center.className='wind-center';center.textContent='YOUR STAND';root.append(center);continue;}
      const button=document.createElement('button');button.type='button';button.className='wind-direction';button.dataset.direction=dir;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`Safe wind from ${dir}`);
      const arrow=document.createElement('span');arrow.className='wind-arrow';arrow.textContent=arrows[dir];const label=document.createElement('strong');label.textContent=dir;button.append(arrow,label);
      button.addEventListener('click',()=>{if(selectedWindDirs.has(dir))selectedWindDirs.delete(dir);else selectedWindDirs.add(dir);button.setAttribute('aria-pressed',String(selectedWindDirs.has(dir)));});root.append(button);
    }
  }
  function makeMap(){
    if(!window.L||typeof L.map!=='function'){$('map').classList.add('hidden');$('mapFallback').style.display='block';setStatus('mapStatus','Interactive map library did not load. Saved coordinates are still available.','error');return;}
    try{
      map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([40.75,-89.4],11);
      const streets=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
      const aerial=L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Imagery: <a href="https://www.usgs.gov/">USGS The National Map</a>'});
      streets.addTo(map);mapLayers={streets,aerial};
      L.control.layers({'Street & road names':streets,'Satellite imagery':aerial},{},{collapsed:true,position:'topright'}).addTo(map);
      streets.on('tileerror',()=>setStatus('mapStatus','Street map tiles could not be loaded. Check your connection; saved locations remain on this device.','error'));
      aerial.on('tileerror',()=>setStatus('mapStatus','Satellite tiles could not be loaded. Switch back to Street & road names.','error'));
      map.on('click',event=>handleMapClick(event.latlng));
      setStatus('mapStatus','Street map is active so towns, roads, and place names are visible. Use the layer button to switch to satellite imagery.','');
    }catch(err){$('map').classList.add('hidden');$('mapFallback').style.display='block';setStatus('mapStatus','Map initialization failed: '+err.message,'error');map=null;}
  }
  function idealWindStatus(point){
    const observed=point.windFromDeg!==null?windSector(compass16(point.windFromDeg)):null;
    const age=state.weather?.fetchedAt?Date.now()-Date.parse(state.weather.fetchedAt):Infinity;
    const forecast=state.weather&&Number.isFinite(age)&&age>=0&&age<=3*60*60*1000?state.weather.windSector:null;
    const current=observed||forecast;
    if(!point.winds?.length||!current)return 'unknown';
    return point.winds.includes(current)?'good':'bad';
  }
  function windStatusLabel(point){const status=idealWindStatus(point);return status==='good'?'IDEAL WIND':status==='bad'?'NOT IDEAL':'SET IDEAL WIND';}
  function pinIcon(point){const status=idealWindStatus(point),symbol=status==='good'?'✓':status==='bad'?'!':'?';return L.divIcon({className:'',html:`<span class="cso-pin ${status}">${symbol}</span>`,iconSize:[30,30],iconAnchor:[15,15]});}
  function popupNode(point){const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=point.name;const kind=document.createElement('div');kind.textContent=TYPES[point.type];const winds=document.createElement('div');winds.textContent='Safe wind from: '+(point.winds.length?point.winds.join(', '):'not set');const observed=document.createElement('div');observed.textContent=point.windFromDeg===null?'Observed wind: not set':`Observed wind FROM ${compass16(point.windFromDeg)} · ${point.windObservedAt?new Date(point.windObservedAt).toLocaleString():''}`;const notes=document.createElement('div');notes.textContent=point.notes;const ideal=document.createElement('strong');ideal.textContent=point.type==='stand'?windStatusLabel(point):'';box.append(strong,kind,winds,observed,ideal,notes);return box;}
  function draw(){
    if(!map)return;
    Object.values(markers).forEach(m=>map.removeLayer(m));markers={};
    for(const point of state.points){
      const marker=L.marker([point.lat,point.lon],{title:point.name,alt:`${point.name}, ${TYPES[point.type]} location`,icon:point.type==='stand'?pinIcon(point):undefined}).addTo(map).bindPopup(popupNode(point));
      markers[point.id]=marker;
    }
    for(const layer of boundaryLayers)map.removeLayer(layer);boundaryLayers=[];
    for(const parcel of state.parcels||[]){const layer=L.polygon(parcel.coordinates,{color:'#8fc49a',weight:3,fillColor:'#5d986b',fillOpacity:.13}).addTo(map).bindTooltip(parcel.name);boundaryLayers.push(layer);}
    if(lastFix){if(gpsMarker)map.removeLayer(gpsMarker);if(accuracyCircle)map.removeLayer(accuracyCircle);gpsMarker=L.circleMarker([lastFix.lat,lastFix.lon],{radius:8,color:'#fff',weight:3,fillColor:'#277bd1',fillOpacity:1}).addTo(map).bindPopup('Your current GPS location');accuracyCircle=L.circle([lastFix.lat,lastFix.lon],{radius:lastFix.accuracy||0,color:'#277bd1',weight:1,fillOpacity:.08}).addTo(map);}
  }
  function renderList(){
    const root=$('pointList');root.replaceChildren();
    if(!state.points.length){const empty=document.createElement('div');empty.className='sub';empty.textContent='No locations saved yet.';root.append(empty);return;}
    for(const point of state.points){
      const item=document.createElement('article');item.className='item';
      const name=document.createElement('div');name.className='itemname';name.textContent=point.name;
      const meta=document.createElement('div');meta.className='itemmeta';meta.textContent=`${TYPES[point.type]} · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · GPS ±${point.accuracy?Math.round(point.accuracy)+' m':'unknown'}`;
      const wind=document.createElement('div');wind.className='itemmeta';wind.textContent=(point.winds.length?'Ideal wind FROM: '+point.winds.join(', '):'No ideal wind set')+(point.windFromDeg!==null?` · Observed FROM ${compass16(point.windFromDeg)}`:'')+(point.type==='stand'?` · ${windStatusLabel(point)}`:'');
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
    $('weatherSummary').textContent=`${w.summary||'Forecast loaded'}${w.locationLabel?' · '+w.locationLabel:''}${w.startTime?' · '+w.startTime:''}${w.fetchedAt?' · Updated '+new Date(w.fetchedAt).toLocaleString():''}`;
  }
  function renderAdvisor(){
    const stands=state.points.filter(p=>p.type==='stand');let message='';
    const ranked=$('rankedStands');ranked.replaceChildren();
    const forecastAge=state.weather?.fetchedAt?Date.now()-Date.parse(state.weather.fetchedAt):Infinity;
    const forecastFresh=!!state.weather&&!weatherRefreshFailed&&Number.isFinite(forecastAge)&&forecastAge>=0&&forecastAge<=3*60*60*1000&&!!state.weather.windSector;
    const hasObserved=stands.some(s=>s.windFromDeg!==null);
    if(!stands.length)message='Save a tree stand or blind with GPS to start.';
    else if(!forecastFresh&&!hasObserved){
      if(!state.weather)message='Your stands are saved. Load a nearby NWS forecast or record an observed wind direction on the map.';
      else if(weatherRefreshFailed)message='The latest NWS refresh failed. Record a field-observed wind direction on the map or retry the forecast.';
      else if(!state.weather.windSector)message='The NWS forecast reports variable or unsupported wind direction. Record a field-observed wind direction on the map.';
      else message='The saved forecast is older than 3 hours. Refresh before using a forecast-based wind recommendation.';
    }else{
      const sorted=stands.map(s=>{const wind=s.windFromDeg!==null?windSector(compass16(s.windFromDeg)):(forecastFresh?state.weather.windSector:null);return {stand:s,wind,match:!!wind&&s.winds.includes(wind),configured:s.winds.length>0,observed:s.windFromDeg!==null};}).sort((a,b)=>Number(b.match)-Number(a.match)||Number(b.configured)-Number(a.configured));
      const matches=sorted.filter(x=>x.match);
      message=`${forecastFresh?`NWS regional wind FROM ${state.weather.windSector}, ${Math.round(state.weather.windSpeedMinMph)}–${Math.round(state.weather.windSpeedMaxMph)} mph. `:''}${matches.length?`Safe-wind match: ${matches.map(x=>x.stand.name+(x.observed?' (field observed)':'')).join(', ')}.`:'No configured stand matches the available wind direction.'} Field observations override the regional forecast for that stand. This is a wind-rule comparison, not a deer-activity prediction.`;
      for(const [i,item] of sorted.entries()){
        const row=document.createElement('div');row.className='rank-item';const label=document.createElement('div');const name=document.createElement('strong');name.textContent=`${i+1}. ${item.stand.name}`;const detail=document.createElement('div');detail.className='itemmeta';detail.textContent=item.wind?(item.match?`Wind match · wind FROM ${item.wind}`:`No match · wind FROM ${item.wind}`)+(item.observed?' · field observed':' · NWS forecast'):'No current wind direction';label.append(name,detail);const score=document.createElement('div');score.className='rank-score';score.textContent=item.match?'✓':'—';score.setAttribute('aria-label',item.match?'Wind match':'No match');row.append(label,score);ranked.append(row);
      }
    }
    $('advisor').textContent=message;
    renderScentControls();
    renderHourlyReport();
  }
  function renderScentControls(){
    const windSelect=$('windStandSelect');if(windSelect){const selected=windSelect.value;windSelect.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Choose a saved stand';windSelect.append(blank);for(const stand of state.points.filter(p=>p.type==='stand')){const option=document.createElement('option');option.value=stand.id;option.textContent=stand.name;windSelect.append(option);}if(selected)windSelect.value=selected;}
    const idealSelect=$('idealWindStandSelect');if(idealSelect){const keep=idealSelect.value;idealSelect.replaceChildren();const opt=document.createElement('option');opt.value='';opt.textContent='Choose a stand';idealSelect.append(opt);for(const stand of state.points.filter(p=>p.type==='stand')){const o=document.createElement('option');o.value=stand.id;o.textContent=stand.name;idealSelect.append(o);}if(keep)idealSelect.value=keep;}const select=$('scentStand');if(!select)return;const prior=select.value;select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a saved stand';select.append(placeholder);
    for(const stand of state.points.filter(p=>p.type==='stand')){const option=document.createElement('option');option.value=stand.id;option.textContent=stand.name;select.append(option);}if(prior)select.value=prior;
    const hourly=$('hourlyStandSelect');if(hourly){const selected=hourly.value;hourly.replaceChildren();const blankHourly=document.createElement('option');blankHourly.value='';blankHourly.textContent='Choose a stand';hourly.append(blankHourly);for(const stand of state.points.filter(p=>p.type==='stand')){const opt=document.createElement('option');opt.value=stand.id;opt.textContent=stand.name;hourly.append(opt);}if(selected)hourly.value=selected;else if(state.points.some(p=>p.type==='stand'))hourly.value=state.points.find(p=>p.type==='stand').id;}
    if(!state.weather||!Number.isFinite(state.weather.windSpeedMinMph))$('scentStatus').textContent='Load a local forecast to provide wind speed for the plume.';
    else $('scentStatus').textContent='Choose a stand. A field-observed wind direction at that stand takes priority over the NWS regional direction.';
  }
  function renderHourlyReport(){
    const root=$('hourlyWindReport');if(!root)return;root.replaceChildren();
    const stand=state.points.find(p=>p.id===$('hourlyStandSelect')?.value&&p.type==='stand');
    const periods=state.weather?.hourly||[];
    if(!stand){root.textContent='Save a stand and choose it to see the hourly outlook.';return;}
    if(!periods.length){root.textContent='No hourly forecast is saved yet. Refresh the forecast at this stand to load the next 24 hours.';return;}
    if(!stand.winds?.length){root.textContent='Set Ideal Wind directions for this stand to calculate meaningful hourly scores.';return;}
    const now=Date.now(),future=periods.filter(h=>Date.parse(h.startTime)>=now-30*60*1000).slice(0,168);
    if(!future.length){root.textContent='The saved hourly forecast has expired. Refresh the forecast at this stand.';return;}
    const scored=future.map(h=>{const score=!h.windSector?50:(stand.winds.includes(h.windSector)?100:0);return {...h,score};});
    const avg=Math.round(scored.reduce((sum,h)=>sum+h.score,0)/scored.length),ideal=scored.filter(h=>h.score===100),best=ideal[0];const daily=new Map();for(const h of scored){const key=new Date(h.startTime).toLocaleDateString();if(!daily.has(key))daily.set(key,[]);daily.get(key).push(h);}
    const summary=document.createElement('div');summary.className='row between';
    const average=document.createElement('div');const big=document.createElement('div');big.className='metric';big.textContent=`${avg}/100`;const label=document.createElement('div');label.className='sub';label.textContent='Average score across available forecast hours';average.append(big,label);
    const windows=document.createElement('div');windows.style.textAlign='right';const count=document.createElement('strong');count.textContent=`${ideal.length} of ${scored.length} hours`;const caption=document.createElement('div');caption.className='sub';caption.textContent='forecast as ideal';windows.append(count,caption);summary.append(average,windows);root.append(summary);
    const dailyTitle=document.createElement('h3');dailyTitle.textContent='Seven-day outlook';dailyTitle.style.margin='12px 0 4px';root.append(dailyTitle);
    const dailyScroll=document.createElement('div');dailyScroll.className='hourly-scroll';const dailyTable=document.createElement('table');dailyTable.className='hourly-table';const dailyHead=document.createElement('thead'),dailyHeadRow=document.createElement('tr');for(const title of ['Day','Avg score','Ideal hours']){const th=document.createElement('th');th.textContent=title;dailyHeadRow.append(th);}dailyHead.append(dailyHeadRow);dailyTable.append(dailyHead);const dailyBody=document.createElement('tbody');for(const [day,hours] of daily){const row=document.createElement('tr'),dayCell=document.createElement('td'),avgCell=document.createElement('td'),idealCell=document.createElement('td');dayCell.textContent=new Date(hours[0].startTime).toLocaleDateString([], {weekday:'short',month:'numeric',day:'numeric'});const dayScore=Math.round(hours.reduce((sum,h)=>sum+h.score,0)/hours.length);avgCell.textContent=`${dayScore}/100`;idealCell.textContent=`${hours.filter(h=>h.score===100).length}/${hours.length}`;row.append(dayCell,avgCell,idealCell);dailyBody.append(row);}dailyTable.append(dailyBody);dailyScroll.append(dailyTable);root.append(dailyScroll);
    const hourlyTitle=document.createElement('h3');hourlyTitle.textContent='Next 24 hours · hour by hour';hourlyTitle.style.margin='14px 0 4px';root.append(hourlyTitle);
    const next24=scored.slice(0,24);
    const scroll=document.createElement('div');scroll.className='hourly-scroll';const table=document.createElement('table');table.className='hourly-table';const thead=document.createElement('thead'),head=document.createElement('tr');for(const title of ['Time','Wind FROM','Speed','Temp','Score']){const th=document.createElement('th');th.textContent=title;head.append(th);}thead.append(head);table.append(thead);const tbody=document.createElement('tbody');
    for(const h of next24){const row=document.createElement('tr');row.className=h.score===100?'ideal-hour':h.score===0?'bad-hour':'';const time=new Date(h.startTime);const cells=[time.toLocaleString([], {weekday:'short',hour:'numeric'}),h.windDirectionRaw||'Variable',h.windSpeedMinMph===null?'—':`${Math.round(h.windSpeedMinMph)}–${Math.round(h.windSpeedMaxMph??h.windSpeedMinMph)} mph`,h.temperature===null?'—':`${Math.round(h.temperature)}°${h.temperatureUnit||'F'}`];for(const value of cells){const td=document.createElement('td');td.textContent=value;row.append(td);}const scoreCell=document.createElement('td');const badge=document.createElement('span');badge.className=`score-pill ${h.score===100?'good':h.score===0?'bad':'unknown'}`;badge.textContent=h.score===50?'50 · ?':`${h.score}`;scoreCell.append(badge);row.append(scoreCell);tbody.append(row);}table.append(tbody);scroll.append(table);root.append(scroll);
    const bestNote=document.createElement('p');bestNote.className='sub';bestNote.textContent=best?`First ideal forecast hour: ${new Date(best.startTime).toLocaleString([], {weekday:'long',hour:'numeric',minute:'2-digit'})}. `:'No ideal-wind hours appear in this forecast window. ';bestNote.textContent+='Scores compare forecast wind direction with your saved Ideal Wind only; they are not deer-activity probabilities.';root.append(bestNote);
  }
  function compass16(deg){const labels=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];return labels[Math.round(((deg%360)+360)%360/22.5)%16];}
  function bearingBetween(a,b){const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180,y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return (Math.atan2(y,x)*180/Math.PI+360)%360;}
  function destination(lat,lon,bearingDeg,distanceM){const R=6371000,b=bearingDeg*Math.PI/180,p1=lat*Math.PI/180,l1=lon*Math.PI/180,d=distanceM/R;const p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(b));const l2=l1+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));return [p2*180/Math.PI,((l2*180/Math.PI+540)%360)-180];}
  function clearScent(){
    if(scentFrame)cancelAnimationFrame(scentFrame);scentFrame=0;
    scentLayers.forEach(layer=>{if(map)map.removeLayer(layer);});scentLayers=[];
  }
  function drawScent(){
    clearScent();const id=$('scentStand').value,stand=state.points.find(p=>p.id===id);if(!stand||!state.weather||!Number.isFinite(state.weather.windSpeedMinMph)){setStatus('scentStatus','Choose a stand and load a local forecast for wind speed first.','error');return;}if(stand.windFromDeg===null&&!state.weather.windSector){setStatus('scentStatus','This stand has no field-observed wind direction and the forecast direction is variable.','error');return;}
    const from=stand.windFromDeg===null?DIRECTIONS.indexOf(state.weather.windSector)*45:stand.windFromDeg,to=(from+180)%360,speed=(state.weather.windSpeedMinMph+state.weather.windSpeedMaxMph)/2;
    const length=Math.max(100,Math.min(650,160+speed*22));const spread=Math.max(15,Math.min(48,19+speed*.9));
    const center=[stand.lat,stand.lon];
    // Smooth, widening footprint: a series of cross-sections instead of a triangular arrow.
    const left=[],right=[];
    for(let i=0;i<=12;i++){const t=i/12,dist=length*t,fanAngle=Math.min(52,spread*t);left.push(destination(stand.lat,stand.lon,to-fanAngle,dist));right.unshift(destination(stand.lat,stand.lon,to+fanAngle,dist));}
    const outline=[...left,...right];
    if(map){
      const haze=L.polygon(outline,{color:'#e18a38',weight:1,fillColor:'#e18a38',fillOpacity:.13,interactive:false,className:'cso-scent-plume'}).addTo(map);
      const core=L.polygon([left[0],...left.slice(3,10),...right.slice(3,10),right[right.length-1]],{color:'#f0a04d',weight:1,fillColor:'#f0a04d',fillOpacity:.10,interactive:false,className:'cso-scent-edge'}).addTo(map);
      const axis=L.polyline([center,destination(stand.lat,stand.lon,to,length)],{color:'#ffd08b',weight:1.5,opacity:.65,dashArray:'3 10',interactive:false}).addTo(map);
      const marker=L.circleMarker(center,{radius:8,color:'#fff',weight:2,fillColor:'#87bd8d',fillOpacity:1}).addTo(map).bindPopup(`${stand.name} · scent source`);
      scentLayers.push(haze,core,axis,marker);
      const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!reduced){
        const particles=[];let last=0;
        for(let i=0;i<280;i++){const bright=i%11===0,particle=L.circleMarker(center,{radius:bright?1.8:(i%3===0?1.25:.8),stroke:false,fillColor:bright?'#fff3d4':(i%3===0?'#ffd08b':'#e18a38'),fillOpacity:.9,interactive:false}).addTo(map);particles.push({layer:particle,phase:((i*73)%280)/280,side:((i*137)%201-100)/100,twinkle:(i%13)/13,seed:i});scentLayers.push(particle);}
        const animate=now=>{if(!scentVisible||!map)return;if(now-last>20){last=now;const rate=Math.max(.010,Math.min(.020,.012+speed*.00045));for(const item of particles){item.phase=(item.phase+rate*(.75+item.twinkle*.8))%1;const t=item.phase,spreadMeters=(spread*t*t+2)*item.side;const bearing=to+(spreadMeters/Math.max(24,length*t))*42;const point=destination(stand.lat,stand.lon,bearing,length*t);item.layer.setLatLng(point);item.layer.setStyle({fillOpacity:.25+.72*Math.sin(Math.PI*t),radius:(item.seed%11===0?1.7:1.0)+(1-t)*.9});}}scentFrame=requestAnimationFrame(animate);};
        scentFrame=requestAnimationFrame(animate);
      }
      map.fitBounds(haze.getBounds().pad(.45));
    }
    const toDir=DIRECTIONS[Math.round(to/45)%8];setStatus('scentStatus',`Scent is projected generally ${toDir} from ${stand.name}. Wind FROM ${compass16(from)}${stand.windFromDeg!==null?' (field observed)':' (NWS forecast)'} at ${Math.round(state.weather.windSpeedMinMph)}–${Math.round(state.weather.windSpeedMaxMph)} mph. The widening cloud and moving particles illustrate dispersion, not a measured scent boundary.`,'success');
  }
  function editIdealWind(){
    const stand=state.points.find(p=>p.id===$('idealWindStandSelect').value&&p.type==='stand');
    if(!stand){showToast('Choose a saved stand first.');return;}
    selectedWindDirs.clear();stand.winds.forEach(dir=>selectedWindDirs.add(dir));
    $('windChecks').querySelectorAll('[data-direction]').forEach(button=>button.setAttribute('aria-pressed',String(selectedWindDirs.has(button.dataset.direction))));
    $('idealWindEditStatus').textContent=`Editing ideal wind for ${stand.name}. Tap all wind directions that keep your scent away from deer, then save.`;
    $('saveIdealWindBtn').disabled=false;$('windChecks').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function saveIdealWind(){
    const stand=state.points.find(p=>p.id===$('idealWindStandSelect').value&&p.type==='stand');
    if(!stand){showToast('Choose a saved stand first.');return;}
    const winds=DIRECTIONS.filter(dir=>selectedWindDirs.has(dir));
    try{saveState({...state,points:state.points.map(p=>p.id===stand.id?{...p,winds}:p)});$('saveIdealWindBtn').disabled=true;$('idealWindEditStatus').textContent=`Ideal wind saved for ${stand.name}: ${winds.length?winds.join(', '):'none selected'}.`;renderAll();showToast(`Ideal wind updated for ${stand.name}.`);}catch(err){showToast(err.message);}
  }
  async function searchMapPlace(){
    const query=$('mapSearch').value.trim();if(!query){showToast('Enter a town, road, address, or place to find.');return;}
    if(!navigator.onLine){showToast('Map search needs an internet connection.');return;}
    const button=$('mapSearchBtn');button.disabled=true;button.textContent='Searching…';
    try{
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q='+encodeURIComponent(query);
      const response=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Place search is temporarily unavailable.');
      const results=await response.json();if(!Array.isArray(results)||!results.length)throw new Error('No matching town, road, or address found. Try adding the county or state.');
      const result=results[0],lat=Number(result.lat),lon=Number(result.lon);if(!finiteCoord(lat,lon))throw new Error('The map search returned an invalid location.');
      map.setView([lat,lon],Math.max(map.getZoom(),15));setStatus('mapStatus',`Map centered on ${cleanText(result.display_name,180)}. You can now add a stand or draw a property boundary here.`,'success');
    }catch(err){showToast(err.name==='TimeoutError'?'Place search timed out. Try again.':err.message||'Place search failed.');}
    finally{button.disabled=false;button.textContent='Find on map';}
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
  async function recenterMapToGPS(){
    if(lastFix&&map)map.setView([lastFix.lat,lastFix.lon],17,{animate:false});
    const button=$('recenterGpsBtn');await withGpsButton(button,async fix=>{if(map)map.setView([fix.lat,fix.lon],17,{animate:false});setStatus('mapStatus',`Map recentered on your live GPS fix (±${Math.round(fix.accuracy)} m). Browse anywhere, then tap LIVE GPS to snap back.`,fix.accuracy>100?'error':'success');});
  }
  async function withGpsButton(button,action){button.disabled=true;const old=button.textContent;button.textContent='Getting GPS…';try{const fix=await getGPS();await action(fix);}catch(err){setStatus('gpsStatus',err.message,'error');showToast(err.message);}finally{button.disabled=false;button.textContent=old;}}
  function deletePoint(id){const next={...state,points:state.points.filter(p=>p.id!==id)};try{saveState(next);renderAll();showToast('Location deleted.');}catch(err){showToast(err.message);}}
  function updateProperty(fix){const next={...state,property:{name:$('propertyName').value.trim()||'My Property',lat:fix.lat,lon:fix.lon}};try{saveState(next);renderAll();showToast('Property center saved on this device.');}catch(err){showToast(err.message);}}
  function setMapMode(mode){mapMode=mode;pendingMapPoint=null;boundaryVertices=[];if(boundaryPreview&&map){map.removeLayer(boundaryPreview);boundaryPreview=null;}$('finishBoundaryBtn').disabled=mode!=='boundary';$('cancelMapModeBtn').disabled=mode==='idle';$('manualPointBtn').classList.toggle('bigbtn',mode==='point');$('drawBoundaryBtn').classList.toggle('bigbtn',mode==='boundary');$('mapModeHelp').textContent=mode==='point'?'Tap the map where the stand, camera, or other location should be saved.':mode==='boundary'?'Tap each corner or bend of the property boundary, then tap Finish boundary. At least 3 points are required.':mode==='wind'?'Tap the map in the direction the wind is coming FROM, relative to the selected stand. North is the top of the map.':'Plan from home: tap Add location, then tap the map. For a boundary, tap around the property edges and finish.';}
  function handleMapClick(latlng){if(!map)return;if(mapMode==='wind'){const stand=state.points.find(p=>p.id===$('windStandSelect').value);if(!stand){showToast('Choose a stand first.');return;}const deg=bearingBetween({lat:stand.lat,lon:stand.lon},{lat:latlng.lat,lon:latlng.lng});const snapped=Math.round(deg/22.5)*22.5%360;const nextPoints=state.points.map(p=>p.id===stand.id?{...p,windFromDeg:snapped,windObservedAt:new Date().toISOString()}:p);try{saveState({...state,points:nextPoints});const end=[latlng.lat,latlng.lng];if(window.windDirectionLayer)map.removeLayer(window.windDirectionLayer);window.windDirectionLayer=L.polyline([[stand.lat,stand.lon],end],{color:'#f5c16c',weight:4,dashArray:'7 5'}).addTo(map);if(window.windDirectionTip)map.removeLayer(window.windDirectionTip);window.windDirectionTip=L.circleMarker(end,{radius:7,color:'#fff',weight:2,fillColor:'#f5c16c',fillOpacity:1}).addTo(map);setMapMode('idle');renderAll();showToast(`Observed wind FROM ${compass16(snapped)} saved for ${stand.name}.`);}catch(err){showToast(err.message);}return;}if(mapMode==='point'){pendingMapPoint={lat:latlng.lat,lon:latlng.lng,accuracy:null};const marker=L.marker([latlng.lat,latlng.lng],{draggable:true}).addTo(map).bindPopup('Planned location — save it from the form below.').openPopup();marker.on('dragend',()=>{const p=marker.getLatLng();pendingMapPoint={lat:p.lat,lon:p.lng,accuracy:null};});if(window.pendingMarker)map.removeLayer(window.pendingMarker);window.pendingMarker=marker;$('mapModeHelp').textContent=`Selected map point: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}. Choose type/name in the Save a spot form, then tap SAVE SELECTED MAP POINT.`;$('saveMapPoint').disabled=false;return;}if(mapMode==='boundary'){boundaryVertices.push([latlng.lat,latlng.lng]);if(boundaryPreview)map.removeLayer(boundaryPreview);boundaryPreview=L.polyline(boundaryVertices,{color:'#e18a38',weight:3,dashArray:'6 5'}).addTo(map);$('mapModeHelp').textContent=`Boundary vertices: ${boundaryVertices.length}. Tap around the edges; finish when you have at least 3 points.`;}}
  function finishBoundary(){if(boundaryVertices.length<3){showToast('Add at least 3 boundary points first.');return;}const name=prompt('Name this property boundary:','My Property');if(name===null)return;const parcel={id:newId(),name:cleanText(name.trim(),80)||'Property boundary',coordinates:boundaryVertices.slice()};try{saveState({...state,parcels:[...(state.parcels||[]),parcel]});setMapMode('idle');renderAll();showToast('Property boundary saved on this device.');}catch(err){showToast(err.message);}}
  function saveMapPoint(){if(!pendingMapPoint){showToast('Tap the map to select a location first.');return;}try{savePoint(pendingMapPoint);if(window.pendingMarker&&map){map.removeLayer(window.pendingMarker);window.pendingMarker=null;}pendingMapPoint=null;setMapMode('idle');}catch(err){showToast(err.message);}}
  function savePoint(fix){
    const type=$('pointType').value;if(!Object.hasOwn(TYPES,type))throw new Error('Choose a valid location type.');
    const winds=type==='stand'?DIRECTIONS.filter(dir=>selectedWindDirs.has(dir)):[];
    const count=state.points.filter(p=>p.type===type).length+1;
    const point={id:newId(),name:$('pointName').value.trim()||`${TYPES[type]} ${count}`,type,winds,notes:$('pointNotes').value.trim(),lat:fix.lat,lon:fix.lon,accuracy:fix.accuracy,windFromDeg:null,windObservedAt:'',created:new Date().toISOString()};
    const next={...state,points:[...state.points,point]};saveState(next);$('pointName').value='';$('pointNotes').value='';selectedWindDirs.clear();$('windChecks').querySelectorAll('[data-direction]').forEach(x=>x.setAttribute('aria-pressed','false'));renderAll();showToast(`${point.name} saved on this device.`);
  }
  async function fetchWithTimeout(url,options,ms=16000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
  async function loadWeather(locationOverride=null){
    weatherRefreshFailed=false;
    $('weatherBtn').disabled=true;const old=$('weatherBtn').textContent;$('weatherBtn').textContent='Loading forecast…';setStatus('weatherSummary','Requesting the nearby NWS hourly forecast…','');
    try{
      let lat=locationOverride?.lat??state.property.lat,lon=locationOverride?.lon??state.property.lon;
      if(lat===null||lon===null){const fix=await getGPS();lat=fix.lat;lon=fix.lon;locationOverride=fix;}
      // Keep requests simple for browser CORS. Browser JavaScript cannot set a custom User-Agent; NWS recommends an identifying User-Agent, so a server-side proxy may be needed if direct browser access is restricted or rate-limited.
      const pointResponse=await fetchWithTimeout(`https://api.weather.gov/points/${lat},${lon}`,{headers:{Accept:'application/geo+json'}});
      if(!pointResponse.ok)throw new Error(`NWS location lookup returned HTTP ${pointResponse.status}.`);
      const pointData=await pointResponse.json(),hourlyUrl=pointData.properties?.forecastHourly;
      if(!hourlyUrl)throw new Error('NWS did not provide an hourly forecast for this location.');
      const forecastResponse=await fetchWithTimeout(hourlyUrl,{headers:{Accept:'application/geo+json'}});
      if(!forecastResponse.ok)throw new Error(`NWS hourly forecast returned HTTP ${forecastResponse.status}.`);
      const forecast=await forecastResponse.json(),periods=(forecast.properties?.periods||[]).slice(0,168);if(!periods.length)throw new Error('NWS returned no hourly forecast periods.');
      const hourly=periods.map(h=>{let speed=null;try{speed=parseWindSpeed(h.windSpeed);}catch(_){ }return {startTime:cleanText(h.startTime||'',40),windDirectionRaw:cleanText(h.windDirection||'',20),windSector:windSector(h.windDirection),windSpeedMinMph:speed?.min??null,windSpeedMaxMph:speed?.max??null,temperature:Number.isFinite(Number(h.temperature))?Number(h.temperature):null,temperatureUnit:cleanText(h.temperatureUnit||'F',2),summary:cleanText(h.shortForecast||'',120),isDaytime:!!h.isDaytime};}).filter(h=>h.startTime);
      const first=hourly[0];const min=first.windSpeedMinMph??0,max=first.windSpeedMaxMph??min;
      const next={...state,weather:{windSector:first.windSector,windDirectionRaw:first.windDirectionRaw,windSpeedMinMph:min,windSpeedMaxMph:max,temperature:first.temperature===null?'':String(first.temperature),temperatureUnit:first.temperatureUnit,summary:first.summary,startTime:first.startTime,hourly,fetchedAt:new Date().toISOString(),lat,lon,locationLabel:locationOverride?.label|| (locationOverride?.accuracy!==undefined?'Current GPS position':'Selected forecast point')}};
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
  function updateConnection(){const online=navigator.onLine;$('connectionStatus').textContent=online?'ONLINE':'OFFLINE · saved data available';$('connectionStatus').classList.toggle('bad',!online);if(!online)setStatus('mapStatus','You are offline. Saved data works; live map tiles and NWS forecasts need internet.','error');else if(map)setStatus('mapStatus','Online · Street names and satellite map layers load from the internet.','');}
  function registerWorker(){if('serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js').catch(err=>setStatus('mapStatus','Offline app-shell setup failed: '+err.message,'error'));}}

  $('locateBtn').dataset.originalLabel=$('locateBtn').textContent;
  $('saveProperty').dataset.originalLabel=$('saveProperty').textContent;
  $('savePoint').dataset.originalLabel=$('savePoint').textContent;
  makeWindChecks();loadState();$('propertyName').value=state.property.name||'';makeMap();renderAll();updateConnection();
  $('locateBtn').addEventListener('click',()=>withGpsButton($('locateBtn'),async()=>showToast('Your location is shown on the map.')));
  $('saveProperty').addEventListener('click',()=>withGpsButton($('saveProperty'),async fix=>updateProperty(fix)));
  $('savePoint').addEventListener('click',()=>withGpsButton($('savePoint'),async fix=>{try{savePoint(fix);}catch(err){showToast(err.message);}}));
  $('weatherBtn').addEventListener('click',loadWeather);
  $('recenterGpsBtn').addEventListener('click',recenterMapToGPS);
  $('hourlyStandSelect').addEventListener('change',renderHourlyReport);
  $('mapSearchBtn').addEventListener('click',searchMapPlace);$('mapSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchMapPlace();}});
  $('editIdealWindBtn').addEventListener('click',editIdealWind);$('saveIdealWindBtn').addEventListener('click',saveIdealWind);
  $('manualPointBtn').addEventListener('click',()=>{setMapMode('point');$('mapModeHelp').textContent='Tap the map where you want to place the location.';});
  $('drawBoundaryBtn').addEventListener('click',()=>setMapMode('boundary'));
  $('finishBoundaryBtn').addEventListener('click',finishBoundary);
  $('cancelMapModeBtn').addEventListener('click',()=>{if(window.pendingMarker&&map){map.removeLayer(window.pendingMarker);window.pendingMarker=null;}$('saveMapPoint').disabled=true;setMapMode('idle');});
  $('saveMapPoint').addEventListener('click',saveMapPoint);
  $('setWindFromMapBtn').addEventListener('click',()=>{const stand=state.points.find(p=>p.id===$('windStandSelect').value);if(!stand){showToast('Choose a saved stand first.');return;}setMapMode('wind');map.setView([stand.lat,stand.lon],17);$('mapModeHelp').textContent=`Stand centered. Tap the map in the direction the wind is coming FROM for ${stand.name}. North is at the top.`;});
  $('windForecastBtn').addEventListener('click',()=>{const stand=state.points.find(p=>p.id===$('windStandSelect').value);if(!stand){showToast('Choose a saved stand first.');return;}loadWeather({lat:stand.lat,lon:stand.lon,label:`${stand.name} coordinates`});});
  $('gpsForecastBtn').addEventListener('click',()=>withGpsButton($('gpsForecastBtn'),async fix=>loadWeather({...fix,label:'Current GPS position'}))); 
  $('scentToggle').addEventListener('click',()=>{scentVisible=!scentVisible;$('scentToggle').textContent=scentVisible?'Hide scent plume':'Show scent plume';$('scentToggle').setAttribute('aria-pressed',String(scentVisible));if(scentVisible)drawScent();else{clearScent();setStatus('scentStatus','Scent plume hidden.','');}});
  $('scentStand').addEventListener('change',()=>{if(scentVisible)drawScent();});
  $('exportBtn').addEventListener('click',exportBackup);
  $('restoreFile').addEventListener('change',event=>restoreBackup(event.target.files?.[0]));
  window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
  if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>showToast('CSO offline app shell updated.'));
  registerWorker();
})();
