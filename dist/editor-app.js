import {patterns,palette,fabrics} from './patterns.js';
import {BOARD,defaultLayers,arrangeLayers,CompositionState,Geometry} from './composition.js';
import {Painter} from './renderer.js';
import {MachineAudio} from './machine-audio.js';
import {makeTextPattern} from './text-strokes.js';
const $=id=>document.getElementById(id),icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const canvas=$('embroidery'),geometry=new Geometry(),painter=new Painter(canvas),registry=new Map(patterns.map(p=>[p.id,p]));
for(const id of ['custom-text','letter-body','letter-sign'])$(id).value=$(id).value.replace(/\\n/g,'\n');
const KEY='little-stitch-composition-v3',GALLERY='little-stitch-gallery-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('浏览器存储空间不足，请下载图片留存');return false;}}
const saved=read(KEY,{});
for(const p of (saved.customPatterns||[]).slice(0,20))if(typeof p.id==='string'&&p.id.startsWith('text-')&&Array.isArray(p.paths)&&p.paths.length<4000&&p.paths.every(s=>typeof s.d==='string'&&s.d.length<15000&&/^#[0-9a-f]{6}$/i.test(s.color)))registry.set(p.id,p);
let layers=Array.isArray(saved.layers)?saved.layers.filter(l=>registry.has(l.patternId)&&Number.isFinite(l.x)&&Number.isFinite(l.y)&&Number.isFinite(l.scale)&&l.scale>=.15&&l.scale<=3&&typeof l.id==='string').slice(0,20):defaultLayers(['hello-kitty','kuromi','cinnamoroll','my-melody','pompompurin']);
let state=new CompositionState(Array.isArray(saved.marks)?saved.marks:[]),scene,selected=layers[0]?.id||null;
let fabric=fabrics.some(f=>f.color===saved.fabric)?saved.fabric:fabrics[0].color,group='popular',tool='layout',style='stem',chosenColor=null,zoom=1,guides=true;
let speed=1,running=false,drawing=false,drag=null,next=0,carry=0,lastTime=0,active=null,dirty=true,lastRender=0,saveTimer,toastTimer,doneShown=false;
let machine=saved.machine!==false,sound=saved.sound!==false,volume=typeof saved.volume==='number'?saved.volume:.45;
const audio=new MachineAudio({enabled:sound,volume,machine});
let gallery=read(GALLERY,[]);if(!Array.isArray(gallery))gallery=[];gallery=gallery.filter(a=>a&&typeof a.image==='string'&&a.image.startsWith('data:image/png;')).slice(-12);
let exported=null;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2700);}
function save(){clearTimeout(saveTimer);const customPatterns=[...new Set(layers.map(l=>l.patternId))].map(id=>registry.get(id)).filter(p=>p?.customText);const ok=write(KEY,{version:3,layers,marks:[...state.marks.values()],customPatterns,fabric,machine,sound,volume});$('save-status').textContent=ok?'✓ 排版与针线已保存':'请下载图片留存';}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,450);}
function rebuild(){scene=geometry.scene(layers,registry);const valid=new Set(scene.samples.map(s=>s.key));for(const key of state.marks.keys())if(!valid.has(key))state.marks.delete(key);next=0;dirty=true;doneShown=false;updateProgress();updateSelection();scheduleSave();}
function thumb(p){return `<svg viewBox="35 35 330 310" aria-hidden="true">${p.paths.map(s=>`<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth||4}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;}
function buildControls(){
  const query=$('pattern-search').value.trim().toLowerCase();
  $('pattern-grid').innerHTML=patterns.filter(p=>(p.group||'original')===group&&(!query||p.name.toLowerCase().includes(query))).map(p=>`<button class="pattern-card" data-pattern="${p.id}" aria-label="添加${p.name}">${thumb(p)}<span>${p.name}</span><b class="add-badge">＋</b></button>`).join('');
  document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('active',b.dataset.group===group);b.setAttribute('aria-pressed',b.dataset.group===group);});
  $('pattern-grid').hidden=group==='text';$('pattern-search').hidden=group==='text';$('text-composer').hidden=group!=='text';
  $('patterns-count').textContent=patterns.filter(p=>p.group==='popular').length+' 款人气角色';
  $('thread-palette').innerHTML=palette.map(p=>`<button class="spool-button" data-color="${p.color}" style="--thread-color:${p.color}" aria-label="使用${p.name}绣线" aria-pressed="${chosenColor===p.color}"><span class="spool"></span></button>`).join('');
  $('fabric-palette').innerHTML=fabrics.map(f=>`<button class="fabric-swatch${fabric===f.color?' active':''}" data-fabric="${f.color}" style="background:${f.color}" aria-label="使用${f.name}绣布" aria-pressed="${fabric===f.color}"></button>`).join('');
  $('gallery-count').textContent=gallery.length;updateSelection();
}
function updateSelection(){const l=layers.find(l=>l.id===selected),p=l&&registry.get(l.patternId);$('selection-name').textContent=p?p.name:'点选图案或文字';$('layer-size').disabled=!l;$('layer-rotation').disabled=!l;$('delete-layer').disabled=!l;$('duplicate-layer').disabled=!l;$('layer-size').value=l?Math.round(l.scale*100):100;$('layer-size-value').textContent=l?Math.round(l.scale*100)+'%':'—';$('layer-rotation').value=l?.rotation||0;
  $('pattern-name').textContent='我的心意绣布';$('pattern-description').textContent='把角色、文字和小心愿，慢慢排在一起。';$('pattern-number').textContent=`${layers.length} / 20 个元素`;
  const list=$('layer-list');list.replaceChildren();for(const layer of layers){const button=document.createElement('button');button.className='layer-chip'+(layer.id===selected?' active':'');button.textContent=registry.get(layer.patternId)?.name||'文字';button.setAttribute('aria-pressed',layer.id===selected);button.addEventListener('click',()=>{pause();selected=layer.id;setTool('layout');updateSelection();dirty=true;});list.append(button);}
}
function updateProgress(){const total=scene?.samples.length||0,count=state.marks.size,percent=total?Math.floor(count/total*100):0;$('percent').textContent=percent;$('progress-fill').style.width=percent+'%';$('progress').setAttribute('aria-valuenow',percent);$('stitch-count').textContent=`${count} / ${total} 针`;$('undo').disabled=!count;$('save-art').disabled=!count;$('auto-stitch').disabled=!total||count===total;$('auto-stitch').innerHTML=icon(count===total&&total?'check':running?'pause':'play')+`<span>${count===total&&total?'绣好啦':running?'歇一小会':count?'继续慢绣':'开始慢绣'}</span>`;$('canvas-hint').textContent=tool==='layout'?'拖动摆放 · 下方单独调大小 · 图案和文字可以一起绣':running?'针头正在起落，一点点绣出你的心意':'按住并沿虚线拖动，或让针织机帮你慢慢绣';}
function setTool(value){tool=value;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===value);b.setAttribute('aria-pressed',b.dataset.tool===value);});canvas.style.cursor=tool==='layout'?'grab':'crosshair';dirty=true;updateProgress();}
function addLayer(pattern,position){if(layers.length>=20){toast('一块绣布最多放20个元素，可以先移除一个');return false;}pause();if(!registry.has(pattern.id))registry.set(pattern.id,pattern);
  const spots=[[140,130],[420,130],[700,130],[140,390],[420,390],[700,390],[280,260],[560,260],[420,255]];const spot=spots.find(([x,y])=>layers.every(l=>Math.hypot(l.x-x,l.y-y)>130))||spots[layers.length%spots.length];
  const layer={id:'layer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),patternId:pattern.id,x:spot[0],y:spot[1],scale:pattern.customText?1:.62,rotation:0,...position};layers.push(layer);selected=layer.id;setTool('layout');rebuild();return true;}
function point(event){const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/BOARD.width,r.height/BOARD.height),left=r.left+(r.width-BOARD.width*scale)/2,top=r.top+(r.height-BOARD.height*scale)/2;const x=(event.clientX-left)/scale,y=(event.clientY-top)/scale;return{x:(x-BOARD.width/2)/zoom+BOARD.width/2-BOARD.ox,y:(y-BOARD.height/2)/zoom+BOARD.height/2-BOARD.oy};}
function sync(){audio.setActive(running||drawing);$('canvas-stage').classList.toggle('stitching',machine&&(running||drawing));}
function pause(){running=false;carry=0;state.commit();sync();updateProgress();scheduleSave();dirty=true;}
function sew(p){let closest=null,distance=15/zoom;for(const s of scene.samples){const d=Math.hypot(s.x-p.x,s.y-p.y);if(d<distance){distance=d;closest=s;}}if(!closest)return;let changed=false;for(let i=Math.max(0,closest.id-1);i<=Math.min(scene.samples.length-1,closest.id+1);i++){const s=scene.samples[i];if(s.layerId!==closest.layerId||s.path!==closest.path)continue;changed=addStitch(s)||changed;}if(changed){updateProgress();scheduleSave();dirty=true;}}
function addStitch(s){const color=chosenColor||s.color;if(!state.add(s,color,style))return false;active={sample:s,color,at:performance.now()};audio.stitch();return true;}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=point(e);if(p.x<0||p.y<0||p.x>840||p.y>510)return;pause();canvas.setPointerCapture(e.pointerId);
  if(tool==='layout'){const hit=[...layers].reverse().find(l=>{const b=scene.bounds.get(l.id);return b&&p.x>b.minX&&p.x<b.maxX&&p.y>b.minY&&p.y<b.maxY;});if(hit){selected=hit.id;drag={id:hit.id,x:p.x,y:p.y,lx:hit.x,ly:hit.y};updateSelection();dirty=true;}else{selected=null;updateSelection();dirty=true;}}
  else{drawing=true;audio.unlock();sync();sew(p);}});
