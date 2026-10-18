import {patterns,palette,fabrics} from './patterns.js?v=20261018-art3';
import {BOARD,defaultLayers,arrangeLayers,CompositionState,Geometry} from './composition.js?v=20261018-art3';
import {Painter} from './renderer.js?v=20261018-art3';
import {MachineAudio} from './machine-audio.js';
import {makeTextPattern} from './text-strokes.js';
import {attachCanvasInput,canvasPoint,canvasRadius} from './canvas-input.js?v=20261018-mobile1';
import {installDialogFallback} from './browser-support.js?v=20261018-mobile1';
const $=id=>document.getElementById(id),icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const canvas=$('embroidery'),geometry=new Geometry(),painter=new Painter(canvas),registry=new Map(patterns.map(p=>[p.id,p]));
for(const id of ['typewriter-input','custom-text','letter-body','letter-sign']){const el=$(id);if(el)el.value='';}
const KEY='little-stitch-composition-v3',GALLERY='little-stitch-gallery-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('浏览器存储空间不足，请下载图片留存');return false;}}
const saved=read(KEY,{});
const ART_REVISION=4;
for(const p of (saved.customPatterns||[]).slice(0,20))if(typeof p.id==='string'&&p.id.startsWith('text-')&&Array.isArray(p.paths)&&p.paths.length<4000&&p.paths.every(s=>typeof s.d==='string'&&s.d.length<15000&&/^#[0-9a-f]{6}$/i.test(s.color)))registry.set(p.id,p);
let layers=Array.isArray(saved.layers)&&saved.artRevision===ART_REVISION?saved.layers.filter(l=>registry.has(l.patternId)&&Number.isFinite(l.x)&&Number.isFinite(l.y)&&Number.isFinite(l.scale)&&l.scale>=.15&&l.scale<=3&&typeof l.id==='string'&&(!l.patternId.startsWith('text-')||l.id==='typewriter-layer')).slice(0,20):[];
const retainedMarks=Array.isArray(saved.marks)&&saved.artRevision===ART_REVISION?saved.marks:[];
const revisedLayers=new Set(saved.artRevision===ART_REVISION?[]:layers.filter(l=>!registry.get(l.patternId)?.customText).map(l=>l.id));
let state=new CompositionState(retainedMarks.filter(m=>![...revisedLayers].some(id=>m.key?.startsWith(id+':')))),scene,selected=layers[0]?.id||null;
let fabric=fabrics.some(f=>f.color===saved.fabric)?saved.fabric:fabrics[0].color,group='popular',tool='sew',style='stem',chosenColor=null,zoom=1,guides=true;
let speed=1,running=false,drawing=false,drag=null,next=0,carry=0,lastTime=0,active=null,dirty=true,lastRender=0,saveTimer,toastTimer,doneShown=false;
let machine=saved.machine!==false,sound=saved.sound!==false,volume=typeof saved.volume==='number'?saved.volume:.45;
const audio=new MachineAudio({enabled:sound,volume,machine});
let gallery=read(GALLERY,[]);if(!Array.isArray(gallery))gallery=[];gallery=gallery.filter(a=>a&&typeof a.image==='string'&&a.image.startsWith('data:image/png;')).slice(-12);
let exported=null;
let artworkReady=false;
let lastSewPoint=null;
let typewriterTimer=null;
let isComposing=false;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2700);}
function save(){clearTimeout(saveTimer);const customPatterns=[...new Set(layers.map(l=>l.patternId))].map(id=>registry.get(id)).filter(p=>p?.customText);const ok=write(KEY,{version:3,artRevision:ART_REVISION,layers,marks:[...state.marks.values()],customPatterns,fabric,machine,sound,volume});$('save-status').textContent=ok?'✓ 排版与针线已保存':'请下载图片留存';}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,450);}
function rebuild(){if(!artworkReady)return;scene=geometry.scene(layers,registry);const valid=new Set(scene.samples.map(s=>s.key));for(const key of state.marks.keys())if(!valid.has(key))state.marks.delete(key);next=0;dirty=true;doneShown=false;updateProgress();updateSelection();scheduleSave();}
function thumb(p){if(p.imageCrop&&!p.thumbnail)return '<span class="character-loading" aria-hidden="true">正在准备图案…</span>';if(p.image)return `<img class="character-preview" src="${p.thumbnail||p.image}" alt="" loading="lazy">`;const grain='thread-'+p.id;return `<svg viewBox="35 35 330 310" aria-hidden="true"><defs><pattern id="${grain}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path d="M0 1H5" stroke="#ffffff" stroke-opacity=".35" stroke-width=".9"/><path d="M0 4H5" stroke="#33291d" stroke-opacity=".08" stroke-width=".6"/></pattern></defs>${p.paths.map(s=>`<path d="${s.d}" fill="${s.fill||'none'}" stroke="${s.color}" stroke-width="${s.strokeWidth||3.2}" stroke-linecap="round" stroke-linejoin="round"/>${s.fill?`<path d="${s.d}" fill="url(#${grain})" stroke="none"/>`:''}`).join('')}</svg>`;}
function buildControls(){
  const query=$('pattern-search').value.trim().toLowerCase();
  $('pattern-grid').innerHTML=patterns.filter(p=>(p.group||'original')===group&&(!query||p.name.toLowerCase().includes(query))).map(p=>`<button class="pattern-card" data-pattern="${p.id}" aria-label="添加${p.name}"${p.unavailable?' disabled':''}>${thumb(p)}<span>${p.name}</span><b class="add-badge">＋</b></button>`).join('');
  document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('active',b.dataset.group===group);b.setAttribute('aria-pressed',b.dataset.group===group);});
  $('pattern-grid').hidden=group==='text';$('pattern-search').hidden=group==='text';$('text-composer').hidden=group!=='text';
  $('patterns-count').textContent=patterns.filter(p=>p.group==='popular').length+' 款人气角色';
  $('thread-palette').innerHTML=palette.map(p=>`<button class="spool-button" data-color="${p.color}" style="--thread-color:${p.color}" aria-label="使用${p.name}绣线" aria-pressed="${chosenColor===p.color}"><span class="spool"></span></button>`).join('');
  $('fabric-palette').innerHTML=fabrics.map(f=>`<button class="fabric-swatch${fabric===f.color?' active':''}" data-fabric="${f.color}" style="background:${f.color}" aria-label="使用${f.name}绣布" aria-pressed="${fabric===f.color}"></button>`).join('');
  $('gallery-count').textContent=gallery.length;updateSelection();
}
function updateSelection(){const l=layers.find(l=>l.id===selected),p=l&&registry.get(l.patternId);const isTw=l?.id==='typewriter-layer';$('selection-name').textContent=l?(isTw?'信笺正文（打字编辑）':`贴纸：${p?.name||'图案'}（可在布上拖动）`):'点选贴纸调整位置';$('layer-size').disabled=!l;$('layer-rotation').disabled=!l;$('delete-layer').disabled=!l;$('duplicate-layer').disabled=!l;$('layer-size').value=l?Math.round(l.scale*100):100;$('layer-size-value').textContent=l?Math.round(l.scale*100)+'%':'—';$('layer-rotation').value=l?.rotation||0;
  $('pattern-name').textContent='布上心意 · 刺绣信笺';$('pattern-description').textContent='在棉麻质感布料上写信，边写边绣，图案像表情包一样随心打出并可直接拖动位置。';$('pattern-number').textContent=`${layers.length} / 20 个元素`;
  const list=$('layer-list');list.replaceChildren();for(const layer of layers){const button=document.createElement('button');button.className='layer-chip'+(layer.id===selected?' active':'');button.textContent=registry.get(layer.patternId)?.name||'文字';button.setAttribute('aria-pressed',layer.id===selected);button.addEventListener('click',()=>{pause();selected=layer.id;updateSelection();dirty=true;});list.append(button);}
}
function updateProgress(){const total=scene?.samples.length||0,count=state.marks.size,percent=total?Math.floor(count/total*100):0;$('percent').textContent=percent;$('progress-fill').style.width=percent+'%';$('progress').setAttribute('aria-valuenow',percent);$('stitch-count').textContent=`${count} / ${total} 针`;$('undo').disabled=!count;$('save-art').disabled=!count;$('auto-stitch').disabled=!total||count===total;$('auto-stitch').innerHTML=icon(count===total&&total?'check':running?'pause':'play')+`<span>${count===total&&total?'绣好啦':running?'歇一小会':count?'继续慢绣':'开始慢绣'}</span>`;$('canvas-hint').textContent=running?'针头正在起落，正在自动刺绣打字…':'像写 Word 一样输入文字，从左上角边写边刺绣';}
function setTool(value){tool=value;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===value);b.setAttribute('aria-pressed',b.dataset.tool===value);});canvas.style.cursor=tool==='layout'?'grab':'crosshair';dirty=true;updateProgress();}
async function addLayer(pattern,position){
  if(!artworkReady){toast('正在准备角色原图，请稍等片刻');return false;}
  if(layers.length>=20){toast('一块绣布最多放20个元素，可以先移除一个');return false;}
  pause();
  if(pattern.image&&!geometry.artwork.has(pattern.id)){
    toast('正在准备'+pattern.name+'…');
    try{await geometry.prepareImage(pattern);}catch{toast(pattern.name+'暂时没有加载成功');return false;}
  }
  if(!registry.has(pattern.id))registry.set(pattern.id,pattern);
  const spots=[[140,130],[420,130],[700,130],[140,390],[420,390],[700,390],[280,260],[560,260],[420,255]];const spot=spots.find(([x,y])=>layers.every(l=>Math.hypot(l.x-x,l.y-y)>130))||spots[layers.length%spots.length];
  const layer={id:'layer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),patternId:pattern.id,x:spot[0],y:spot[1],scale:pattern.customText?1:.62,rotation:0,...position};
  layers.push(layer);selected=layer.id;setTool('sew');rebuild();return true;
}
function sync(){audio.setActive(running||drawing);$('canvas-stage').classList.toggle('stitching',machine&&(running||drawing));}
function pause(){running=false;carry=0;state.commit();sync();updateProgress();scheduleSave();dirty=true;}
function sew(p){
  const rect=canvas.getBoundingClientRect();
  const radius=Math.max(16/zoom,canvasRadius(22,rect,BOARD,zoom));
  let closest=null,distance=radius;
  for(const s of scene.samples){const d=Math.hypot(s.x-p.x,s.y-p.y);if(d<distance){distance=d;closest=s;}}
  if(!closest)return;
  let changed=false;
  for(let i=Math.max(0,closest.id-1);i<=Math.min(scene.samples.length-1,closest.id+1);i++){
    const s=scene.samples[i];if(s.layerId!==closest.layerId||s.path!==closest.path)continue;
    changed=addStitch(s)||changed;
  }
  if(changed){updateProgress();scheduleSave();dirty=true;}
}
function addStitch(s){const color=chosenColor||s.color;if(!state.add(s,color,style))return false;active={sample:s,color,at:performance.now()};audio.stitch();return true;}
function release(){
  if(drag){
    const draggedId=drag.id;
    drag=null;
    scheduleSave();
    const hasUnstitched=scene?.samples.some(s=>s.layerId===draggedId&&!state.marks.has(s.key));
    if(hasUnstitched)startStitching(draggedId);
  }
  if(drawing){drawing=false;state.commit();sync();scheduleSave();}
  lastSewPoint=null;dirty=true;
}

attachCanvasInput(canvas,{
  start(p){
    if(!artworkReady)return false;
    const pt=canvasPoint(p,canvas.getBoundingClientRect(),BOARD,zoom);
    if(pt.x<0||pt.y<0||pt.x>840||pt.y>510)return false;
    audio.unlock();
    const margin=canvasRadius(28,canvas.getBoundingClientRect(),BOARD,zoom);
    const hit=[...layers].reverse().find(l=>{
      if(l.id==='typewriter-layer')return false;
      const b=scene?.bounds.get(l.id);
      return b&&pt.x>b.minX-margin&&pt.x<b.maxX+margin&&pt.y>b.minY-margin&&pt.y<b.maxY+margin;
    });
    if(hit){
      pause();
      selected=hit.id;
      drag={id:hit.id,x:pt.x,y:pt.y,lx:hit.x,ly:hit.y};
      updateSelection();
      dirty=true;
      return true;
    }
    if(tool==='layout'){
      selected=null;
      updateSelection();
      dirty=true;
    }else{
      pause();
      drawing=true;
      lastSewPoint=pt;
      sync();
      sew(pt);
    }
    return true;
  },
  move(p){
    const pt=canvasPoint(p,canvas.getBoundingClientRect(),BOARD,zoom);
    if(drag){
      const l=layers.find(l=>l.id===drag.id);
      if(l){
        l.x=Math.max(20,Math.min(820,drag.lx+pt.x-drag.x));
        l.y=Math.max(25,Math.min(485,drag.ly+pt.y-drag.y));
        scene=geometry.scene(layers,registry);
        dirty=true;
      }
    }else if(drawing){
      if(lastSewPoint){
        const dist=Math.hypot(pt.x-lastSewPoint.x,pt.y-lastSewPoint.y);
        const steps=Math.max(1,Math.min(12,Math.floor(dist/8)));
        for(let i=1;i<=steps;i++){
          const t=i/steps;
          sew({x:lastSewPoint.x+(pt.x-lastSewPoint.x)*t,y:lastSewPoint.y+(pt.y-lastSewPoint.y)*t});
        }
      }else{
        sew(pt);
      }
      lastSewPoint=pt;
    }
  },
  end(){
    release();
  }
});

function startStitching(targetLayerId){
  if(!artworkReady||!scene?.samples.length)return;
  setTool('sew');
  audio.unlock();
  running=true;
  if(targetLayerId){
    const targetIdx=scene.samples.findIndex(s=>s.layerId===targetLayerId&&!state.marks.has(s.key));
    if(targetIdx>=0)next=targetIdx;
    else if(next>=scene.samples.length)next=0;
  }else{
    if(next>=scene.samples.length)next=0;
  }
  carry=0;
  lastTime=performance.now();
  sync();
  updateProgress();
}
function start(){
  if(!artworkReady||!scene?.samples.length)return;
  if(running){pause();return;}
  startStitching();
}
$('auto-stitch').addEventListener('click',start);
canvas.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();start();}});
function frame(time){
  const dt=Math.min(100,time-(lastTime||time));
  lastTime=time;
  if(running){
    carry+=dt*.036*speed;
    let n=Math.floor(carry);
    carry-=n;
    let changed=false;
    while(n-->0){
      while(next<scene.samples.length&&state.marks.has(scene.samples[next].key))next++;
      if(next>=scene.samples.length){
        next=0;
        while(next<scene.samples.length&&state.marks.has(scene.samples[next].key))next++;
        if(next>=scene.samples.length)break;
      }
      changed=addStitch(scene.samples[next++])||changed;
      if(state.pending.length>=20)state.commit();
    }
    if(changed){updateProgress();scheduleSave();dirty=true;}
    if(scene.samples.length&&state.marks.size===scene.samples.length&&!doneShown){
      doneShown=true;pause();save();toast('绣好啦！这一整幅心意，都是你的。');
    }
  }
  if((dirty||running||drawing||(active&&time-active.at<650))&&time-lastRender>35){
    painter.draw(scene,state,{fabric,zoom,guides,edit:false,selected,active:machine?active:null,running:running||drawing});
    dirty=false;
    lastRender=time;
  }
  requestAnimationFrame(frame);
}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{pause();setTool(b.dataset.tool);}));
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);audio.setSpeed(speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});}));
$('pattern-grid').addEventListener('click',async e=>{
  const b=e.target.closest('[data-pattern]');
  if(b){
    const pattern=registry.get(b.dataset.pattern);
    if(pattern){
      const added=await addLayer(pattern);
      if(added){
        startStitching(selected);
      }
    }
  }
});
$('pattern-groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;buildControls();}});
$('pattern-search').addEventListener('input',buildControls);
$('layer-size').addEventListener('input',e=>{pause();const l=layers.find(l=>l.id===selected);if(l){l.scale=Number(e.target.value)/100;rebuild();}});
$('layer-rotation').addEventListener('input',e=>{pause();const l=layers.find(l=>l.id===selected);if(l){l.rotation=Number(e.target.value);rebuild();}});
$('delete-layer').addEventListener('click',()=>{pause();state.removeLayer(selected);layers=layers.filter(l=>l.id!==selected);selected=layers.at(-1)?.id||null;rebuild();});
$('duplicate-layer').addEventListener('click',()=>{const l=layers.find(l=>l.id===selected);if(l)addLayer(registry.get(l.patternId),{x:Math.min(750,l.x+45),y:Math.min(450,l.y+35),scale:l.scale,rotation:l.rotation});});
$('arrange-layers')?.addEventListener('click',()=>{pause();layers=arrangeLayers(layers);rebuild();toast('已把图案与文字整理到大绣布上');});
$('expand-board')?.addEventListener('click',()=>{document.querySelector('.workshop').classList.toggle('wide');$('expand-board').textContent=document.querySelector('.workshop').classList.contains('wide')?'收起绣布':'展开绣布';dirty=true;});
$('thread-palette').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b){chosenColor=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});$('original-colors').setAttribute('aria-pressed',false);$('thread-name').textContent=palette.find(p=>p.color===chosenColor).name+' · 接下来的针线就用它';}});
$('original-colors').addEventListener('click',()=>{chosenColor=null;buildControls();$('thread-name').textContent='跟着每个图案，换上刚刚好的颜色';$('original-colors').setAttribute('aria-pressed',true);});
$('stitch-options').addEventListener('click',e=>{const b=e.target.closest('[data-stitch]');if(b){style=b.dataset.stitch;document.querySelectorAll('[data-stitch]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});}});
$('fabric-palette').addEventListener('click',e=>{const b=e.target.closest('[data-fabric]');if(b){fabric=b.dataset.fabric;buildControls();dirty=true;save();}});
function undo(){pause();if(state.undo()){dirty=true;updateProgress();save();toast('上一段针线已经拆下');}}
$('undo').addEventListener('click',undo);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!document.querySelector('dialog[open]')&&!['TEXTAREA','INPUT'].includes(document.activeElement.tagName)){e.preventDefault();undo();}});
$('guides').addEventListener('click',()=>{guides=!guides;$('guides').setAttribute('aria-pressed',guides);$('guides').classList.toggle('selected',guides);dirty=true;});
function zoomBy(amount){zoom=Math.max(.65,Math.min(2.5,+(zoom+amount).toFixed(2)));$('zoom-value').textContent=Math.round(zoom*100)+'%';dirty=true;}
$('zoom-in').addEventListener('click',()=>zoomBy(.2));$('zoom-out').addEventListener('click',()=>zoomBy(-.2));
$('reset').addEventListener('click',()=>{pause();$('reset-dialog').showModal();});$('confirm-reset').addEventListener('click',()=>{state=new CompositionState();active=null;doneShown=false;updateProgress();dirty=true;save();$('reset-dialog').close();});
function updateAudio(){audio.setEnabled(sound);audio.setMachine(machine);audio.setVolume(volume);$('sound').innerHTML=icon(sound&&volume?'sound':'mute');$('sound').setAttribute('aria-pressed',sound);$('sound').setAttribute('aria-label',sound?'关闭针线音效':'打开针线音效');$('machine-mode').classList.toggle('active',machine);$('machine-mode').setAttribute('aria-pressed',machine);$('machine-description').textContent=machine?'针头起落 · 压脚轻震 · 嗒嗒作响':'手绣模式 · 轻轻穿针，慢慢引线';$('volume').value=Math.round(volume*100);$('volume-value').textContent=Math.round(volume*100)+'%';sync();}
$('sound').addEventListener('click',()=>{sound=!sound;audio.unlock();updateAudio();save();});$('machine-mode').addEventListener('click',()=>{machine=!machine;audio.unlock();updateAudio();dirty=true;save();});$('volume').addEventListener('input',e=>{volume=Number(e.target.value)/100;sound=volume>0;audio.unlock();updateAudio();scheduleSave();});
function textOptions(){return{texture:$('text-texture')?.value||'cotton',roughness:Number($('text-roughness')?.value||28)/100,color:chosenColor||'rainbow',align:$('text-align')?.value||'left',lineWidth:Number($('text-width')?.value||8),lineSpacing:Number($('text-spacing')?.value||1.4),maxGlyphs:120,cellSize:46,marginLeft:115,marginTop:80};}
async function addText(){const b=$('add-text');if(b){b.disabled=true;b.textContent='正在穿针写字…';}try{const p=await makeTextPattern($('custom-text').value,textOptions());addLayer(p,{x:420,y:260,scale:1.2});startStitching(selected);toast('文字已放到绣布并开始自动刺绣');}catch(e){toast(e.message||'这段文字暂时没有绣好，请重试');}finally{if(b){b.disabled=false;b.textContent='把这些字放上绣布';}}}
$('add-text')?.addEventListener('click',addText);

async function syncTypewriterText(rawText){
  const text=String(rawText||'').replace(/\r\n?/g,'\n');
  if(!text.trim()){
    const existing=layers.find(l=>l.id==='typewriter-layer');
    if(existing){
      state.removeLayer('typewriter-layer');
      layers=layers.filter(l=>l.id!=='typewriter-layer');
      rebuild();
    }
    return;
  }
  if(layers.length&&layers.every(l=>typeof l.id==='string'&&l.id.startsWith('initial-'))){
    state=new CompositionState();
    layers=[];
  }
  try{
    const p=await makeTextPattern(text,{...textOptions(),documentMode:true});
    registry.set(p.id,p);
    geometry.cache.delete(p.id);
    let layer=layers.find(l=>l.id==='typewriter-layer');
    if(!layer){
      layer={id:'typewriter-layer',patternId:p.id,x:200,y:200,scale:1,rotation:0};
      layers.push(layer);
    }else{
      layer.patternId=p.id;
      layer.x=200;
      layer.y=200;
      layer.scale=1;
      layer.rotation=0;
    }
    selected='typewriter-layer';
    scene=geometry.scene(layers,registry);
    const valid=new Set(scene.samples.map(s=>s.key));
    for(const key of state.marks.keys())if(!valid.has(key))state.marks.delete(key);
    const targetIdx=scene.samples.findIndex(s=>s.layerId==='typewriter-layer'&&!state.marks.has(s.key));
    if(targetIdx>=0){
      next=targetIdx;
      startStitching('typewriter-layer');
    }
    dirty=true;
    doneShown=false;
    updateProgress();
    updateSelection();
    scheduleSave();
  }catch(err){
    console.warn('打字机提示:',err.message);
  }
}
function handleLiveTyping(rawVal){
  const val=String(rawVal||'').replace(/\\n/g,'\n');
  const twInput=$('typewriter-input'),customText=$('custom-text');
  if(twInput&&twInput.value!==val)twInput.value=val;
  if(customText&&customText.value!==val)customText.value=val;
  if($('text-count'))$('text-count').textContent=Array.from(val.replace(/\s/g,'')).length+'/120';
  clearTimeout(typewriterTimer);
  typewriterTimer=setTimeout(()=>syncTypewriterText(val),70);
}
const twInput=$('typewriter-input');
if(twInput){
  twInput.addEventListener('compositionstart',()=>{isComposing=true;});
  twInput.addEventListener('compositionend',e=>{isComposing=false;handleLiveTyping(e.target.value);});
  twInput.addEventListener('input',e=>{if(!isComposing)handleLiveTyping(e.target.value);});
}
const customText=$('custom-text');
if(customText){
  customText.addEventListener('compositionstart',()=>{isComposing=true;});
  customText.addEventListener('compositionend',e=>{isComposing=false;handleLiveTyping(e.target.value);});
  customText.addEventListener('input',e=>{if(!isComposing)handleLiveTyping(e.target.value);});
}
$('typewriter-clear')?.addEventListener('click',()=>{
  handleLiveTyping('');
});
$('clear-canvas')?.addEventListener('click',()=>{
  pause();
  layers=[];
  state=new CompositionState();
  if(twInput)twInput.value='';
  if(customText)customText.value='';
  selected=null;
  rebuild();
  toast('文稿已清空，像写 Word 一样输入文字即可自动刺绣');
});
document.querySelectorAll('[data-text-preset]').forEach(b=>b.addEventListener('click',()=>{
  const val=(b.dataset.textPreset||'').replace(/\\n/g,'\n');
  handleLiveTyping(val);
  if(val.includes('好累')){
    let cat=layers.find(l=>l.patternId==='cute-red-cat');
    if(!cat){
      cat={id:'sticker-cat',patternId:'cute-red-cat',x:55,y:45,scale:.46,rotation:0};
      layers.push(cat);
    }else{
      cat.x=55;cat.y=45;cat.scale=.46;
    }
    let persimmon=layers.find(l=>l.patternId==='green-persimmon');
    if(!persimmon){
      persimmon={id:'sticker-persimmon',patternId:'green-persimmon',x:515,y:128,scale:.48,rotation:0};
      layers.push(persimmon);
    }else{
      persimmon.x=515;persimmon.y=128;persimmon.scale=.48;
    }
    rebuild();
  }
}));
const quickStickerIds=['cute-red-cat','green-persimmon','nailong','kuromi','cinnamoroll','my-melody','luo-xiaohei','rilakkuma','hello-kitty','pochacco','garden-cat','little-bunny','tulip-day','sleepy-bear'];
function buildQuickStickers(){
  const container=$('quick-stickers');
  if(!container)return;
  container.innerHTML=quickStickerIds.map(id=>{
    const p=registry.get(id);
    if(!p)return '';
    return `<button class="quick-sticker-chip" data-quick-sticker="${p.id}" type="button" title="点击打出【${p.name}】表情贴纸并开始刺绣">${thumb(p)}<span>${p.name}</span></button>`;
  }).join('');
}
async function addSticker(patternId){
  if(!artworkReady){toast('正在准备角色贴纸，请稍等片刻…');return false;}
  if(layers.length>=20){toast('一张信笺最多放置 20 个图案与文字');return false;}
  const pattern=registry.get(patternId);
  if(!pattern)return false;
  pause();
  if(pattern.image&&!geometry.artwork.has(pattern.id)){
    toast('正在准备'+pattern.name+'贴纸…');
    try{await geometry.prepareImage(pattern);}catch{toast(pattern.name+'暂时未能加载');return false;}
  }
  if(!registry.has(pattern.id))registry.set(pattern.id,pattern);
  const spots=[[640,360],[640,160],[160,380],[400,380],[640,260],[320,240],[520,240]];
  const spot=spots.find(([x,y])=>layers.every(l=>Math.hypot(l.x-x,l.y-y)>110))||spots[layers.length%spots.length];
  const layer={id:'sticker-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),patternId:pattern.id,x:spot[0],y:spot[1],scale:.52,rotation:0};
  layers.push(layer);
  selected=layer.id;
  rebuild();
  startStitching(layer.id);
  toast(`已打出【${pattern.name}】贴纸，开始刺绣～ 可在布上直接拖动位置`);
  return true;
}
$('quick-stickers')?.addEventListener('click',async e=>{
  const b=e.target.closest('[data-quick-sticker]');
  if(b)await addSticker(b.dataset.quickSticker);
});
document.querySelector('.quick-pos-group')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-pos]');
  if(!b||!selected)return;
  const l=layers.find(l=>l.id===selected);
  if(!l||l.id==='typewriter-layer')return;
  pause();
  const pos=b.dataset.pos;
  if(pos==='top-right'){l.x=650;l.y=150;}
  else if(pos==='bottom-right'){l.x=650;l.y=370;}
  else if(pos==='bottom-left'){l.x=180;l.y=370;}
  else if(pos==='center'){l.x=420;l.y=255;}
  scene=geometry.scene(layers,registry);
  dirty=true;
  scheduleSave();
  toast('已将贴纸调整到'+b.textContent);
});

