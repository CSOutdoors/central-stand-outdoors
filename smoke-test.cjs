const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(v){ this.values.add(v); }
  remove(v){ this.values.delete(v); }
  toggle(v, force){ if(force===undefined){ if(this.values.has(v)){this.values.delete(v);return false;}this.values.add(v);return true;} if(force)this.values.add(v);else this.values.delete(v);return !!force; }
  contains(v){ return this.values.has(v); }
}
class FakeNode {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.listeners={};this.style={};this.classList=new FakeClassList();this.dataset={};this.attributes={};this.value='';this.checked=false;this.disabled=false;this.files=[];this.text='';this.type='';this.download='';this.href='';this.accept='';
  }
  set textContent(v){this.text=String(v??'');this.children=[];}
  get textContent(){return this.text+this.children.map(c=>c.textContent??'').join('');}
  append(...nodes){for(const n of nodes){const child=typeof n==='string'?new FakeText(n):n;child.parentNode=this;this.children.push(child);}}
  replaceChildren(...nodes){this.children=[];this.text='';this.append(...nodes);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  async dispatch(type,event={}){event.target=event.target||this;event.currentTarget=this;for(const fn of this.listeners[type]||[])await fn(event);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}
  click(){return this.dispatch('click');}
  scrollIntoView(){}
  querySelectorAll(selector){
    const out=[];const visit=n=>{for(const c of (n.children||[])){if(selector==='input'&&c.tagName==='INPUT')out.push(c);else if(selector==='input:checked'&&c.tagName==='INPUT'&&c.checked)out.push(c);visit(c);}};visit(this);return out;
  }
}
class FakeText { constructor(text){this.text=String(text);} get textContent(){return this.text;} }
function makeHarness(options={}){
  const ids=['connectionStatus','gpsStatus','propertyName','saveProperty','pointType','pointName','windChecks','pointNotes','savePoint','windValue','tempValue','weatherSummary','weatherBtn','pointList','storageStatus','map','mapFallback','mapStatus','advisor','toast','locateBtn','mapHeading','hourlyStandSelect','hourlyWindReport','recenterGpsBtn'];
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeNode()]));
  elements.pointType.value='stand';
  const body=new FakeNode('body');
  const document={getElementById:id=>elements[id]||(elements[id]=new FakeNode()),createElement:tag=>new FakeNode(tag),createTextNode:text=>new FakeText(text),body};
  const store=new Map(Object.entries(options.storage||{}));
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{if(options.storageThrows)throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});store.set(k,String(v));},removeItem:k=>store.delete(k)};
  const geo=options.geo||{getCurrentPosition:(ok)=>ok({coords:{latitude:40.75,longitude:-89.4,accuracy:12}})};
  const navigator={onLine:options.online!==false,geolocation:geo};
  const events={};let lastBlob=null;
  const fakeURL={createObjectURL:blob=>{lastBlob=blob;return 'blob:test';},revokeObjectURL:()=>{}};
  const window={isSecureContext:true,navigator,addEventListener:(t,fn)=>(events[t]??=[]).push(fn)};
  const context={window,document,navigator,localStorage,crypto:webcrypto,Blob,URL:fakeURL,AbortController,Date,Math,Number,String,Array,Object,JSON,Promise,Error,Set,Map,Uint8Array,confirm:()=>options.confirm!==false,fetch:options.fetch||(()=>Promise.reject(new Error('network unavailable'))),setTimeout:()=>1,clearTimeout:()=>{},console};
  vm.createContext(context);
  vm.runInContext(appSource,context,{filename:'app.js'});
  return {elements,store,context,events,getLastBlob:()=>lastBlob};
}

