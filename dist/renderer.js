import {BOARD} from './composition.js';
const {width:W,height:H,ox:OX,oy:OY}=BOARD;
function round(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
export class Painter {
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');
    const tile=document.createElement('canvas');tile.width=tile.height=96;const t=tile.getContext('2d');
    // Alternating satin floats, fine crossing fibres and real needle holes.
    for(let y=0;y<96;y+=4){t.fillStyle=y%8?'#fffff048':'#fff9e95c';t.fillRect(0,y,96,2.5);t.fillStyle='#8e80521a';t.fillRect(0,y+2.6,96,.55);}
    for(let x=0;x<96;x+=4){t.fillStyle=x%8?'#fffdee32':'#a4936120';t.fillRect(x,0,1.7,96);}
    for(let y=4;y<96;y+=8)for(let x=4;x<96;x+=8){t.fillStyle='#6b644428';t.beginPath();t.ellipse(x,y,.85,.65,0,0,Math.PI*2);t.fill();t.fillStyle='#fffef0a0';t.fillRect(x-.6,y+1.1,1.5,.6);}
    this.texture=this.c.createPattern(tile,'repeat');
  }
  cloth(fabric){const c=this.c;c.save();c.shadowColor='#5c51372b';c.shadowBlur=22;c.shadowOffsetY=11;c.fillStyle='#b69a68';round(c,49,59,1002,682,40);c.fill();c.shadowColor='transparent';
    const wood=c.createLinearGradient(50,70,1060,710);wood.addColorStop(0,'#e3cfa4');wood.addColorStop(.4,'#c4a878');wood.addColorStop(.65,'#e7d4ab');wood.addColorStop(1,'#b99c6c');c.fillStyle=wood;round(c,51,59,998,680,38);c.fill();
    for(let i=0;i<7;i++){c.strokeStyle=i%2?'#fff0c94a':'#89704d30';c.lineWidth=.7;round(c,54+i*2,62+i*2,992-i*4,674-i*4,35-i*1.3);c.stroke();}
    c.fillStyle=fabric;round(c,73,81,954,636,20);c.fill();c.save();round(c,74,82,952,634,19);c.clip();c.fillStyle=this.texture;c.fillRect(70,80,960,640);
    const sheen=c.createLinearGradient(70,80,1030,720);sheen.addColorStop(0,'#fffdf04a');sheen.addColorStop(.4,'#fffbea06');sheen.addColorStop(.65,'#bca77113');sheen.addColorStop(1,'#ffffff2e');c.fillStyle=sheen;c.fillRect(70,80,960,640);c.restore();
    c.strokeStyle='#a88c5f99';c.lineWidth=2;round(c,73,81,954,636,20);c.stroke();c.strokeStyle='#fff4d49c';c.lineWidth=1;round(c,70,78,960,642,22);c.stroke();
    c.strokeStyle='#ac997740';c.lineWidth=.75;c.setLineDash([2,7]);round(c,95,103,910,592,11);c.stroke();c.setLineDash([]);
    for(const x of[280,780]){c.fillStyle='#b9a279';round(c,x-22,47,44,18,3);c.fill();const metal=c.createLinearGradient(0,41,0,49);metal.addColorStop(0,'#8c8d7b');metal.addColorStop(.5,'#e5e3d1');metal.addColorStop(1,'#a09c85');c.fillStyle=metal;round(c,x-33,43,66,7,2);c.fill();}c.restore();
  }
  stitch(s,m){const c=this.c,dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    if(m.style==='running'&&s.n%3===2)return;
    const hand=s.handmade,texture=s.texture||'cotton',wave=hand?Math.sin(s.n*1.73+s.path)*.4:0;
    const width=(hand?(texture==='wool'?5.1:3.7):3.2)*Math.max(.6,Math.min(1.7,s.scale||1));
    const shape=(offset)=>{c.beginPath();if(m.style==='cross'){const k=Math.max(1.5,2.8*(s.scale||1));c.moveTo(s.x-k,s.y-k+offset);c.lineTo(s.x+k,s.y+k+offset);c.moveTo(s.x+k,s.y-k+offset);c.lineTo(s.x-k,s.y+k+offset);}else{c.moveTo(s.x1-dx*.09,s.y1-dy*.09+offset);c.quadraticCurveTo(s.x+nx*(.6+wave),s.y+ny*(.6+wave)+offset,s.x2+dx*.1,s.y2+dy*.1+offset);}};
    c.lineCap=c.lineJoin='round';shape(1.1);c.strokeStyle='#5441242f';c.lineWidth=width+1.4;c.stroke();shape(0);c.strokeStyle=m.color;c.lineWidth=width;c.stroke();shape(-.65);c.strokeStyle='#fff5de80';c.lineWidth=Math.max(.5,width*.22);c.stroke();
    c.strokeStyle='#fff6de55';c.lineWidth=.5;c.beginPath();c.moveTo(s.x-nx*width*.35-dx*.25,s.y-ny*width*.35-dy*.25);c.lineTo(s.x+nx*width*.35+dx*.25,s.y+ny*width*.35+dy*.25);c.stroke();
    if(hand&&texture==='wool'&&s.n%2===0){c.strokeStyle=m.color+'66';c.lineWidth=.45;c.beginPath();c.moveTo(s.x+nx*width*.45,s.y+ny*width*.45);c.lineTo(s.x+nx*(width*.7),s.y+ny*(width*.7)-.9);c.stroke();}
    c.fillStyle='#57452b35';c.beginPath();c.ellipse(s.x1,s.y1,.55,.55,0,0,Math.PI*2);c.fill();
  }
  draw(scene,state,options={}){const c=this.c,factor=this.canvas.width/W;c.setTransform(factor,0,0,factor,0,0);c.clearRect(0,0,W,H);this.cloth(options.fabric||'#f6efda');c.save();round(c,75,83,950,632,18);c.clip();c.translate(W/2,H/2);c.scale(options.zoom||1,options.zoom||1);c.translate(-W/2,-H/2);c.translate(OX,OY);
    if(!options.exportMode){for(const p of scene.paths){c.save();c.translate(p.layer.x,p.layer.y);c.rotate((p.layer.rotation||0)*Math.PI/180);c.scale(p.layer.scale,p.layer.scale);c.translate(-200,-200);c.lineWidth=options.edit?1.9:1.1;c.strokeStyle=options.edit?p.color+'a0':'#a18d6390';c.setLineDash(options.edit?[]:[1.5,3.3]);if(options.guides||options.edit)c.stroke(p.path);c.restore();}}
    for(const s of scene.samples){const m=state.marks.get(s.key);if(m)this.stitch(s,m);}
    if(!options.exportMode&&options.active){const s=options.active.sample,age=performance.now()-options.active.at;if(age<600||options.running){const lift=options.running?(Math.sin(performance.now()/55)+1)*5:6;c.save();c.strokeStyle='#88958e';c.lineWidth=1.6;c.beginPath();c.moveTo(s.x-6,s.y-3);c.lineTo(s.x-6,s.y+4);c.quadraticCurveTo(s.x,s.y+7,s.x+6,s.y+4);c.lineTo(s.x+6,s.y-3);c.stroke();c.fillStyle='#c9d0c4';round(c,s.x-4,s.y-35-lift,8,14,2);c.fill();c.strokeStyle='#a9b2a7';c.lineWidth=2;c.beginPath();c.moveTo(s.x,s.y-22-lift);c.lineTo(s.x,s.y+2-lift);c.stroke();c.strokeStyle=options.active.color;c.lineWidth=.8;c.beginPath();c.moveTo(s.x+14,s.y-48);c.quadraticCurveTo(s.x-4,s.y-37,s.x,s.y-lift);c.stroke();c.restore();}}
    if(options.edit&&options.selected){const b=scene.bounds.get(options.selected);if(b){c.strokeStyle='#ad8951';c.lineWidth=1.5;c.setLineDash([5,5]);c.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);c.setLineDash([]);c.fillStyle='#fffcf1';c.fillRect(b.maxX-4,b.maxY-4,8,8);c.strokeRect(b.maxX-4,b.maxY-4,8,8);}}c.restore();
  }
  image(scene,state,options,width=1500){this.draw(scene,state,{...options,zoom:1,exportMode:true});const output=document.createElement('canvas');output.width=width;output.height=Math.round(width*H/W)+75;const c=output.getContext('2d');c.fillStyle='#faf6e9';c.fillRect(0,0,output.width,output.height);c.drawImage(this.canvas,0,0,width,width*H/W);c.textAlign='center';c.fillStyle='#9c8865';c.font=`${width*.014}px sans-serif`;c.fillText('一针一线 · 把心意绣进日子里',width/2,output.height-36);return output.toDataURL('image/png');}
}
