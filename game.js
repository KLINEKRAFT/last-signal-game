(function(){
'use strict';

/* ============ basics ============ */
const container = document.getElementById('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true}); }
catch (error) { container.innerHTML='<div class="webgl-error">This expedition needs WebGL. Enable hardware acceleration and reload.</div>'; document.getElementById('begin').disabled=true; return; }
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.85;
renderer.outputEncoding=THREE.sRGBEncoding;
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
    p.setY(i, hAt(x,z) + (Math.random()*0.04));   /* crumple for facets */
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
    c.position.y=y+h/2; c.rotation.y=Math.random()*Math.PI; g.add(c);
  });
  const cap=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.9,6),M.snowCap);
  cap.position.y=4.0; g.add(cap);
  g.scale.setScalar(scale);
  shadowAll(g);
  return g;
}
function makeRock(scale){
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(0.7,0),
    Math.random()<0.5?M.rock:M.rockDark);
  r.scale.set(scale*(0.7+Math.random()*0.7),scale*(0.5+Math.random()*0.5),scale*(0.7+Math.random()*0.7));
  r.rotation.set(Math.random(),Math.random()*Math.PI,Math.random());
  shadowAll(r);
  return r;
}

/* keep spawn + a corridor clear */
function clearOf(x,z){
  if(Math.hypot(x,z) < 9) return false;
  if([[-9,-7],[9,6],[-16,-14],[8,10],[-6,-7],[-13,-16]].some(([px,pz])=>Math.hypot(x-px,z-pz)<3))return false;                       /* crash clearing */
  if(Math.abs(x - z) < 5 && x < 2 && x > -55) return false;   /* trail NW */
  return true;
}

for(let i=0;i<150;i++){
  const x=(Math.random()-0.5)*180, z=(Math.random()-0.5)*180;
  if(!clearOf(x,z)) continue;
  const s=0.8+Math.random()*0.9;
  const tr=makeTree(s);
  tr.position.set(x,hAt(x,z)-0.1,z);
  scene.add(tr);
  colliders.push({x,z,r:0.9*s});
}
for(let i=0;i<55;i++){
  const x=(Math.random()-0.5)*180, z=(Math.random()-0.5)*180;
  if(!clearOf(x,z)) continue;
  const s=0.5+Math.random()*1.1;
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
    const d=new THREE.Mesh(new THREE.BoxGeometry(0.5+Math.random()*0.6,0.3,0.4+Math.random()*0.5),
      Math.random()<0.4?M.stripe:M.metalDark);
    const a=Math.random()*Math.PI*2, r=3+Math.random()*4;
    d.position.set(Math.cos(a)*r,0.2,Math.sin(a)*r);
    d.rotation.y=Math.random()*Math.PI;
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
    log.rotation.z=Math.PI/2; log.rotation.y=Math.random()*0.8-0.4;
    log.position.set((Math.random()-0.5)*0.3, 0.13+i*0.16, (Math.random()-0.5)*0.3);
    g.add(log);
  }
  shadowAll(g);
  g.position.set(x,hAt(x,z),z);
  scene.add(g);
  piles.push({x,z,mesh:g,taken:false});
}
[[ -3.5, 4.5],[ 8, 10],[ -6, -7],[ -13, -16],[ -24, -20],[ 6, -12],[ -30, -31],[ 14, -2]]
  .forEach(([x,z])=>makePile(x,z));

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
  sPos[i*3]= (Math.random()-0.5)*SNOW_BOX;
  sPos[i*3+1]= Math.random()*30;
  sPos[i*3+2]= (Math.random()-0.5)*SNOW_BOX;
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
const keys=new Set();
const target=new THREE.Vector3();
let hasTarget=false;