$('open-letter').addEventListener('click',()=>{pause();$('letter-dialog').showModal();});
$('build-letter').addEventListener('click',async()=>{const button=$('build-letter');button.disabled=true;button.textContent='正在把信写进针线里…';try{
  const parts=[{text:$('letter-to').value,x:275,y:80,scale:1.05,align:'left',width:9},{text:$('letter-body').value,x:420,y:275,scale:1.85,align:'left',width:11},{text:$('letter-sign').value,x:655,y:440,scale:.9,align:'right',width:10}].filter(p=>p.text.trim());
  if(layers.length+parts.length>20)throw new Error('绣布空间满了，请先移除几个元素');
  const generated=await Promise.all(parts.map(async part=>({part,pattern:await makeTextPattern(part.text,{...textOptions(),align:part.align,lineWidth:part.width,lineSpacing:1.55})})));
  const motifs=layers.filter(l=>!registry.get(l.patternId)?.customText);motifs.forEach((l,i)=>{l.scale=.38;l.x=i%2?745:95;l.y=90+Math.floor(i/2)*155;l.rotation=i%2?3:-3;});
  generated.forEach(({part,pattern},i)=>addLayer(pattern,{x:i===0?365:i===1?420:620,y:i===0?65:i===1?265:450,scale:i===1?1.25:.78}));$('letter-dialog').close();
  startStitching();toast('绣信已排好并开始自动刺绣');
}catch(e){toast(e.message||'文字准备失败，请稍后重试');}finally{button.disabled=false;button.textContent='把这封信铺到绣布上';}});
function openExport(item){pause();dirty=true;exported=item?{...item}:{name:'我的心意绣布',patternId:'composition',percent:scene.samples.length?Math.floor(state.marks.size/scene.samples.length*100):0,image:painter.image(scene,state,{fabric},1500)};$('export-preview').src=exported.image;$('export-preview').alt=exported.name||'我的心意绣布';$('export-title').textContent='把这一幅心意，留在身边。';$('export-caption').textContent=`${exported.name||'我的绣作'} · 已绣好${exported.percent}%`;$('collect').disabled=!!item;$('collect').innerHTML=icon(item?'check':'heart')+(item?'已在收藏里':'收藏绣作');$('export-dialog').showModal();}
$('save-art').addEventListener('click',()=>openExport());$('collect').addEventListener('click',()=>{const nextGallery=[...gallery,{...exported,image:painter.image(scene,state,{fabric},700),date:new Date().toISOString(),id:Date.now().toString()}].slice(-12);if(write(GALLERY,nextGallery)){gallery=nextGallery;$('gallery-count').textContent=gallery.length;$('collect').disabled=true;toast('已经放进你的绣作收藏');}dirty=true;});
$('download').addEventListener('click',()=>{const a=document.createElement('a');a.href=exported.image;a.download='一针一线-心意绣布.png';a.click();});
$('open-gallery').addEventListener('click',()=>{pause();const list=$('gallery-items');list.replaceChildren();if(!gallery.length){list.innerHTML='<div class="gallery-empty">把绣好的图案和信，收藏在这里。</div>';}for(const item of [...gallery].reverse()){const b=document.createElement('button');b.className='gallery-item';const img=document.createElement('img');img.src=item.image;img.alt=item.name||registry.get(item.patternId)?.name||'我的绣作';const meta=document.createElement('span');meta.className='gallery-meta';meta.textContent=img.alt;b.append(img,meta);b.addEventListener('click',()=>{$('gallery-dialog').close();openExport(item);});list.append(b);}$('gallery-dialog').showModal();});
$('open-help').addEventListener('click',()=>{pause();$('help-dialog').showModal();});$('nav-workbench').addEventListener('click',()=>canvas.focus());document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)b.closest('dialog').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();release();save();}});window.addEventListener('pagehide',save);
installDialogFallback(document.querySelectorAll('dialog'));
buildControls();setTool('sew');updateAudio();$('auto-stitch').disabled=true;
$('save-status').textContent='正在准备图案…';painter.draw({paths:[],samples:[],bounds:new Map()},new CompositionState(),{fabric});
const activePatternIds=new Set(layers.map(l=>l.patternId));
const initialJobs=patterns.filter(p=>p.image&&activePatternIds.has(p.id)).map(async p=>{
  try{await geometry.prepareImage(p);}catch(error){p.unavailable=true;console.warn('角色素材加载失败：'+p.name,error.message);}
});
Promise.all(initialJobs).then(()=>{
  artworkReady=true;rebuild();buildControls();buildQuickStickers();dirty=true;requestAnimationFrame(frame);
  if(!layers.length||(layers.length===5&&layers.every(l=>typeof l.id==='string'&&l.id.startsWith('initial-')))){
    state=new CompositionState();
    layers=[];
    if(twInput)twInput.value='';
    if(customText)customText.value='';
    if($('text-count'))$('text-count').textContent='0/120';
    rebuild();
  }
  (async()=>{
    const remaining=patterns.filter(p=>p.image&&!activePatternIds.has(p.id));
    for(const p of remaining){
      try{await geometry.prepareImage(p);if(group==='popular')buildControls();buildQuickStickers();}catch(e){p.unavailable=true;}
    }
  })();
});
