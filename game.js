
(function(){
'use strict';

// Stable scenery keeps collision geometry consistent across saved expeditions.
let worldSeed=76193;
function random(){worldSeed=(Math.imul(worldSeed,1664525)+1013904223)>>>0;return worldSeed/4294967296;}


/* ============ basics ============ */
if (!window.THREE) {
  document.querySelector('.intro').textContent='The 3D engine could not load. Please reload to try again.';
  document.getElementById('begin').disabled=true;
  return;
}
const container = document.getElementById('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true}); }
catch (error) {
  document.querySelector('.intro').textContent='WebGL is unavailable. Enable hardware acceleration and reload to play.';
  document.getElementById('begin').disabled=true;
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY_DAY  = new THREE.Color(0x9fb4c4);
const SKY_DUSK = new THREE.Color(0x46586e);
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(scene.background, 38, 95);

/* ortho isometric camera */
let frustum = 26;
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0.1,400);
function sizeCamera(){
  const a = window.innerWidth/window.innerHeight;
  frustum = a < 0.8 ? 24 : 30;            /* tighter on phones */
  camera.left=-frustum*a/2; camera.right=frustum*a/2;
  camera.top=frustum/2; camera.bottom=-frustum/2;
  camera.updateProjectionMatrix();
}
sizeCamera();
const CAM_OFF = new THREE.Vector3(15,17,15);

/* lights */
const hemi = new THREE.HemisphereLight(0xcfe0ee,0x4a5e70,0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd,0.95);
sun.position.set(-22,30,14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-40; sun.shadow.camera.right=40;
sun.shadow.camera.top=40; sun.shadow.camera.bottom=-40;
sun.shadow.camera.far=120;
sun.shadow.bias=-0.0005;
scene.add(sun);
scene.add(sun.target);

/* ============ terrain ============ */
function hAt(x,z){
  return Math.sin(x*0.055)*Math.cos(z*0.05)*1.5
       + Math.sin(x*0.16+1.7)*Math.sin(z*0.13)*0.55
       + Math.cos((x+z)*0.025)*1.1;
}
const GSIZE=220, GSEG=96;
const gGeo = new THREE.PlaneGeometry(GSIZE,GSIZE,GSEG,GSEG);
gGeo.rotateX(-Math.PI/2);
{
  const p = gGeo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), z=p.getZ(i);
    p.setY(i, hAt(x,z) + (random()*0.14));   /* crumple for facets */
  }
  gGeo.computeVertexNormals();
}
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({
  color:0xe9eff5, flatShading:true, roughness:1, metalness:0
}));
ground.receiveShadow = true;
scene.add(ground);

/* ============ scenery helpers ============ */
const colliders = [];            /* {x,z,r} */
const M = {
  pineDark:new THREE.MeshStandardMaterial({color:0x1f3a2e,flatShading:true,roughness:1}),
  pineMid:new THREE.MeshStandardMaterial({color:0x2a4a38,flatShading:true,roughness:1}),
  snowCap:new THREE.MeshStandardMaterial({color:0xf2f6fa,flatShading:true,roughness:1}),
  trunk:new THREE.MeshStandardMaterial({color:0x4a3a2c,flatShading:true,roughness:1}),
  rock:new THREE.MeshStandardMaterial({color:0x8d9aa6,flatShading:true,roughness:1}),
  rockDark:new THREE.MeshStandardMaterial({color:0x6e7c89,flatShading:true,roughness:1}),
  metal:new THREE.MeshStandardMaterial({color:0xc7ccd1,flatShading:true,roughness:.7,metalness:.25}),
  metalDark:new THREE.MeshStandardMaterial({color:0x55606b,flatShading:true,roughness:.8}),
  stripe:new THREE.MeshStandardMaterial({color:0xc7402e,flatShading:true,roughness:.8}),
  log:new THREE.MeshStandardMaterial({color:0x5c4632,flatShading:true,roughness:1}),
  logEnd:new THREE.MeshStandardMaterial({color:0x8a6f52,flatShading:true,roughness:1}),
  jacket:new THREE.MeshStandardMaterial({color:0xe8611f,flatShading:true,roughness:.9}),
  pants:new THREE.MeshStandardMaterial({color:0x2b3440,flatShading:true,roughness:1}),
  skin:new THREE.MeshStandardMaterial({color:0xc9a182,flatShading:true,roughness:1}),
  beanie:new THREE.MeshStandardMaterial({color:0x3a4654,flatShading:true,roughness:1}),
  pack:new THREE.MeshStandardMaterial({color:0x6b5639,flatShading:true,roughness:1}),
  flameA:new THREE.MeshBasicMaterial({color:0xff7a2f}),
  flameB:new THREE.MeshBasicMaterial({color:0xffc04d}),
};

function shadowAll(o){ o.traverse(c=>{ if(c.isMesh){c.castShadow=true;c.receiveShadow=true;} }); }

function makeTree(scale){
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.9,5),M.trunk);
  t.position.y=0.45; g.add(t);
  const tiers=[[1.5,1.9,0.7,M.pineDark],[1.15,1.5,1.85,M.pineMid],[0.8,1.2,2.85,M.pineDark]];
  tiers.forEach(([r,h,y,m])=>{
    const c=new THREE.Mesh(new THREE.ConeGeometry(r,h,6),m);
    c.position.y=y+h/2; c.rotation.y=random()*Math.PI; g.add(c);
  });
  const cap=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.9,6),M.snowCap);
  cap.position.y=4.0; g.add(cap);
  g.scale.setScalar(scale);
  shadowAll(g);
  return g;
}
function makeRock(scale){
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(0.7,0),
    random()<0.5?M.rock:M.rockDark);
  r.scale.set(scale*(0.7+random()*0.7),scale*(0.5+random()*0.5),scale*(0.7+random()*0.7));
  r.rotation.set(random(),random()*Math.PI,random());
  shadowAll(r);
  return r;
}

