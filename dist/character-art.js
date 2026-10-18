// Original character images stay unchanged. This working surface is sampled
// into real thread runs at runtime, preserving the original face and outline.
export function trimArtworkPixels(data, width, height) {
  const index = (x,y)=>(y*width+x)*4;
  const corners=[index(0,0),index(width-1,0),index(0,height-1),index(width-1,height-1)];
  const background=[0,1,2].map(channel=>Math.round(corners.reduce((sum,i)=>sum+data[i+channel],0)/4));
  if(corners.every(i=>data[i+3]>245&&background.every((v,ch)=>v>180&&Math.abs(data[i+ch]-v)<9))){
    const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
    const visit=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return;const n=y*width+x,i=n*4;
      if(visited[n]||data[i+3]<10||background.some((v,ch)=>Math.abs(data[i+ch]-v)>22))return;
      visited[n]=1;queue[tail++]=n;};
    for(let x=0;x<width;x++){visit(x,0);visit(x,height-1);}for(let y=0;y<height;y++){visit(0,y);visit(width-1,y);}
    while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);data[n*4+3]=0;visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
  }
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[index(x,y)+3]>30){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
}

export async function loadCharacterArtwork(url,crop) {
  const image=new Image();image.src=url;await image.decode();
  const [sx,sy,sw,sh]=crop||[0,0,image.naturalWidth,image.naturalHeight];
  const ratio=Math.min(1,1200/Math.max(sw,sh));
  const raw=document.createElement('canvas');raw.width=Math.round(sw*ratio);raw.height=Math.round(sh*ratio);
  const rc=raw.getContext('2d',{willReadFrequently:true});rc.drawImage(image,sx,sy,sw,sh,0,0,raw.width,raw.height);
  const pixels=rc.getImageData(0,0,raw.width,raw.height),bounds=trimArtworkPixels(pixels.data,raw.width,raw.height);
  if(!bounds)throw new Error('角色素材没有可绣制内容');rc.putImageData(pixels,0,0);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=400;
  const c=canvas.getContext('2d',{willReadFrequently:true}),scale=Math.min(310/bounds.width,280/bounds.height);
  const w=bounds.width*scale,h=bounds.height*scale;
  c.drawImage(raw,bounds.x,bounds.y,bounds.width,bounds.height,200-w/2,195-h/2,w,h);
  const sampled=c.getImageData(0,0,400,400).data;
  for(let i=0;i<sampled.length;i+=4)for(let channel=0;channel<3;channel++)sampled[i+channel]=Math.min(255,Math.round(sampled[i+channel]/17)*17);
  const preview=document.createElement('canvas');preview.width=preview.height=400;const pc=preview.getContext('2d');pc.drawImage(canvas,0,0);
  const tile=document.createElement('canvas');tile.width=tile.height=8;const t=tile.getContext('2d');
  t.strokeStyle='#fffef67d';t.lineWidth=.65;t.beginPath();t.moveTo(0,1);t.lineTo(8,2);t.moveTo(0,5);t.lineTo(8,6);t.stroke();
  t.strokeStyle='#3628192d';t.lineWidth=.65;t.beginPath();t.moveTo(0,3.5);t.lineTo(8,4.5);t.moveTo(0,7.5);t.lineTo(8,8.5);t.stroke();
  pc.globalCompositeOperation='source-atop';pc.fillStyle=pc.createPattern(tile,'repeat');pc.fillRect(0,0,400,400);pc.globalCompositeOperation='source-over';
  return {preview,pixels:sampled,thumbnail:preview.toDataURL('image/png')};
}