function updateTarget(clientX,clientY){
  ndc.x=(clientX/window.innerWidth)*2-1;
  ndc.y=-(clientY/window.innerHeight)*2+1;
  groundPlane.constant=-rowan.position.y;
  raycaster.setFromCamera(ndc,camera);
  const hit=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(groundPlane,hit)){
    target.set(hit.x,0,hit.z);
    hasTarget=true;
  }
}
const el=renderer.domElement;
el.addEventListener('pointerdown',e=>{if(!state.started||state.paused||state.ended)return;holding=true;el.setPointerCapture(e.pointerId);updateTarget(e.clientX,e.clientY);},{passive:true});
el.addEventListener('pointermove',e=>{if(holding)updateTarget(e.clientX,e.clientY);},{passive:true});
window.addEventListener('pointerup',()=>{holding=false;},{passive:true});
window.addEventListener('pointercancel',()=>{holding=false;},{passive:true});

/* ============ game state ============ */
const state={
  started:false,paused:false,ended:false,elapsed:0,
  food:2,water:2,parts:0,fuel:65,fed:false,radio:false,signal:0,
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

/* Survival mission: every supply has a purpose. */
const interactBtn=$('interact');
let nearby=null;
const salvage=[];
[[-9,-7],[9,6],[-16,-14]].forEach(([x,z],i)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.9,.65,.7),M.stripe);
  mesh.position.set(x,hAt(x,z)+.35,z);shadowAll(mesh);scene.add(mesh);
  const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color:0xffbb71}));
  beacon.position.set(x,hAt(x,z)+2,z);scene.add(beacon);
  salvage.push({x,z,mesh,beacon,taken:false,index:i});
});
const mast=new THREE.Group();
const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,3.5,6),M.metalDark);pole.position.y=1.75;
const aerial=new THREE.Mesh(new THREE.BoxGeometry(1.8,.065,.065),M.metal);aerial.position.y=3.1;
const radioBox=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.5),M.pineDark);radioBox.position.y=.6;
mast.add(pole,aerial,radioBox);mast.position.set(-4,hAt(-4,-3),-3);scene.add(mast);
function active(){return state.started&&!state.paused&&!state.ended;}
function interact(){
 if(!active()||!nearby)return;
 if(nearby.type==='wood'){
  nearby.item.taken=true;scene.remove(nearby.item.mesh);state.wood++;toast('+1 WOOD · Bring it to the campfire');
 }else if(nearby.type==='salvage'){
  const item=nearby.item;item.taken=true;scene.remove(item.mesh);scene.remove(item.beacon);state.parts++;state.food++;state.water++;
  toast('SALVAGED · Radio part, ration & water');
 }else if(nearby.type==='fire'){
  if(!state.wood){toast('Gather wood first. Look for fallen logs.');return;}
  state.wood--;state.fuel=Math.min(100,state.fuel+35);state.fed=true;toast('FIRE FED · Rest nearby to recover warmth');
 }else if(nearby.type==='radio'){
  if(state.parts<3){toast('RADIO DAMAGED · Find '+(3-state.parts)+' more parts in orange supply crates');return;}
  if(!state.fed){toast('Feed the campfire before calling for rescue.');return;}
  state.radio=true;toast('SIGNAL TRANSMITTING · Stay warm while rescue approaches');
 }
 nearby=null;hud();
}
interactBtn.addEventListener('click',interact);
function consume(kind){
 if(!active())return;
 const meter=kind==='food'?'hung':'thir';
 if(state[kind]<=0){toast('No '+kind+' left. Search supply crates.');return;}
 if(state[meter]>90){toast('Save it. You have enough '+kind+' for now.');return;}
 state[kind]--;state[meter]=Math.min(100,state[meter]+35);toast(kind==='food'?'RATION EATEN · +35 food':'WATER DRUNK · +35 hydration');hud();
}
$('eat').onclick=()=>consume('food');$('drink').onclick=()=>consume('water');
function pause(value){if(!state.started||state.ended)return;state.paused=value;holding=false;keys.clear();$('pause-screen').hidden=!value;if(value)$('resume').focus();}
$('pause').onclick=()=>pause(!state.paused);$('resume').onclick=()=>pause(false);
$('restart').onclick=$('retry').onclick=()=>location.reload();
window.addEventListener('keydown',e=>{
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
 if(e.repeat)return;
 const key=e.key.toLowerCase();keys.add(key);
 if(key==='escape')pause(!state.paused);
 if(key==='e')interact();if(key==='1')consume('food');if(key==='2')consume('water');
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{holding=false;keys.clear();if(active())pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())pause(true);});
function finish(won){
 state.ended=true;holding=false;keys.clear();
 $('end-label').textContent=won?'TRANSMISSION RECEIVED':'EXPEDITION LOST';
 $('end-title').textContent=won?'You were heard.':'The cold settles in.';
 $('end-copy').textContent=won?'A rotor breaks the silence. Rowan is going home. Rescued in '+Math.floor(state.elapsed/60)+'m '+Math.floor(state.elapsed%60)+'s.':'Your '+(state.warm<=0?'warmth':state.hung<=0?'food':'water')+' ran out. Feed the fire, recover beside it, and use your supplies on the next expedition.';
 $('ending').hidden=false;$('retry').focus();
}
// Optional, locally synthesized wind. No audio downloads or autoplay.
let audioContext,windGain;
$('sound').onclick=()=>{
 if(!audioContext){
  audioContext=new (window.AudioContext||window.webkitAudioContext)();
  const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.3;
  const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
  const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=350;
  windGain=audioContext.createGain();windGain.gain.value=0;source.connect(filter);filter.connect(windGain);windGain.connect(audioContext.destination);source.start();
 }
 const on=$('sound').getAttribute('aria-pressed')!=='true';audioContext.resume();windGain.gain.setTargetAtTime(on?.3:0,audioContext.currentTime,.2);
 $('sound').setAttribute('aria-pressed',on);$('sound').textContent=on?'SOUND ON':'SOUND OFF';
};

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
  $('inv-food').textContent=state.food;
  $('inv-water').textContent=state.water;
  $('inv-parts').textContent=state.parts+'/3';
  $('eat').disabled=state.food===0;$('drink').disabled=state.water===0;
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
  state.started=true;
  toast('Find wood, feed the fire, and search the orange crates.');
  document.activeElement.blur();
});