/* keep spawn + a corridor clear */
function clearOf(x,z){
  if(Math.hypot(x+24,z+24) < 5) return false;
  if(Math.hypot(x,z) < 9) return false;                       /* crash clearing */
  if(Math.abs(x - z) < 5 && x < 2 && x > -55) return false;   /* trail NW */
  return true;
}

for(let i=0;i<150;i++){
  const x=(random()-0.5)*180, z=(random()-0.5)*180;
  if(!clearOf(x,z)) continue;
  const s=0.8+random()*0.9;
  const tr=makeTree(s);
  tr.position.set(x,hAt(x,z)-0.1,z);
  scene.add(tr);
  colliders.push({x,z,r:0.9*s});
}
for(let i=0;i<55;i++){
  const x=(random()-0.5)*180, z=(random()-0.5)*180;
  if(!clearOf(x,z)) continue;
  const s=0.5+random()*1.1;
  const rk=makeRock(s);
  rk.position.set(x,hAt(x,z)+0.1*s,z);
  scene.add(rk);
  if(s>0.8) colliders.push({x,z,r:0.7*s});
}

/* ============ crash site ============ */
const crash = new THREE.Group();
{
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.25,7.5,8),M.metal);
  fus.rotation.z = Math.PI/2; fus.rotation.y = 0.35; fus.position.y = 1.0;
  crash.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05,1.6,8),M.metalDark);
  nose.rotation.z = -Math.PI/2; nose.rotation.y = 0.35;
  nose.position.set(Math.cos(0.35)*4.5,0.95,-Math.sin(0.35)*4.5);
  crash.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25,2.0,1.4),M.stripe);
  tail.position.set(-Math.cos(0.35)*3.6,2.2,Math.sin(0.35)*3.6);
  tail.rotation.y=0.35; tail.rotation.x=0.25; crash.add(tail);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.5,0.18,1.5),M.metal);
  wing.position.set(2.5,0.35,2.8); wing.rotation.y=0.9; wing.rotation.z=0.12;
  crash.add(wing);
  const wing2 = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.16,1.2),M.metalDark);
  wing2.position.set(-3.5,0.3,-2.6); wing2.rotation.y=-0.5; crash.add(wing2);
  for(let i=0;i<7;i++){
    const d=new THREE.Mesh(new THREE.BoxGeometry(0.5+random()*0.6,0.3,0.4+random()*0.5),
      random()<0.4?M.stripe:M.metalDark);
    const a=random()*Math.PI*2, r=3+random()*4;
    d.position.set(Math.cos(a)*r,0.2,Math.sin(a)*r);
    d.rotation.y=random()*Math.PI;
    crash.add(d);
  }
  shadowAll(crash);
  crash.position.set(4,hAt(4,-3),-3);
  scene.add(crash);
  colliders.push({x:4,z:-3,r:3.4});
}