canvas.addEventListener('pointermove',e=>{const p=point(e);if(drag){const l=layers.find(l=>l.id===drag.id);if(l){l.x=Math.max(30,Math.min(810,drag.lx+p.x-drag.x));l.y=Math.max(35,Math.min(475,drag.ly+p.y-drag.y));scene=geometry.scene(layers,registry);dirty=true;}}else if(drawing)sew(p);});
function release(){if(drag){drag=null;scheduleSave();}if(drawing){drawing=false;state.commit();sync();scheduleSave();}dirty=true;}
for(const name of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
function start(){if(running){pause();return;}if(!scene.samples.length)return;setTool('sew');audio.unlock();running=true;next=0;carry=0;lastTime=performance.now();sync();updateProgress();}
$('auto-stitch').addEventListener('click',start);
canvas.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();start();}});
function frame(time){const dt=Math.min(100,time-(lastTime||time));lastTime=time;if(running){carry+=dt*.036*speed;let n=Math.floor(carry);carry-=n;let changed=false;while(n-->0){while(next<scene.samples.length&&state.marks.has(scene.samples[next].key))next++;if(next>=scene.samples.length)break;changed=addStitch(scene.samples[next++])||changed;if(state.pending.length>=20)state.commit();}if(changed){updateProgress();scheduleSave();dirty=true;}if(scene.samples.length&&state.marks.size===scene.samples.length&&!doneShown){doneShown=true;pause();save();toast('绣好啦！这一整幅心意，都是你的。');}}
  if((dirty||running||drawing||(active&&time-active.at<650))&&time-lastRender>35){painter.draw(scene,state,{fabric,zoom,guides,edit:tool==='layout',selected,active:machine?active:null,running:running||drawing});dirty=false;lastRender=time;}requestAnimationFrame(frame);}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{pause();setTool(b.dataset.tool);}));
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);audio.setSpeed(speed);document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});}));
$('pattern-grid').addEventListener('click',e=>{const b=e.target.closest('[data-pattern]');if(b)addLayer(registry.get(b.dataset.pattern));});
$('pattern-groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;buildControls();}});
$('pattern-search').addEventListener('input',buildControls);
$('layer-size').addEventListener('input',e=>{pause();const l=layers.find(l=>l.id===selected);if(l){l.scale=Number(e.target.value)/100;rebuild();}});
$('layer-rotation').addEventListener('input',e=>{pause();const l=layers.find(l=>l.id===selected);if(l){l.rotation=Number(e.target.value);rebuild();}});
$('delete-layer').addEventListener('click',()=>{pause();state.removeLayer(selected);layers=layers.filter(l=>l.id!==selected);selected=layers.at(-1)?.id||null;rebuild();});
$('duplicate-layer').addEventListener('click',()=>{const l=layers.find(l=>l.id===selected);if(l)addLayer(registry.get(l.patternId),{x:Math.min(750,l.x+45),y:Math.min(450,l.y+35),scale:l.scale,rotation:l.rotation});});
$('arrange-layers').addEventListener('click',()=>{pause();layers=arrangeLayers(layers);rebuild();toast('已把图案与文字整理到大绣布上');});
$('expand-board').addEventListener('click',()=>{document.querySelector('.workshop').classList.toggle('wide');$('expand-board').textContent=document.querySelector('.workshop').classList.contains('wide')?'收起绣布':'展开绣布';dirty=true;});
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
function textOptions(){return{texture:$('text-texture').value,roughness:Number($('text-roughness').value)/100,color:chosenColor||'#cf9290',align:$('text-align').value,lineWidth:Number($('text-width').value),lineSpacing:Number($('text-spacing').value),maxGlyphs:120};}
async function addText(){const b=$('add-text');b.disabled=true;b.textContent='正在穿针写字…';try{const p=await makeTextPattern($('custom-text').value,textOptions());addLayer(p,{x:420,y:260,scale:1.2});toast('文字已放到绣布上，可拖动和单独调大小');}catch(e){toast(e.message||'这段文字暂时没有绣好，请重试');}finally{b.disabled=false;b.textContent='把这些字放上绣布';}}
$('add-text').addEventListener('click',addText);document.querySelectorAll('[data-text-preset]').forEach(b=>b.addEventListener('click',()=>{$('custom-text').value=b.dataset.textPreset;}));
$('custom-text').addEventListener('input',()=>{$('text-count').textContent=Array.from($('custom-text').value.replace(/\s/g,'')).length+'/120';});
$('open-letter').addEventListener('click',()=>{pause();$('letter-dialog').showModal();});
$('build-letter').addEventListener('click',async()=>{const button=$('build-letter');button.disabled=true;button.textContent='正在把信写进针线里…';try{
  const parts=[{text:$('letter-to').value,x:275,y:80,scale:1.05,align:'left',width:9},{text:$('letter-body').value,x:420,y:275,scale:1.85,align:'left',width:11},{text:$('letter-sign').value,x:655,y:440,scale:.9,align:'right',width:10}].filter(p=>p.text.trim());
  if(layers.length+parts.length>20)throw new Error('绣布空间满了，请先移除几个元素');
  const generated=await Promise.all(parts.map(async part=>({part,pattern:await makeTextPattern(part.text,{...textOptions(),align:part.align,lineWidth:part.width,lineSpacing:1.55})})));
  const motifs=layers.filter(l=>!registry.get(l.patternId)?.customText);motifs.forEach((l,i)=>{l.scale=.38;l.x=i%2?745:95;l.y=90+Math.floor(i/2)*155;l.rotation=i%2?3:-3;});
  generated.forEach(({part,pattern},i)=>addLayer(pattern,{x:i===0?365:i===1?420:620,y:i===0?65:i===1?265:450,scale:i===1?1.25:.78}));$('letter-dialog').close();toast('绣信已排好，称呼、正文、落款都可以单独调整');
}catch(e){toast(e.message||'文字准备失败，请稍后重试');}finally{button.disabled=false;button.textContent='把这封信铺到绣布上';}});
function openExport(item){pause();dirty=true;exported=item?{...item}:{name:'我的心意绣布',patternId:'composition',percent:scene.samples.length?Math.floor(state.marks.size/scene.samples.length*100):0,image:painter.image(scene,state,{fabric},1500)};$('export-preview').src=exported.image;$('export-preview').alt=exported.name||'我的心意绣布';$('export-title').textContent='把这一幅心意，留在身边。';$('export-caption').textContent=`${exported.name||'我的绣作'} · 已绣好${exported.percent}%`;$('collect').disabled=!!item;$('collect').innerHTML=icon(item?'check':'heart')+(item?'已在收藏里':'收藏绣作');$('export-dialog').showModal();}
$('save-art').addEventListener('click',()=>openExport());$('collect').addEventListener('click',()=>{const nextGallery=[...gallery,{...exported,image:painter.image(scene,state,{fabric},700),date:new Date().toISOString(),id:Date.now().toString()}].slice(-12);if(write(GALLERY,nextGallery)){gallery=nextGallery;$('gallery-count').textContent=gallery.length;$('collect').disabled=true;toast('已经放进你的绣作收藏');}dirty=true;});
$('download').addEventListener('click',()=>{const a=document.createElement('a');a.href=exported.image;a.download='一针一线-心意绣布.png';a.click();});
$('open-gallery').addEventListener('click',()=>{pause();const list=$('gallery-items');list.replaceChildren();if(!gallery.length){list.innerHTML='<div class="gallery-empty">把绣好的图案和信，收藏在这里。</div>';}for(const item of [...gallery].reverse()){const b=document.createElement('button');b.className='gallery-item';const img=document.createElement('img');img.src=item.image;img.alt=item.name||registry.get(item.patternId)?.name||'我的绣作';const meta=document.createElement('span');meta.className='gallery-meta';meta.textContent=img.alt;b.append(img,meta);b.addEventListener('click',()=>{$('gallery-dialog').close();openExport(item);});list.append(b);}$('gallery-dialog').showModal();});
$('open-help').addEventListener('click',()=>{pause();$('help-dialog').showModal();});$('nav-workbench').addEventListener('click',()=>canvas.focus());document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)b.closest('dialog').close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();release();save();}});window.addEventListener('pagehide',save);
rebuild();buildControls();setTool('layout');updateAudio();requestAnimationFrame(frame);
