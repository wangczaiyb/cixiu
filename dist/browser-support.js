export function roundedRectPath(c,x,y,w,h,r){
  c.beginPath();
  if(typeof c.roundRect==='function'){c.roundRect(x,y,w,h,r);return;}
  const radius=Math.max(0,Math.min(r,w/2,h/2));
  c.moveTo(x+radius,y);c.lineTo(x+w-radius,y);c.quadraticCurveTo(x+w,y,x+w,y+radius);
  c.lineTo(x+w,y+h-radius);c.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  c.lineTo(x+radius,y+h);c.quadraticCurveTo(x,y+h,x,y+h-radius);
  c.lineTo(x,y+radius);c.quadraticCurveTo(x,y,x+radius,y);c.closePath();
}

export function installDialogFallback(dialogs){
  for(const dialog of dialogs)if(typeof dialog.showModal!=='function'){
    dialog.classList.add('fallback-dialog');
    dialog.showModal=()=>dialog.setAttribute('open','');
    dialog.close=()=>dialog.removeAttribute('open');
  }
}

export async function decodeImage(image,url){
  if(image.complete&&image.naturalWidth>0&&image.src===url)return image;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{image.onload=image.onerror=null;reject(new Error('图案加载超时，请点图案重试'));},15000);
    image.onload=()=>{clearTimeout(timer);image.onload=image.onerror=null;resolve();};
    image.onerror=()=>{clearTimeout(timer);image.onload=image.onerror=null;reject(new Error('图案暂时没有加载成功'));};
    image.src=url;
    if(image.complete&&image.naturalWidth>0){clearTimeout(timer);image.onload=image.onerror=null;resolve();}
  });
  return image;
}