/* wreck fire */
const fire = new THREE.Group();
const flame1 = new THREE.Mesh(new THREE.ConeGeometry(0.45,1.1,5),M.flameA);
const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.26,0.75,5),M.flameB);
flame1.position.y=0.55; flame2.position.y=0.72;
fire.add(flame1,flame2);
const fireLight = new THREE.PointLight(0xff8a3d,1.4,14,2);
fireLight.position.y=1.2;
fire.add(fireLight);
fire.position.set(1.2,hAt(1.2,-1.0),-1.0);
scene.add(fire);

/* ============ wood piles (interactables) ============ */
const piles=[];
function makePile(x,z){
  const g=new THREE.Group();
  for(let i=0;i<3;i++){
    const log=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,1.2,6),M.log);
    log.rotation.z=Math.PI/2; log.rotation.y=random()*0.8-0.4;
    log.position.set((random()-0.5)*0.3, 0.13+i*0.16, (random()-0.5)*0.3);
    g.add(log);
  }
  shadowAll(g);
  g.position.set(x,hAt(x,z),z);
  scene.add(g);
  piles.push({x,z,mesh:g,taken:false});
}
[[ -3.5, 4.5],[ 9, 6],[ -9, -7],[ -16, -14],[ -24, -20],[ 6, -12],[ -30, -31],[ 14, -2]]
  .forEach(([x,z])=>makePile(x,z));

/* A visible radio mast on the northwest ridge. */
const beacon=new THREE.Group();
const mast=new THREE.Mesh(new THREE.CylinderGeometry(.07,.15,8,6),M.metalDark);mast.position.y=4;beacon.add(mast);
for(const y of [5,6.5]){const cross=new THREE.Mesh(new THREE.BoxGeometry(3,.08,.08),M.metal);cross.position.y=y;beacon.add(cross);}
const beaconLamp=new THREE.Mesh(new THREE.SphereGeometry(.2,8,8),new THREE.MeshBasicMaterial({color:0xefae72}));beaconLamp.position.y=8.2;beacon.add(beaconLamp);
const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,1,.8),M.pineDark);base.position.y=.5;beacon.add(base);
beacon.position.set(-24,hAt(-24,-24),-24);shadowAll(beacon);scene.add(beacon);colliders.push({x:-24,z:-24,r:.6});

/* ============ Rowan ============ */
const rowan = new THREE.Group();
const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.62,0.3),M.pants);
const legR = legL.clone();
legL.position.set(-0.17,0.31,0); legR.position.set(0.17,0.31,0);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74,0.78,0.46),M.jacket);
torso.position.y=1.02;
const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.66,0.24),M.jacket);
const armR = armL.clone();
armL.position.set(-0.5,1.05,0); armR.position.set(0.5,1.05,0);
const head = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.4,0.4),M.skin);
head.position.y=1.66;
const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.2,0.44),M.beanie);
beanie.position.y=1.9;
const pack = new THREE.Mesh(new THREE.BoxGeometry(0.56,0.6,0.28),M.pack);
pack.position.set(0,1.06,-0.36);
rowan.add(legL,legR,torso,armL,armR,head,beanie,pack);
shadowAll(rowan);
rowan.position.set(0,hAt(0,0),0);
scene.add(rowan);