/* ============ main loop ============ */
const clock3=new THREE.Clock();
const camTarget=new THREE.Vector3().copy(rowan.position);
let walkPhase=0;

function animate(){
  requestAnimationFrame(animate);
  const frameDt=Math.min(clock3.getDelta(),0.05);
  const dt=state.paused||state.ended?0:frameDt;
  const t=clock3.elapsedTime;

  /* ----- movement ----- */
  let moving=false;
  const horizontal=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
  const vertical=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  if(active()&&(horizontal||vertical)){
    target.set(rowan.position.x+(horizontal+vertical)*4,0,rowan.position.z+(vertical-horizontal)*4);hasTarget=true;
  }
  if(active() && ((holding && hasTarget)||horizontal||vertical)){
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

      const speed=state.ener<10?2.5:4.2;
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
  if(active()&&holding&&hasTarget){
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
  fireLight.intensity=1.2+Math.sin(t*9)*0.3+Math.random()*0.15;

  /* snowfall */
  {
    const p=snow.geometry.attributes.position;
    for(let i=0;i<SNOW_N;i++){
      let y=p.getY(i)-dt*(1.6+(i%5)*0.25);
      let x=p.getX(i)+Math.sin(t*0.7+i)*dt*0.4;
      if(y<0){y=28; x=(Math.random()-0.5)*SNOW_BOX;}
      p.setY(i,y); p.setX(i,x);
    }
    p.needsUpdate=true;
    snow.position.x=camTarget.x; snow.position.z=camTarget.z;
  }

  /* ----- simulation ----- */
  if(active()){
    state.elapsed+=dt;
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
    state.warm-=coldRate*dt*3*(moving?0.7:1);             /* moving keeps you warmer */
    if(moving)state.ener-=0.22*dt; else state.ener=Math.min(100,state.ener+0.10*dt);
    state.hung=Math.max(0,state.hung-0.10*dt);
    state.thir=Math.max(0,state.thir-0.16*dt);
    state.fuel=Math.max(0,state.fuel-dt*.32);
    const atFire=Math.hypot(rowan.position.x-1.2,rowan.position.z+1)<4;
    if(atFire&&state.fuel>0){state.warm=Math.min(100,state.warm+dt*2.8);state.ener=Math.min(100,state.ener+dt*.7);}
    state.warm=Math.max(0,state.warm);state.ener=Math.max(0,state.ener);
    fire.visible=state.fuel>0;
    if(state.radio)state.signal=Math.min(100,state.signal+dt*100/40);
    if(state.warm<=0||state.hung<=0||state.thir<=0)finish(false);
    else if(state.signal>=100)finish(true);
    $('vignette').style.opacity=state.warm<30?(30-state.warm)/35:0;
    hud();
  }

  /* Nearest actionable object wins; prompts never depend on array order. */
  nearby=null;
  const candidates=[...piles.filter(p=>!p.taken).map(item=>({type:'wood',item,x:item.x,z:item.z,label:'GATHER WOOD'})),
   ...salvage.filter(p=>!p.taken).map(item=>({type:'salvage',item,x:item.x,z:item.z,label:'SEARCH SUPPLY CRATE'})),
   {type:'fire',x:1.2,z:-1,label:'FEED FIRE · 1 WOOD'},
   ...(!state.radio?[{type:'radio',x:-4,z:-3,label:state.parts===3?'REPAIR & TRANSMIT':'INSPECT RADIO · '+state.parts+'/3 PARTS'}]:[])];
  let nearest=Infinity;
  for(const candidate of candidates){const d=Math.hypot(rowan.position.x-candidate.x,rowan.position.z-candidate.z);if(d<2.7&&d<nearest){nearby=candidate;nearest=d;}}
  interactBtn.classList.toggle('show',!!nearby&&active());
  if(nearby)interactBtn.textContent='[E] '+nearby.label;
  for(const item of salvage){item.beacon.rotation.y=t;item.beacon.position.y=hAt(item.x,item.z)+2+Math.sin(t*2+item.index)*.15;}
  let destination={x:1.2,z:-1},name='CAMPFIRE';
  if(!state.fed){$('objective').textContent='Keep the fire alive.';$('objective-detail').textContent='Gather fallen wood, then feed the campfire.';}
  else if(state.parts<3){
   $('objective').textContent='Find a way to be heard.';$('objective-detail').textContent='Search orange supply crates. Radio parts recovered: '+state.parts+' / 3.';
   destination=salvage.filter(p=>!p.taken).sort((a,b)=>Math.hypot(a.x-rowan.position.x,a.z-rowan.position.z)-Math.hypot(b.x-rowan.position.x,b.z-rowan.position.z))[0];name='SUPPLY CRATE';
  }else if(!state.radio){destination={x:-4,z:-3};name='CRASH-SITE RADIO';$('objective').textContent='Break the silence.';$('objective-detail').textContent='Return to the radio and transmit a distress call.';}
  else{$('objective').textContent='Someone is listening.';$('objective-detail').textContent='Rescue inbound · '+Math.floor(state.signal)+'%. Stay warm and supplied.';}
  const dx=destination.x-rowan.position.x,dz=destination.z-rowan.position.z;
  const arrow=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(Math.atan2((dx-dz),-(dx+dz))/(Math.PI/4))+8)%8];
  $('bearing').textContent=arrow+' '+name+' · '+Math.round(Math.hypot(dx,dz))+' M';
  $('step-fire').classList.toggle('done',state.fed);$('step-parts').classList.toggle('done',state.parts===3);$('step-radio').classList.toggle('done',state.radio);
  $('mission').querySelector('.eyebrow span').textContent=(state.radio?'03':state.fed?'02':'01')+' / 03';
  $('hud-wx').textContent='FIRE '+Math.ceil(state.fuel)+'%';

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