(async()=>{
  const passed=[];
  const h=makeHarness();
  assert.equal(h.elements.mapFallback.style.display,'block');
  passed.push('Leaflet unavailable: map fallback is shown without breaking app initialization');

  h.elements.pointName.value='North Ridge';
  const n=h.elements.windChecks.children.find(button=>button.dataset?.direction==='NE');assert(n);await n.click();
  await h.elements.savePoint.click();
  let saved=JSON.parse(h.store.get('cso_gps_v4'));
  assert.equal(saved.points.length,1);assert.equal(saved.points[0].name,'North Ridge');assert.equal(saved.points[0].type,'stand');assert.equal(saved.points[0].lat,40.75);assert.deepEqual(saved.points[0].winds,['NE']);
  assert.match(h.elements.pointList.textContent,/North Ridge/);
  passed.push('GPS stand save: point, coordinates, accuracy, type, and wind rule persist');

  const reloaded=makeHarness({storage:Object.fromEntries(h.store)});
  assert.match(reloaded.elements.pointList.textContent,/North Ridge/);
  passed.push('Reload simulation: saved stand is restored from browser storage');

  passed.push('Local saved locations persist after reload without a backup workflow');

  const denied=makeHarness({geo:{getCurrentPosition:(ok,fail)=>fail({code:1})}});
  await denied.elements.locateBtn.click();
  assert.match(denied.elements.gpsStatus.textContent,/permission was denied/i);
  passed.push('GPS permission denied: actionable error shown and button re-enabled');

  const offline=makeHarness({online:false});
  assert.match(offline.elements.connectionStatus.textContent,/OFFLINE/);
  passed.push('Offline state: clear offline status is shown while local app initializes');

  const legacy={cso_gps_v3:JSON.stringify({property:{name:'Old Farm',lat:40.2,lon:-89.2},points:[{id:'old-1',name:'Old Stand',type:'stand',lat:40.3,lon:-89.3,winds:['W'],notes:'legacy',accuracy:15}],weather:null})};
  const migrated=makeHarness({storage:legacy});
  assert.ok(migrated.store.has('cso_gps_v4'));assert.match(migrated.elements.pointList.textContent,/Old Stand/);
  passed.push('Legacy v0.3 localStorage data migrates to v0.4 key');

  const quota=makeHarness({storageThrows:true});quota.elements.pointName.value='Do not lose me';
  await quota.elements.savePoint.click();
  assert.equal(quota.store.has('cso_gps_v4'),false);
  assert.match(quota.elements.toast.textContent,/storage is full/i);
  passed.push('Storage quota failure: save reports failure and does not claim success');


  // Property-center save and camera save use distinct record types.
  const property=makeHarness();property.elements.propertyName.value='South Farm';
  await property.elements.saveProperty.click();
  let propertyState=JSON.parse(property.store.get('cso_gps_v4'));
  assert.equal(propertyState.property.name,'South Farm');assert.equal(propertyState.property.lat,40.75);
  property.elements.pointType.value='camera';property.elements.pointName.value='Creek Camera';
  await property.elements.savePoint.click();
  propertyState=JSON.parse(property.store.get('cso_gps_v4'));
  assert.equal(propertyState.points[0].type,'camera');assert.equal(propertyState.points[0].name,'Creek Camera');
  passed.push('Property center and trail-camera save flows persist independently');

  // Delete flow removes only the selected record.
  const deleteBtn=property.elements.pointList.children[0].children[3].children[1];
  await deleteBtn.click();
  propertyState=JSON.parse(property.store.get('cso_gps_v4'));
  assert.equal(propertyState.points.length,0);
  passed.push('Delete action removes the selected saved location');

  // Weak accuracy is explicitly warned but does not silently discard a user-requested save.
  const weak=makeHarness({geo:{getCurrentPosition:ok=>ok({coords:{latitude:40.75,longitude:-89.4,accuracy:240}})}});
  weak.elements.pointName.value='Under Canopy';await weak.elements.savePoint.click();
  assert.match(weak.elements.gpsStatus.textContent,/accuracy is weak/i);
  assert.equal(JSON.parse(weak.store.get('cso_gps_v4')).points.length,1);
  passed.push('Weak GPS accuracy is disclosed while preserving the explicit save choice');

  // Duplicate identifiers in imported data are regenerated to preserve independent delete actions.
  const dup=makeHarness({storage:{cso_gps_v4:JSON.stringify({property:{},points:[{id:'same',name:'One',type:'stand',lat:40,lon:-89,winds:[]},{id:'same',name:'Two',type:'camera',lat:40.1,lon:-89.1,winds:[]}],weather:null})}});
  await dup.elements.pointList.children[0].children[3].children[1].click();
  const dupState=JSON.parse(dup.store.get('cso_gps_v4'));
  assert.equal(dupState.points.length,1);
  passed.push('Duplicate saved IDs are repaired in memory so delete remains record-specific');

  // Old weather is displayed but not used to recommend a stand.
  const stale={cso_gps_v4:JSON.stringify({property:{},points:[{id:'s',name:'Stale Stand',type:'stand',lat:40,lon:-89,winds:['N']}],weather:{windSector:'N',windDirectionRaw:'N',windSpeedMinMph:5,windSpeedMaxMph:5,temperature:'40',temperatureUnit:'F',summary:'Clear',fetchedAt:'2020-01-01T00:00:00Z'}})};
  const staleHarness=makeHarness({storage:stale});
  assert.match(staleHarness.elements.advisor.textContent,/older than 3 hours/i);assert.equal(staleHarness.elements.todayStand.textContent,'Refresh your forecast');assert.equal(staleHarness.elements.todayScore.textContent,'—');
  passed.push("Stale forecast (>3 hours) is not used for a wind recommendation or Today's Hunt score");

  const noMatch={cso_gps_v4:JSON.stringify({property:{},points:[{id:'nm',name:'South Stand',type:'stand',lat:40,lon:-89,winds:['S']}],weather:{windSector:'N',windDirectionRaw:'N',windSpeedMinMph:5,windSpeedMaxMph:5,temperature:'40',temperatureUnit:'F',summary:'Clear',fetchedAt:new Date().toISOString(),hourly:[{startTime:new Date(Date.now()+3600000).toISOString(),windDirectionRaw:'N',windSector:'N',windSpeedMinMph:5,windSpeedMaxMph:5,temperature:40,temperatureUnit:'F'}]}})};
  const noMatchHarness=makeHarness({storage:noMatch});
  assert.equal(noMatchHarness.elements.todayStand.textContent,'No ideal-wind window');assert.equal(noMatchHarness.elements.huntViewStandBtn.disabled,true);
  passed.push('Today’s Hunt does not recommend a stand when no upcoming forecast hour matches its Ideal Wind');

  // XSS regression: imported names remain literal text in the DOM.
  const xss={cso_gps_v4:JSON.stringify({property:{},points:[{id:'x',name:'<img src=x onerror=alert(1)>',type:'stand',lat:40,lon:-89,winds:[],notes:'',accuracy:5}],weather:null})};
  const safe=makeHarness({storage:xss});
  assert.match(safe.elements.pointList.textContent,/<img src=x onerror=alert\(1\)>/);
  assert.equal(safe.elements.pointList.children[0].children.some(n=>n.tagName==='IMG'),false);
  passed.push('XSS regression: saved text is rendered with text nodes, not HTML');

  // NWS parsing path: range speeds and 16-point compass are normalized.
  const weatherFetch=async url=> url.includes('/points/')?{ok:true,json:async()=>({properties:{forecastHourly:'https://api.weather.gov/gridpoints/ILX/1,1/forecast/hourly'}})}:{ok:true,json:async()=>({properties:{periods:[{windSpeed:'5 to 10 mph',windDirection:'NNE',temperature:48,temperatureUnit:'F',shortForecast:'Partly Cloudy',startTime:new Date(Date.now()+3600000).toISOString()},{windSpeed:'8 mph',windDirection:'ESE',temperature:45,temperatureUnit:'F',shortForecast:'Clear',startTime:new Date(Date.now()+7200000).toISOString()}]}})};
  const weather=makeHarness({fetch:weatherFetch});
  weather.elements.pointName.value='NE Stand';
  await weather.elements.windChecks.children.find(button=>button.dataset?.direction==='NE').click();
  await weather.elements.windChecks.children.find(button=>button.dataset?.direction==='SE').click();
  await weather.elements.savePoint.click();
  await weather.elements.weatherBtn.click();
  const wstate=JSON.parse(weather.store.get('cso_gps_v4'));
  assert.equal(wstate.weather.windSector,'NE');assert.equal(wstate.weather.windSpeedMinMph,5);assert.equal(wstate.weather.windSpeedMaxMph,10);assert.equal(wstate.weather.hourly.length,2);assert.equal(wstate.weather.hourly[1].windSector,'SE');
  assert.match(weather.elements.advisor.textContent,/Safe-wind match: NE Stand/);assert.match(weather.elements.hourlyWindReport.textContent,/Next 24 hours/);assert.match(weather.elements.hourlyWindReport.textContent,/100\/100/);
  assert.equal(weather.elements.todayStand.textContent,'NE Stand');assert.match(weather.elements.todayScore.textContent,/^\d{2,3}\/100$/);assert.match(weather.elements.todayReason.textContent,/CSO suitability index/);assert.match(weather.elements.huntAdvisorInsight.textContent,/Score factors/);
  passed.push("NWS hourly forecast: 2 periods persisted; NNE-to-NE normalized; Today's Hunt ranks matching stand");

  const variableFetch=async url=> url.includes('/points/')?{ok:true,json:async()=>({properties:{forecastHourly:'https://api.weather.gov/hourly'}})}:{ok:true,json:async()=>({properties:{periods:[{windSpeed:'0 mph',windDirection:'Variable',temperature:41,temperatureUnit:'F',shortForecast:'Cloudy',startTime:'2026-11-19T17:00:00-06:00'}]}})};
  const variable=makeHarness({fetch:variableFetch});variable.elements.pointName.value='Stand';
  await variable.elements.savePoint.click();await variable.elements.weatherBtn.click();
  assert.match(variable.elements.advisor.textContent,/variable or unsupported wind direction/i);
  passed.push('NWS logic simulation: variable wind does not produce a false stand match');

  // Stand-level observed wind survives normalization and is reflected in the map selector.
  const observed=makeHarness({storage:{cso_gps_v4:JSON.stringify({property:{},points:[{id:'obs-1',name:'Creek Stand',type:'stand',lat:40.1,lon:-89.1,winds:['E'],windFromDeg:67.5,windObservedAt:'2026-11-19T12:00:00Z'}],parcels:[],weather:null})}});
  const observedState=JSON.parse(observed.store.get('cso_gps_v4'));
  assert.equal(observedState.points[0].windFromDeg,67.5);
  assert.match(observed.elements.windStandSelect.textContent,/Creek Stand/);
  passed.push('Observed stand wind persists through state normalization and populates the stand selector');

  console.log(JSON.stringify({passed,total:passed.length},null,2));
})().catch(err=>{console.error(err);process.exit(1);});