/* thumb-guidance ring (signature element) */
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.5,0.65,24),
  new THREE.MeshBasicMaterial({color:0xff8a3d,transparent:true,opacity:0,side:THREE.DoubleSide})
);
ring.rotation.x=-Math.PI/2;
scene.add(ring);

/* footprints */
const FP_MAX=70;
const fpGeo = new THREE.CircleGeometry(0.11,6);
const footprints=[];
for(let i=0;i<FP_MAX;i++){
  const m=new THREE.Mesh(fpGeo,new THREE.MeshBasicMaterial({color:0xb9c6d2,transparent:true,opacity:0}));
  m.rotation.x=-Math.PI/2; m.visible=false;
  scene.add(m); footprints.push({mesh:m,life:0});
}
let fpIdx=0, fpDist=0, fpSide=1;
function dropFootprint(){
  const f=footprints[fpIdx]; fpIdx=(fpIdx+1)%FP_MAX;
  const side=new THREE.Vector3(Math.cos(rowan.rotation.y),0,-Math.sin(rowan.rotation.y));
  f.mesh.position.copy(rowan.position).addScaledVector(side,0.14*fpSide);
  f.mesh.position.y=hAt(f.mesh.position.x,f.mesh.position.z)+0.06;
  f.mesh.material.opacity=0.5; f.mesh.visible=true; f.life=18;
  fpSide*=-1;
}

/* ============ snowfall ============ */
const SNOW_N=900, SNOW_BOX=70;
const sGeo=new THREE.BufferGeometry();
const sPos=new Float32Array(SNOW_N*3);
for(let i=0;i<SNOW_N;i++){
  sPos[i*3]= (random()-0.5)*SNOW_BOX;
  sPos[i*3+1]= random()*30;
  sPos[i*3+2]= (random()-0.5)*SNOW_BOX;
}
sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
const snow=new THREE.Points(sGeo,new THREE.PointsMaterial({
  color:0xffffff,size:0.16,transparent:true,opacity:0.85,sizeAttenuation:true}));
scene.add(snow);

/* ============ input: one-thumb guidance ============ */
const raycaster=new THREE.Raycaster();
const ndc=new THREE.Vector2();
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let holding=false;
const target=new THREE.Vector3();
let hasTarget=false;

function updateTarget(clientX,clientY){
  ndc.x=(clientX/window.innerWidth)*2-1;
  ndc.y=-(clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(ndc,camera);
  const hit=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(groundPlane,hit)){
    target.set(hit.x,0,hit.z);
    hasTarget=true;
  }
}
const el=renderer.domElement;
el.addEventListener('pointerdown',e=>{if(!state.started||state.paused||state.ended)return;el.setPointerCapture(e.pointerId);holding=true;updateTarget(e.clientX,e.clientY);},{passive:true});
el.addEventListener('pointermove',e=>{if(holding)updateTarget(e.clientX,e.clientY);},{passive:true});
window.addEventListener('pointerup',()=>{holding=false;},{passive:true});
window.addEventListener('pointercancel',()=>{holding=false;},{passive:true});

/* ============ game state ============ */
const state={
  started:false, paused:false, ended:false, salvaged:false, repaired:false, fuel:35, food:0, water:0, parts:0, elapsed:0,
  day:1,
  clock:16*3600+17*60,        /* 4:17 PM in seconds */
  tempF:-6,
  warm:72,hung:81,thir:65,ener:59,
  wood:0,
  dusk:0                       /* 0..1 */
};
const GAME_SEC_PER_REAL=144;   /* one in-game day = 10 real minutes */

const $=id=>document.getElementById(id);
const toastEl=$('toast'); let toastT=null;
function toast(msg){
  toastEl.textContent=msg; toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>toastEl.classList.remove('show'),1800);
}

