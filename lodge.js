const trophies = [
  {id:'ridge-runner',name:'Ridge Runner',type:'classic',label:'Classic shoulder',story:'A bold, wide-framed classic shoulder presentation with a traditional walnut plaque.',rack:0,antler:'#d7c09a'},
  {id:'late-light',name:'Last Light',type:'classic',label:'Classic shoulder',story:'A tall, clean rack silhouette presented in a warm lodge setting.',rack:1,antler:'#dfc9a5'},
  {id:'north-fork',name:'North Fork',type:'classic',label:'Classic shoulder',story:'An asymmetric rack study celebrating character rather than perfect symmetry.',rack:2,antler:'#cdb58c'},
  {id:'old-oak',name:'Old Oak',type:'classic',label:'Classic shoulder',story:'A mature, heavy-beamed look with a deep walnut presentation plaque.',rack:3,antler:'#d6bf98'},
  {id:'clean-slate',name:'Clean Slate',type:'euro',label:'European mount',story:'A minimal skull-and-antler wall presentation with a dark, understated backer.',rack:4,antler:'#e0d3b8'},
  {id:'stone-creek',name:'Stone Creek',type:'euro',label:'European mount',story:'A natural bone palette and rugged stone-inspired display treatment.',rack:5,antler:'#d7c7a9'},
  {id:'high-country',name:'High Country',type:'euro',label:'European mount',story:'A high-reaching rack silhouette in a clean gallery-style European display.',rack:6,antler:'#e3d6bc'},
  {id:'ironwood',name:'Ironwood',type:'pedestal',label:'Pedestal display',story:'A sculptural pedestal concept for a trophy that deserves its own space.',rack:7,antler:'#d2b98e'},
  {id:'autumn-watch',name:'Autumn Watch',type:'pedestal',label:'Pedestal display',story:'A habitat-inspired presentation with warm autumn tones and a grounded base.',rack:8,antler:'#d9c39d'},
  {id:'campfire',name:'Campfire Story',type:'family',label:'Family collection',story:'A family-wall concept designed to keep multiple generations of hunts together.',rack:9,antler:'#ddc59d'},
  {id:'first-season',name:'First Season',type:'family',label:'Family collection',story:'A smaller, simple presentation concept for a first deer and a lifelong memory.',rack:10,antler:'#d6c09a'},
  {id:'father-son',name:'Two Generations',type:'family',label:'Family collection',story:'A paired-display idea for father-and-son harvests and shared memories.',rack:11,antler:'#e0cba5'}
];
const $ = id => document.getElementById(id);
const paths = [
  'M100 104 C76 83 68 53 51 35 M51 35 L36 16 M51 35 L27 31 M51 35 L46 8 M100 104 C124 83 132 53 149 35 M149 35 L164 16 M149 35 L173 31 M149 35 L154 8',
  'M100 108 C73 89 78 59 57 38 M57 38 L39 26 M57 38 L48 13 M57 38 L26 43 M57 38 L62 8 M100 108 C127 89 122 59 143 38 M143 38 L161 26 M143 38 L152 13 M143 38 L174 43 M143 38 L138 8',
  'M100 108 C79 87 65 65 53 43 M53 43 L35 27 M53 43 L29 49 M53 43 L51 16 M100 108 C127 89 135 62 146 34 M146 34 L163 18 M146 34 L177 28 M146 34 L151 7 M146 34 L133 14',
  'M100 110 C73 85 72 57 49 33 M49 33 L28 16 M49 33 L24 35 M49 33 L47 7 M49 33 L63 13 M100 110 C127 85 128 57 151 33 M151 33 L172 16 M151 33 L176 35 M151 33 L153 7 M151 33 L137 13',
  'M100 108 C78 89 74 65 56 42 M56 42 L37 28 M56 42 L34 50 M56 42 L54 17 M100 108 C122 89 126 65 144 42 M144 42 L163 28 M144 42 L166 50 M144 42 L146 17',
  'M100 108 C76 87 72 58 55 40 M55 40 L33 22 M55 40 L25 42 M55 40 L50 12 M55 40 L67 18 M100 108 C124 87 128 58 145 40 M145 40 L167 22 M145 40 L175 42 M145 40 L150 12 M145 40 L133 18',
  'M100 108 C77 89 80 54 58 31 M58 31 L41 12 M58 31 L29 26 M58 31 L55 4 M100 108 C123 89 120 54 142 31 M142 31 L159 12 M142 31 L171 26 M142 31 L145 4',
  'M100 108 C76 89 69 62 50 43 M50 43 L27 27 M50 43 L22 51 M50 43 L44 17 M50 43 L65 22 M100 108 C124 89 131 62 150 43 M150 43 L173 27 M150 43 L178 51 M150 43 L156 17 M150 43 L135 22',
  'M100 108 C79 85 71 60 54 37 M54 37 L35 20 M54 37 L25 34 M54 37 L51 9 M100 108 C121 85 129 60 146 37 M146 37 L165 20 M146 37 L175 34 M146 37 L149 9',
  'M100 108 C76 88 74 62 57 44 M57 44 L39 31 M57 44 L29 51 M57 44 L57 18 M100 108 C124 88 126 62 143 44 M143 44 L161 31 M143 44 L171 51 M143 44 L143 18',
  'M100 108 C76 84 69 57 48 35 M48 35 L29 16 M48 35 L22 38 M48 35 L45 7 M48 35 L62 13 M100 108 C124 84 131 57 152 35 M152 35 L171 16 M152 35 L178 38 M152 35 L155 7 M152 35 L138 13',
  'M100 108 C77 88 70 61 52 39 M52 39 L33 21 M52 39 L25 46 M52 39 L48 13 M100 108 C123 88 130 61 148 39 M148 39 L167 21 M148 39 L175 46 M148 39 L152 13'
];
function art(t, large=false){
  const euro=t.type==='euro';
  const pedestal=t.type==='pedestal';
  const family=t.type==='family';
  const plaque=pedestal?'<path d="M65 160 L135 160 L127 183 L73 183 Z" fill="#72502f" stroke="#b28a59" stroke-width="2"/><path d="M73 183 L127 183 L136 194 L64 194 Z" fill="#302117"/>':family?'<path d="M68 159 L132 159 L127 178 L73 178 Z" fill="#69492e" stroke="#b18a5c" stroke-width="2"/>':'<path d="M66 150 Q100 139 134 150 L130 177 Q100 187 70 177 Z" fill="#52351f" stroke="#b18a5c" stroke-width="2"/>';
  const skull=euro?'<path d="M83 91 Q100 79 117 91 L119 120 Q111 138 100 139 Q89 138 81 120 Z" fill="#d8c9aa" stroke="#8c7658" stroke-width="2"/><path d="M91 118 Q100 111 109 118 L106 133 L94 133 Z" fill="#8d775b"/><circle cx="89" cy="108" r="4" fill="#554b3c"/><circle cx="111" cy="108" r="4" fill="#554b3c"/>': '<path d="M75 98 Q100 79 125 98 L130 132 Q123 154 100 157 Q77 154 70 132 Z" fill="#9b6b45" stroke="#d2a779" stroke-width="2"/><path d="M82 119 Q90 109 98 118 L96 135 L83 134 Z M102 118 Q110 109 118 119 L117 134 L104 135 Z" fill="#241a13"/><path d="M88 143 Q100 150 112 143" fill="none" stroke="#39251a" stroke-width="3"/>';
  const rack=paths[t.rack];
  const plaqueLabel=family?'FAMILY HARVEST':euro?'EUROPEAN SERIES':pedestal?'PEDESTAL SERIES':'CSO TROPHY';
  return `<svg viewBox="0 0 200 205" role="img" aria-label="Illustrative ${t.label.toLowerCase()} antler and mount artwork" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fur${t.rack}" x2="0" y2="1"><stop stop-color="#d4a16d"/><stop offset="1" stop-color="#70472d"/></linearGradient><linearGradient id="rack${t.rack}" x2="0" y2="1"><stop stop-color="#f0dfbd"/><stop offset="1" stop-color="${t.antler}"/></linearGradient></defs>${!euro?`<path d="M74 90 Q100 68 126 90 L133 133 Q126 158 100 162 Q74 158 67 133 Z" fill="url(#fur${t.rack})" stroke="#593a25" stroke-width="2"/>`:''}<g fill="none" stroke="url(#rack${t.rack})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="${rack}"/><path d="M100 108 L100 86" stroke-width="6"/></g>${skull}${plaque}<text x="100" y="169" text-anchor="middle" font-family="Georgia,serif" font-size="5.5" letter-spacing="1.1" fill="#e6c99e">${plaqueLabel}</text></svg>`;
}
function card(t){return `<article class="card"><div class="card-art">${art(t)}</div><div class="card-copy"><div class="type">${t.label}</div><h3>${t.name}</h3><p>${t.story}</p><button class="view" type="button" data-open="${t.id}">View study</button></div></article>`}
function renderWall(){
  const left=[trophies[0],trophies[4],trophies[9],trophies[10]], right=[trophies[1],trophies[5],trophies[7],trophies[11]];
  const wallCard=t=>`<div class="wall-mount"><div class="art">${art(t)}</div><b>${t.name}</b><small>${t.label}</small></div>`;
  $('leftWall').innerHTML=left.map(wallCard).join('');$('rightWall').innerHTML=right.map(wallCard).join('');
}
function renderGrid(filter='all'){
  const items=filter==='all'?trophies:trophies.filter(t=>t.type===filter);
  $('trophyGrid').innerHTML=items.length?items.map(card).join(''):'<div class="empty">No studies in this collection yet.</div>';
  $('resultCount').textContent=`${items.length} ${items.length===1?'STUDY':'STUDIES'}`;
}
function openDetail(id){
  const t=trophies.find(item=>item.id===id);if(!t)return;
  $('modalArt').innerHTML=art(t,true);$('modalType').textContent=t.label.toUpperCase();$('detailTitle').textContent=t.name;$('detailDescription').textContent=t.story;
  $('detailDialog').showModal();
}
renderWall();renderGrid();
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  renderGrid(button.dataset.filter);
}));
document.addEventListener('click',event=>{const button=event.target.closest('[data-open]');if(button)openDetail(button.dataset.open);});
$('closeDialog').addEventListener('click',()=>$('detailDialog').close());
$('detailDialog').addEventListener('click',event=>{if(event.target===$('detailDialog'))$('detailDialog').close();});
