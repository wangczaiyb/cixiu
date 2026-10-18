import {BOARD} from './composition.js?v=20261018-art3';
import {roundedRectPath as round} from './browser-support.js?v=20261018-mobile1';
const {width:W,height:H,ox:OX,oy:OY}=BOARD;
export class Painter {
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');
    const tile=document.createElement('canvas');tile.width=tile.height=96;const t=tile.getContext('2d');
    // Alternating satin floats, fine crossing fibres and real needle holes.
    for(let y=0;y<96;y+=4){t.fillStyle=y%8?'#fffff048':'#fff9e95c';t.fillRect(0,y,96,2.5);t.fillStyle='#8e80521a';t.fillRect(0,y+2.6,96,.55);}
    for(let x=0;x<96;x+=4){t.fillStyle=x%8?'#fffdee32':'#a4936120';t.fillRect(x,0,1.7,96);}
    for(let y=4;y<96;y+=8)for(let x=4;x<96;x+=8){t.fillStyle='#6b644428';t.beginPath();t.ellipse(x,y,.85,.65,0,0,Math.PI*2);t.fill();t.fillStyle='#fffef0a0';t.fillRect(x-.6,y+1.1,1.5,.6);}
    this.texture=this.c.createPattern(tile,'repeat');
    const thread=document.createElement('canvas');thread.width=thread.height=8;const tc=thread.getContext('2d');
    tc.strokeStyle='#fffef684';tc.lineWidth=.7;tc.beginPath();tc.moveTo(0,1);tc.lineTo(8,2.5);tc.moveTo(0,5);tc.lineTo(8,6.5);tc.stroke();
    tc.strokeStyle='#45302327';tc.lineWidth=.65;tc.beginPath();tc.moveTo(0,3);tc.lineTo(8,4.5);tc.moveTo(0,7);tc.lineTo(8,8.5);tc.stroke();
    this.threadTexture=this.c.createPattern(thread,'repeat');
    this.stitchCanvas=document.createElement('canvas');this.stitchCanvas.width=canvas.width;this.stitchCanvas.height=canvas.height;
    this.stitchContext=this.stitchCanvas.getContext('2d');this.cachedScene=null;this.cachedKeys=new Set();
  }
  cloth(fabric){
    const c=this.c, bx=44, by=28, bw=1012, bh=744;
    c.save();
    // Warm blush-pink background matching reference photo
    c.fillStyle='#edd5d8';
    c.fillRect(0,0,W,H);
    // Shadow under linen cloth
    c.save();
    c.shadowColor='#4a2f2622';
    c.shadowBlur=18;
    c.shadowOffsetY=7;
    c.fillStyle=fabric||'#fcfaf5';
    round(c,bx,by,bw,bh,4);
    c.fill();
    c.shadowColor='transparent';
    // Raw frayed fringe threads (毛须边) around the cloth perimeter
    c.lineCap='round';
    for(let x=bx+2;x<bx+bw-2;x+=3.2){
      const h1=2.5+(Math.sin(x*12.3)+1)*2.2;
      c.strokeStyle=(x%6<3)?'#e2dacf':'#c9bdab';c.lineWidth=0.65;
      c.beginPath();c.moveTo(x,by);c.lineTo(x+Math.sin(x*5)*1.5,by-h1);c.stroke();
      const h2=2.5+(Math.cos(x*11.7)+1)*2.2;
      c.beginPath();c.moveTo(x,by+bh);c.lineTo(x+Math.sin(x*7)*1.5,by+bh+h2);c.stroke();
    }
    for(let y=by+2;y<by+bh-2;y+=3.2){
      const w1=2.5+(Math.sin(y*13.1)+1)*2.2;
      c.strokeStyle=(y%6<3)?'#e2dacf':'#c9bdab';c.lineWidth=0.65;
      c.beginPath();c.moveTo(bx,y);c.lineTo(bx-w1,y+Math.cos(y*6)*1.5);c.stroke();
      const w2=2.5+(Math.cos(y*12.5)+1)*2.2;
      c.beginPath();c.moveTo(bx+bw,y);c.lineTo(bx+bw+w2,y+Math.cos(y*8)*1.5);c.stroke();
    }
    // Cloth woven texture & satin sheen
    c.save();round(c,bx,by,bw,bh,4);c.clip();
    c.fillStyle=this.texture;c.fillRect(bx,by,bw,bh);
    const sheen=c.createLinearGradient(bx,by,bx+bw,by+bh);
    sheen.addColorStop(0,'#ffffff42');sheen.addColorStop(.5,'#ffffff08');sheen.addColorStop(1,'#a6906212');
    c.fillStyle=sheen;c.fillRect(bx,by,bw,bh);c.restore();

    // Blue scalloped embroidered border with French knots (蓝线波浪拱形绣边 + 点点法式结点绣)
    const x1=bx+36, y1=by+36, x2=bx+bw-36, y2=by+bh-36;
    c.save();
    c.strokeStyle='#3a67b3';c.fillStyle='#3a67b3';c.lineWidth=1.7;c.lineCap='round';c.lineJoin='round';
    // Top border scallops
    const xSpan=x2-x1, nTop=Math.round(xSpan/28), stepX=xSpan/nTop;
    for(let i=0;i<nTop;i++){
      const sx=x1+i*stepX, ex=sx+stepX, mx=(sx+ex)/2;
      c.beginPath();c.moveTo(sx,y1);c.quadraticCurveTo(mx,y1-6,ex,y1);c.stroke();
      c.beginPath();c.arc(mx,y1+7,2.3,0,Math.PI*2);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.arc(mx-.7,y1+6.3,.75,0,Math.PI*2);c.fill();
      c.fillStyle='#3a67b3';
    }
    // Right border scallops
    const ySpan=y2-y1, nRight=Math.round(ySpan/28), stepY=ySpan/nRight;
    for(let i=0;i<nRight;i++){
      const sy=y1+i*stepY, ey=sy+stepY, my=(sy+ey)/2;
      c.beginPath();c.moveTo(x2,sy);c.quadraticCurveTo(x2+6,my,x2,ey);c.stroke();
      c.beginPath();c.arc(x2-7,my,2.3,0,Math.PI*2);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.arc(x2-7.7,my-.7,.75,0,Math.PI*2);c.fill();
      c.fillStyle='#3a67b3';
    }
    // Bottom border scallops
    for(let i=0;i<nTop;i++){
      const sx=x1+i*stepX, ex=sx+stepX, mx=(sx+ex)/2;
      c.beginPath();c.moveTo(sx,y2);c.quadraticCurveTo(mx,y2+6,ex,y2);c.stroke();
      c.beginPath();c.arc(mx,y2-7,2.3,0,Math.PI*2);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.arc(mx-.7,y2-7.7,.75,0,Math.PI*2);c.fill();
      c.fillStyle='#3a67b3';
    }
    // Left border scallops
    for(let i=0;i<nRight;i++){
      const sy=y1+i*stepY, ey=sy+stepY, my=(sy+ey)/2;
      c.beginPath();c.moveTo(x1,sy);c.quadraticCurveTo(x1-6,my,x1,ey);c.stroke();
      c.beginPath();c.arc(x1+7,my,2.3,0,Math.PI*2);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.arc(x1+6.3,my-.7,.75,0,Math.PI*2);c.fill();
      c.fillStyle='#3a67b3';
    }
    // Top center embroidered ribbon bow and leafy garland (蝴蝶结与花蔓)
    const cx=(x1+x2)/2, cy=y1+38;
    c.lineWidth=1.9;
    c.beginPath();
    // Bow knot
    c.arc(cx,cy,5.5,0,Math.PI*2);
    // Left loop
    c.moveTo(cx-4,cy-2);c.bezierCurveTo(cx-24,cy-24,cx-38,cy-10,cx-28,cy+4);c.bezierCurveTo(cx-18,cy+12,cx-6,cy+4,cx-4,cy);
    // Right loop
    c.moveTo(cx+4,cy-2);c.bezierCurveTo(cx+24,cy-24,cx+38,cy-10,cx+28,cy+4);c.bezierCurveTo(cx+18,cy+12,cx+6,cy+4,cx+4,cy);
    // Hanging tails
    c.moveTo(cx-2,cy+5);c.quadraticCurveTo(cx-14,cy+18,cx-20,cy+28);
    c.moveTo(cx+2,cy+5);c.quadraticCurveTo(cx+14,cy+18,cx+20,cy+28);
    c.stroke();

    // Branching leafy vines: Left & Right
    const drawVine=(dir)=>{
      c.beginPath();
      c.moveTo(cx+dir*38,cy-4);
      c.bezierCurveTo(cx+dir*90,cy-18,cx+dir*180,cy+12,cx+dir*260,cy-2);
      c.bezierCurveTo(cx+dir*300,cy-8,cx+dir*330,cy+10,cx+dir*350,cy+6);
      c.stroke();
      const leafPos=[70,120,165,215,260,310];
      for(const offset of leafPos){
        const lx=cx+dir*offset;
        const ly=cy+Math.sin(offset*.03)*8-4;
        c.beginPath();c.ellipse(lx,ly-7,4.5,2.4,dir*.5,0,Math.PI*2);c.stroke();
        c.beginPath();c.arc(lx+dir*14,ly+6,2.2,0,Math.PI*2);c.fill();
      }
    };
    drawVine(-1);drawVine(1);

    // Subtle bottom flourish
    const bcy=y2-28;
    c.beginPath();c.moveTo(cx-60,bcy);c.quadraticCurveTo(cx-20,bcy-10,cx,bcy);c.quadraticCurveTo(cx+20,bcy-10,cx+60,bcy);c.stroke();
    c.restore();

    c.restore();
  }
  stitch(s,m){
    const c=this.c,dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    if(m.style==='running'&&s.n%3===2)return;
    const isFine=Boolean(s.fineThread||(s.strokeWidth&&s.strokeWidth<2.4));
    const hand=s.handmade,texture=s.texture||'cotton',wave=hand?Math.sin(s.n*1.73+s.path)*(isFine?.2:.4):0;
    const width=(isFine?(s.strokeWidth||1.85):(s.satin?4.1:hand?(texture==='wool'?5.1:3.7):3.2))*Math.max(.35,Math.min(1.7,s.scale||1));
    const shape=(offset)=>{
      c.beginPath();
      if(m.style==='cross'){
        const k=Math.max(1.5,2.8*(s.scale||1));
        c.moveTo(s.x-k,s.y-k+offset);c.lineTo(s.x+k,s.y+k+offset);
        c.moveTo(s.x+k,s.y-k+offset);c.lineTo(s.x-k,s.y+k+offset);
      } else if(isFine){
        c.moveTo(s.x1,s.y1+offset);
        c.lineTo(s.x2,s.y2+offset);
      } else {
        c.moveTo(s.x1-dx*.09,s.y1-dy*.09+offset);
        c.quadraticCurveTo(s.x+nx*(.6+wave),s.y+ny*(.6+wave)+offset,s.x2+dx*.1,s.y2+dy*.1+offset);
      }
    };
    c.lineCap=c.lineJoin='round';
    shape(isFine?.65:1.1);c.strokeStyle=isFine?'#4e3b2520':'#5441242f';c.lineWidth=width+(isFine?.7:1.4);c.stroke();
    shape(0);c.strokeStyle=m.color;c.lineWidth=width;c.stroke();
    shape(isFine?-.3:-.65);c.strokeStyle=isFine?'#ffffff60':'#fff5de80';c.lineWidth=Math.max(.4,width*(isFine?.26:.22));c.stroke();
    if(!isFine){
      c.strokeStyle='#fff6de55';c.lineWidth=.5;c.beginPath();c.moveTo(s.x-nx*width*.35-dx*.25,s.y-ny*width*.35-dy*.25);c.lineTo(s.x+nx*width*.35+dx*.25,s.y+ny*width*.35+dy*.25);c.stroke();
      if(hand&&texture==='wool'&&s.n%2===0){c.strokeStyle=m.color+'66';c.lineWidth=.45;c.beginPath();c.moveTo(s.x+nx*width*.45,s.y+ny*width*.45);c.lineTo(s.x+nx*(width*.7),s.y+ny*(width*.7)-.9);c.stroke();}
    }
    c.fillStyle='#4a382124';c.beginPath();c.ellipse(s.x1,s.y1,isFine?.5:.55,isFine?.5:.55,0,0,Math.PI*2);c.fill();
    if(isFine){c.beginPath();c.ellipse(s.x2,s.y2,.5,.5,0,0,Math.PI*2);c.fill();}
  }
  stitchedLayer(scene,state){
    const c=this.stitchContext,factor=this.stitchCanvas.width/W;
    if(this.cachedScene!==scene||state.marks.size<this.cachedKeys.size){
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.stitchCanvas.width,this.stitchCanvas.height);this.cachedKeys.clear();this.cachedScene=scene;
    }
    c.setTransform(factor,0,0,factor,OX*factor,OY*factor);
    const main=this.c;this.c=c;
    try{for(const s of scene.samples){if(this.cachedKeys.has(s.key))continue;const mark=state.marks.get(s.key);if(mark){this.stitch(s,mark);this.cachedKeys.add(s.key);}}}finally{this.c=main;}
    return this.stitchCanvas;
  }
  draw(scene,state,options={}){
    const c=this.c,factor=this.canvas.width/W;c.setTransform(factor,0,0,factor,0,0);c.clearRect(0,0,W,H);
    this.cloth(options.fabric||'#fcfaf5');
    c.save();round(c,43,31,1014,738,11);c.clip();
    c.translate(W/2,H/2);c.scale(options.zoom||1,options.zoom||1);c.translate(-W/2,-H/2);c.translate(OX,OY);
    if(!options.exportMode){for(const p of scene.paths){c.save();c.translate(p.layer.x,p.layer.y);c.rotate((p.layer.rotation||0)*Math.PI/180);c.scale(p.layer.scale,p.layer.scale);c.translate(-200,-200);
      if(p.image){if(options.edit||options.guides){c.globalAlpha=options.edit?1:.12;c.shadowColor='#47302338';c.shadowBlur=2;c.shadowOffsetY=1.2;c.drawImage(p.image,0,0);}c.restore();continue;}
      if(options.edit&&p.fill){c.shadowColor='#49342030';c.shadowBlur=1.2;c.shadowOffsetY=1;c.fillStyle=p.fill;c.fill(p.path);c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;c.fillStyle=this.threadTexture;c.fill(p.path);}
      c.lineWidth=options.edit?(p.strokeWidth||2.8):(p.fineThread?1.4:1.1);c.strokeStyle=options.edit?p.color:(p.fineThread?p.color+'50':'#a18d6390');c.setLineDash(options.edit?[]:[1.5,3.3]);if(options.guides||options.edit)c.stroke(p.path);c.restore();}}
    c.drawImage(this.stitchedLayer(scene,state),-OX,-OY,W,H);
    if(!options.exportMode&&options.selected&&options.selected!=='typewriter-layer'&&scene.bounds.has(options.selected)){
      const b=scene.bounds.get(options.selected);
      c.save();c.strokeStyle='#bfa56c99';c.lineWidth=1.2;c.setLineDash([4,3]);round(c,b.minX-5,b.minY-5,b.maxX-b.minX+10,b.maxY-b.minY+10,6);c.stroke();c.restore();
    }
    if(!options.exportMode&&options.active){
      const s=options.active.sample,age=performance.now()-options.active.at;
      if(age<600||options.running){
        const lift=options.running?(Math.sin(performance.now()/55)+1)*4:4;
        c.save();
        const nx=s.x,ny=s.y-lift;
        c.strokeStyle=options.active.color||'#3b8f52';c.lineWidth=1.6;c.lineCap='round';
        c.beginPath();c.moveTo(nx+16,ny-60);c.quadraticCurveTo(nx+26,ny-38,nx+6,ny-22);c.lineTo(s.x,s.y);c.stroke();
        c.save();c.translate(nx,ny);c.rotate(.38);
        c.strokeStyle='#4e3b2522';c.lineWidth=2.2;c.beginPath();c.moveTo(2,-48);c.lineTo(2,0);c.stroke();
        const needleGrad=c.createLinearGradient(-2,-52,3,0);needleGrad.addColorStop(0,'#e4e8ec');needleGrad.addColorStop(.5,'#ffffff');needleGrad.addColorStop(1,'#a2acb4');
        c.strokeStyle=needleGrad;c.lineWidth=2.1;c.beginPath();c.moveTo(0,-52);c.lineTo(0,0);c.stroke();
        c.strokeStyle='#60666d';c.lineWidth=.75;c.beginPath();c.ellipse(0,-45,.7,2.8,0,0,Math.PI*2);c.stroke();
        c.fillStyle='#858d94';c.beginPath();c.moveTo(-1,0);c.lineTo(1,0);c.lineTo(0,3);c.closePath();c.fill();
        c.restore();c.restore();
      }
    }
    c.restore();
  }
  image(scene,state,options,width=1500){this.draw(scene,state,{...options,zoom:1,exportMode:true});const output=document.createElement('canvas');output.width=width;output.height=Math.round(width*H/W)+75;const c=output.getContext('2d');c.fillStyle='#faf6e9';c.fillRect(0,0,output.width,output.height);c.drawImage(this.canvas,0,0,width,width*H/W);c.textAlign='center';c.fillStyle='#9c8865';c.font=`${width*.014}px sans-serif`;c.fillText('一针一线 · 把心意绣进日子里',width/2,output.height-36);return output.toDataURL('image/png');}
}