/* interact button */
const interactBtn=$('interact');
let nearPile=null;
function updateInteraction(active){
  /* Choose one contextual action, prioritising the closest wood pile. */
  nearPile=null;action=null;
  let nearest=2.4;
  for(const pl of piles){
    const distance=Math.hypot(rowan.position.x-pl.x,rowan.position.z-pl.z);
    if(!pl.taken&&distance<nearest){nearPile=pl;nearest=distance;}
  }
  let label='GATHER WOOD · E';
  if(!nearPile){
    if(!state.salvaged&&Math.hypot(rowan.position.x-4,rowan.position.z+3)<6){action='salvage';label='SEARCH WRECKAGE · E';}
    else if(Math.hypot(rowan.position.x+24,rowan.position.z+24)<3.5){action='beacon';label='TRANSMIT SIGNAL · E';}
    else if(Math.hypot(rowan.position.x-1.2,rowan.position.z+1)<4.5){action='fire';label='FUEL FIRE ('+Math.ceil(state.fuel)+'s) · E';}
  }
  interactBtn.textContent=label;
  interactBtn.classList.toggle('show',!!(nearPile||action)&&active);

}
function interact(){
  if(!state.started||state.paused||state.ended)return;
  updateInteraction(true);
  if(nearPile){
    nearPile.taken=true; scene.remove(nearPile.mesh); state.wood++;
    toast('+1 dry wood · return to the fire for warmth');
  } else if(action==='salvage') {
    state.salvaged=true; state.parts=1; state.food=3; state.water=3;
    toast('Recovered radio parts, 3 rations and 3 water flasks');
  } else if(action==='fire') {
    if(!state.wood){toast('Gather dry wood to fuel the fire');return;}
    state.wood--;state.fuel=Math.min(150,state.fuel+45);toast('Fire fuelled · stay close to recover warmth');
  } else if(action==='beacon') {
    if(!state.salvaged){toast('Recover radio parts from the wreckage first');return;}
    if(state.wood<2){toast('Bring 2 wood to support the signal antenna');return;}
    state.wood-=2;state.parts=0;state.repaired=true;finish(true);
  }
  nearPile=null; save();hud();
}
interactBtn.addEventListener('click',interact);
let action=null;
const keys=new Set();
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  if(e.repeat)return;
  keys.add(e.key.toLowerCase());
  if(e.key==='Escape'&&state.started&&!state.ended)togglePause();
  if(e.key.toLowerCase()==='e')interact();
  if(e.key==='1')consume('food');
  if(e.key==='2')consume('water');
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();holding=false;if(state.started&&!state.paused&&!state.ended)togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();holding=false;if(state.started&&!state.paused&&!state.ended)togglePause();}});
function consume(kind){
  if(!state.started||state.paused||state.ended)return;
  if(state[kind]<=0){toast('No '+(kind==='food'?'rations':'water')+' remaining');return;}
  const meter=kind==='food'?'hung':'thir';
  if(state[meter]>95){toast('Save your supplies for when you need them');return;}
  state[kind]--;state[meter]=Math.min(100,state[meter]+35);toast(kind==='food'?'Ration eaten · +35 food':'Water consumed · +35 hydration');save();hud();
}
$('eat').onclick=()=>consume('food');$('drink').onclick=()=>consume('water');
const panel=$('panel');
function togglePause(guide=false){
  if(!state.started||state.ended)return;
  state.paused=!state.paused;holding=false;keys.clear();
  if(state.paused){save();$('panel-title').textContent=guide?'Your field guide':'Expedition paused';$('panel-copy').textContent='Search the aircraft for supplies. Gather wood and fuel the crash-site fire to recover warmth. Carry 2 wood and the radio parts to the beacon on the northwest ridge.\n\nWASD / arrows: move · Shift: run · E: interact\n1: eat · 2: drink · Esc: pause\nOn touch screens, hold the terrain and slide to steer. Your expedition saves automatically.';$('resume').hidden=false;panel.showModal();}
  else panel.close();
}
$('pause').onclick=()=>togglePause();$('help').onclick=()=>togglePause(true);$('resume').onclick=()=>{if(state.paused)togglePause();};
panel.addEventListener('cancel',e=>{e.preventDefault();if(!state.ended)togglePause();});
$('restart').onclick=()=>{try{localStorage.removeItem('last-signal-v1');}catch{}location.reload();};
function finish(won){
  state.ended=true;holding=false;keys.clear();
  try{localStorage.removeItem('last-signal-v1');}catch{}
  $('panel-title').textContent=won?'Someone heard you.':'The wilderness fell silent.';
  $('panel-copy').textContent=won?'A voice breaks through the static. Rescue is on its way. Rowan will see another sunrise.\n\nExpedition time: '+Math.floor(state.elapsed/60)+'m '+Math.floor(state.elapsed%60)+'s.':'Your '+(state.warm<=0?'warmth':state.thir<=0?'water':'food')+' ran out. Use the fire and your supplies, then reach the beacon before the cold takes hold.';
  $('resume').hidden=true;panel.showModal();hud();
}
function save(){
  if(!state.started||state.ended)return;
  try{localStorage.setItem('last-signal-v1',JSON.stringify({state,position:{x:rowan.position.x,z:rowan.position.z},taken:piles.map(p=>p.taken)}));}catch{}
}
let saved=null;
try{
 const candidate=JSON.parse(localStorage.getItem('last-signal-v1'));
 const numeric=['clock','day','warm','hung','thir','ener','wood','food','water','parts','fuel','elapsed'];
 if(candidate&&candidate.state&&!candidate.state.ended&&numeric.every(k=>Number.isFinite(candidate.state[k])&&candidate.state[k]>=0)&&Number.isFinite(candidate.position.x)&&Number.isFinite(candidate.position.z)&&Array.isArray(candidate.taken)&&candidate.taken.length===piles.length)saved=candidate;
}catch{}
$('continue').hidden=!saved;
$('continue').onclick=()=>{
  if(!saved)return;
  Object.assign(state,saved.state,{started:true,paused:false,ended:false});
  rowan.position.set(Math.max(-95,Math.min(95,saved.position.x)),0,Math.max(-95,Math.min(95,saved.position.z)));
  piles.forEach((p,i)=>{p.taken=!!saved.taken[i];if(p.taken)scene.remove(p.mesh);});
  $('boot').classList.add('gone');hud();
};
window.addEventListener('pagehide',save);

