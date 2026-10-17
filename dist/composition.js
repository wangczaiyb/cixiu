export const BOARD = { width: 1100, height: 800, ox: 130, oy: 145, artWidth: 840, artHeight: 510 };
export function transformPoint(point, layer) {
  const angle = (layer.rotation || 0) * Math.PI / 180;
  const x = (point.x - 200) * layer.scale, y = (point.y - 200) * layer.scale;
  return { x: layer.x + x * Math.cos(angle) - y * Math.sin(angle), y: layer.y + x * Math.sin(angle) + y * Math.cos(angle) };
}
export function defaultLayers(ids) {
  const positions = [[150,140],[420,140],[690,140],[280,385],[560,385]];
  return ids.slice(0,5).map((patternId,i) => ({id:`initial-${i}`,patternId,x:positions[i][0],y:positions[i][1],scale:.64,rotation:i%2?2:-2}));
}
export function arrangeLayers(layers) {
  const cols = Math.min(4, Math.ceil(Math.sqrt(layers.length * 1.6))), rows = Math.ceil(layers.length / cols);
  return layers.map((layer,i) => ({...layer,x:(i%cols+.5)*840/cols,y:(Math.floor(i/cols)+.5)*510/rows,scale:Math.min(.82,2.0/rows,2.3/cols),rotation:0}));
}
export class CompositionState {
  constructor(saved=[]) {this.marks=new Map();this.history=[];this.pending=[];
    for(const m of saved) if(m&&typeof m.key==='string'&&m.key.length<160&&/^#[0-9a-f]{6}$/i.test(m.color)&&['stem','cross','running'].includes(m.style)) this.marks.set(m.key,m);
  }
  add(sample,color,style){if(this.marks.has(sample.key))return false;this.marks.set(sample.key,{key:sample.key,color,style});this.pending.push(sample.key);return true;}
  commit(){if(this.pending.length)this.history.push(this.pending.splice(0));}
  undo(){this.commit();const keys=this.history.pop()||[];for(const key of keys)this.marks.delete(key);return keys.length;}
  removeLayer(id){for(const key of this.marks.keys())if(key.startsWith(id+':'))this.marks.delete(key);}
}
export class Geometry {
  constructor(){this.cache=new Map();}
  get(pattern){
    if(this.cache.has(pattern.id))return this.cache.get(pattern.id);
    const paths=[],samples=[];
    for(const meta of pattern.paths)for(const d of meta.d.split(/(?=M)/).filter(Boolean)){
      const element=document.createElementNS('http://www.w3.org/2000/svg','path');element.setAttribute('d',d);
      const length=element.getTotalLength(),count=Math.max(2,Math.ceil(length/(meta.handmade?2.5:3.4))),path=paths.length;
      paths.push({...meta,path:new Path2D(d)});
      for(let i=0;i<count;i++){const a=element.getPointAtLength(i/count*length),b=element.getPointAtLength((i+1)/count*length);samples.push({...meta,path,n:i,x1:a.x,y1:a.y,x2:b.x,y2:b.y,x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
    }
    const data={paths,samples};this.cache.set(pattern.id,data);return data;
  }
  scene(layers,registry){const samples=[],paths=[],bounds=new Map();
    for(const layer of layers){const pattern=registry.get(layer.patternId);if(!pattern)continue;const g=this.get(pattern);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const s of g.samples){const a=transformPoint({x:s.x1,y:s.y1},layer),b=transformPoint({x:s.x2,y:s.y2},layer);const x=(a.x+b.x)/2,y=(a.y+b.y)/2;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);samples.push({...s,id:samples.length,key:`${layer.id}:${s.path}:${s.n}`,layerId:layer.id,x1:a.x,y1:a.y,x2:b.x,y2:b.y,x,y,scale:layer.scale});}
      paths.push(...g.paths.map(p=>({...p,layer})));bounds.set(layer.id,{minX:minX-10,minY:minY-10,maxX:maxX+10,maxY:maxY+10});
    }return{samples,paths,bounds};
  }
}