/* ============ HUD ============ */

function fmtTime(s){
  s=s%86400;
  let h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
  const ap=h>=12?'PM':'AM';
  h=h%12; if(h===0)h=12;
  return h+':'+String(m).padStart(2,'0')+' '+ap;
}
function setMeter(bar,val,key){
  $(bar).style.width=Math.max(0,Math.min(100,val))+'%';
  $(key).textContent=Math.round(Math.max(0,val));
}
function hud(){
  $('inv-wood').textContent=state.wood;
  $('inv-food').textContent=state.food;$('inv-water').textContent=state.water;$('inv-parts').textContent=state.parts;
  $('eat').disabled=!state.food;$('drink').disabled=!state.water;
  const step=state.repaired?3:state.salvaged?2:1;
  $('progress').textContent=String(step).padStart(2,'0')+' / 03';
  $('mission-fill').style.width=(state.repaired?100:state.salvaged?state.wood>=2?66:40:0)+'%';
  $('objective').textContent=state.repaired?'Signal received':state.salvaged?'Transmit from the ridge':'Search the wreckage';
  $('objective-detail').textContent=state.repaired?'Rescue is on its way. You made it.':state.salvaged?'Bring radio parts + 2 wood to the northwest beacon.':'Recover food, water and radio parts from the aircraft.';
  const destination=state.salvaged?{x:-24,z:-24}:{x:4,z:-3};
  $('bearing').textContent=(state.salvaged?'BEACON · NW':'WRECKAGE')+' · '+Math.round(Math.hypot(destination.x-rowan.position.x,destination.z-rowan.position.z))+' M';
  $('vignette').style.boxShadow=state.warm<25?'inset 0 0 130px rgba(148,193,226,.65)':'inset 0 0 160px rgba(8,20,30,.25)';
  $('hud-day').textContent='DAY '+state.day;
  $('hud-time').textContent=fmtTime(state.clock);
  $('hud-temp').innerHTML=Math.round(state.tempF)+'&deg;F';
  setMeter('m-warm',state.warm,'v-warm');
  setMeter('m-hung',state.hung,'v-hung');
  setMeter('m-thir',state.thir,'v-thir');
  setMeter('m-ener',state.ener,'v-ener');
}
hud();

/* ============ boot ============ */
$('begin').addEventListener('click',()=>{
  $('boot').classList.add('gone');
  state.started=true;save();toast('Search the aircraft nearby · E to interact');
});

/* ============ main loop ============ */
const clock3=new THREE.Clock();
const camTarget=new THREE.Vector3().copy(rowan.position);
let walkPhase=0;

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock3.getDelta(),0.05);
  const t=clock3.elapsedTime;

  const active=state.started&&!state.paused&&!state.ended;
  const horizontal=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  const vertical=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  const keyboard=!!(horizontal||vertical);
  if(active&&keyboard){target.set(rowan.position.x+horizontal+vertical,0,rowan.position.z+vertical-horizontal);hasTarget=true;}
  /* ----- movement ----- */
  let moving=false;
  if(active && (holding||keyboard) && hasTarget){
    const dx=target.x-rowan.position.x, dz=target.z-rowan.position.z;
    const dist=Math.hypot(dx,dz);
    if(dist>0.45){
      moving=true;
      const heading=Math.atan2(dx,dz);
      /* shortest-arc rotate */
      let dr=heading-rowan.rotation.y;
      while(dr>Math.PI)dr-=Math.PI*2;
      while(dr<-Math.PI)dr+=Math.PI*2;
      rowan.rotation.y+=dr*Math.min(1,dt*10);

      const speed=(keys.has('shift')&&state.ener>5?6.5:4.2)*(state.ener<10?.6:1);
      let nx=rowan.position.x+(dx/dist)*speed*dt;
      let nz=rowan.position.z+(dz/dist)*speed*dt;

      /* push out of colliders */
      for(const c of colliders){
        const cx=nx-c.x, cz=nz-c.z;
        const d=Math.hypot(cx,cz);
        if(d<c.r+0.45&&d>0.001){
          const push=(c.r+0.45-d);
          nx+=cx/d*push; nz+=cz/d*push;
        }
      }
      /* world bounds */
      nx=Math.max(-95,Math.min(95,nx));
      nz=Math.max(-95,Math.min(95,nz));

      fpDist+=Math.hypot(nx-rowan.position.x,nz-rowan.position.z);
      rowan.position.x=nx; rowan.position.z=nz;
      if(fpDist>0.85){fpDist=0;dropFootprint();}
    }
  }
  rowan.position.y=hAt(rowan.position.x,rowan.position.z);

  /* walk cycle */
  if(moving){
    walkPhase+=dt*9;
    const s=Math.sin(walkPhase);
    legL.rotation.x=s*0.7; legR.rotation.x=-s*0.7;
    armL.rotation.x=-s*0.55; armR.rotation.x=s*0.55;
    rowan.position.y+=Math.abs(Math.sin(walkPhase))*0.05;
  }else{
    legL.rotation.x*=0.85; legR.rotation.x*=0.85;
    armL.rotation.x*=0.85; armR.rotation.x*=0.85;
    /* idle breath */
    torso.scale.y=1+Math.sin(t*1.6)*0.012;
  }

  /* guidance ring */
  if(active&&holding&&hasTarget){
    ring.position.set(target.x,hAt(target.x,target.z)+0.08,target.z);
    ring.material.opacity=0.55+Math.sin(t*6)*0.2;
    const sc=1+Math.sin(t*6)*0.08;
    ring.scale.set(sc,sc,sc);
  }else{
    ring.material.opacity*=0.85;
  }

  /* footprints fade */
  for(const f of footprints){
    if(!f.mesh.visible)continue;
    f.life-=dt;
    f.mesh.material.opacity=Math.max(0,0.5*(f.life/18));
    if(f.life<=0)f.mesh.visible=false;
  }

  /* fire flicker */
  flame1.scale.y=1+Math.sin(t*11)*0.18;
  flame2.scale.y=1+Math.sin(t*14+1)*0.25;
  flame2.rotation.y=t*2;
  fireLight.intensity=1.2+Math.sin(t*9)*0.3+random()*0.15;

  /* snowfall */
  {
    const p=snow.geometry.attributes.position;
    for(let i=0;i<SNOW_N;i++){
      let y=p.getY(i)-dt*(1.6+(i%5)*0.25);
      let x=p.getX(i)+Math.sin(t*0.7+i)*dt*0.4;
      if(y<0){y=28; x=(random()-0.5)*SNOW_BOX;}
      p.setY(i,y); p.setX(i,x);
    }
    p.needsUpdate=true;
    snow.position.x=camTarget.x; snow.position.z=camTarget.z;
  }

  /* ----- simulation ----- */
  if(active){
    state.elapsed+=dt;
    if(Math.floor(state.elapsed/5)>Math.floor((state.elapsed-dt)/5))save();
    state.clock+=GAME_SEC_PER_REAL*dt;
    if(state.clock>=86400){state.clock-=86400;state.day++;toast('DAY '+state.day);}

    /* temp & dusk: coldest at night */
    const hr=state.clock/3600;
    const sunArc=Math.sin((hr-6)/12*Math.PI);           /* 1 at noon, <0 at night */
    state.tempF=-6+sunArc*8-4;
    const duskAmt=Math.max(0,Math.min(1,(hr-15.5)/4)) + Math.max(0,Math.min(1,(6.5-hr)/4));
    const dk=Math.min(1,duskAmt);
    scene.background.copy(SKY_DAY).lerp(SKY_DUSK,dk);
    scene.fog.color.copy(scene.background);
    hemi.intensity=0.85-dk*0.45;
    sun.intensity=0.95-dk*0.65;

    /* meters */
    const coldRate=(state.tempF<0?0.10:0.05)+dk*0.05;
    const byFire=Math.hypot(rowan.position.x-1.2,rowan.position.z+1)<4.5;
    state.fuel=Math.max(0,state.fuel-dt);
    fire.visible=state.fuel>0;
    state.warm=Math.min(100,Math.max(0,state.warm+(byFire&&state.fuel>0?2.8:-coldRate*(moving?.7:1))*dt));             /* moving keeps you warmer */
    if(moving)state.ener=Math.max(0,state.ener-(keys.has('shift')?1.4:.22)*dt); else state.ener=Math.min(100,state.ener+0.10*dt);
    state.hung=Math.max(0,state.hung-.07*dt);
    state.thir=Math.max(0,state.thir-.10*dt);
    if(state.warm<=0||state.hung<=0||state.thir<=0)finish(false);
    hud();
  }

  updateInteraction(active);

  /* camera follow */
  camTarget.lerp(rowan.position,Math.min(1,dt*3));
  camera.position.copy(camTarget).add(CAM_OFF);
  camera.lookAt(camTarget);
  sun.position.set(camTarget.x-22,30,camTarget.z+14);
  sun.target.position.copy(camTarget);

  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  renderer.setSize(window.innerWidth,window.innerHeight);
  sizeCamera();
});
})();
