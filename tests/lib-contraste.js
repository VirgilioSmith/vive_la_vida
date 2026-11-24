'use strict';
/* Contraste WCAG 2.2 AA medido sobre píxeles reales: el color del texto se lee del estilo calculado; el fondo se muestrea de una captura
   con todo el texto transparente (incluye vidrio translúcido, desenfoque y degradados). Texto grande (≥24px, o ≥18.66px en negrita): 3:1; resto: 4.5:1. */
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
async function medir(page,{root='body',max=400,frame=null}={}){
 const p=frame||page;let ox=0,oy=0;if(frame){const el=await frame.frameElement();const bb=await el.boundingBox();ox=bb.x;oy=bb.y}
 const items=await p.evaluate(({root,max})=>{
  const out=[],seen=new Set();const vh=innerHeight,vw=innerWidth;
  for(const e of document.querySelectorAll(root+' *')){
   const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);if(!own)continue;
   const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity<.05)continue;
   const rg=document.createRange();const rs=[];for(const n of e.childNodes)if(n.nodeType===3&&n.textContent.trim()){rg.selectNodeContents(n);rs.push(...rg.getClientRects())}if(!rs.length)continue;const L=Math.min(...rs.map(r=>r.left)),T=Math.min(...rs.map(r=>r.top)),R=Math.max(...rs.map(r=>r.right)),B=Math.max(...rs.map(r=>r.bottom));const b={left:L,top:T,right:R,bottom:B,width:R-L,height:B-T};if(b.width<4||b.height<4||b.bottom<0||b.top>vh||b.right<0||b.left>vw)continue;{const cx=Math.min(vw-1,Math.max(0,(b.left+b.right)/2)),cy=Math.min(vh-1,Math.max(0,(b.top+b.bottom)/2));const hit=document.elementFromPoint(cx,cy);if(!hit||!(e===hit||e.contains(hit)||hit.contains(e)&&false))continue}
   let op=1,q=e;while(q&&q!==document.body){op*=+getComputedStyle(q).opacity;q=q.parentElement}
   const m=s.color.match(/rgba?\(([^)]+)\)/);if(!m)continue;const [r,g,bb,a=1]=m[1].split(',').map(Number);
   out.push({sel:e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:''),text:e.textContent.trim().slice(0,28),
    x:Math.max(0,b.left),y:Math.max(0,b.top),w:Math.min(vw,b.right)-Math.max(0,b.left),h:Math.min(vh,b.bottom)-Math.max(0,b.top),fg:[r,g,bb],a:a*op,size:parseFloat(s.fontSize),weight:parseInt(s.fontWeight)||400});
   if(out.length>=max)break}
  return out},{root,max});
 await p.addStyleTag({content:'*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}svg text{fill:transparent!important}::placeholder{color:transparent!important}'}).then(h=>h);
 const tag=await p.$('style:last-of-type');
 const shot=(await page.screenshot()).toString('base64');
 await p.evaluate(()=>{const st=[...document.querySelectorAll('style')].pop();st.remove()});
 items.forEach(i=>{i.x+=ox;i.y+=oy});
 const bgs=await page.evaluate(async({shot,items})=>{
  const img=new Image();img.src='data:image/png;base64,'+shot;await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
  const k=img.width/innerWidth;
  return items.map(it=>{const px=[];const nx=4,ny=3;for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const X=Math.round((it.x+it.w*(i+.5)/nx)*k),Y=Math.round((it.y+it.h*(j+.5)/ny)*k);if(X<0||Y<0||X>=c.width||Y>=c.height)continue;const d=x.getImageData(X,Y,1,1).data;px.push([d[0],d[1],d[2]])}
   if(!px.length)return null;const ch=[0,1,2].map(n=>px.map(p=>p[n]).sort((a,b)=>a-b)[Math.floor(px.length/2)]);return ch})},{shot,items});
 const fallos=[];let n=0;
 items.forEach((it,i)=>{const bg=bgs[i];if(!bg)return;n++;
  const fg=it.fg.map((v,k)=>Math.round(v*it.a+bg[k]*(1-it.a)));
  const grande=it.size>=24||(it.size>=18.66&&it.weight>=700);const min=grande?3:4.5,r=ratio(fg,bg);
  if(r<min)fallos.push({sel:it.sel,text:it.text,ratio:+r.toFixed(2),min,size:it.size,fg:'rgb('+fg+')',bg:'rgb('+bg+')'})});
 return {medidos:n,fallos};
}
module.exports={medir,ratio};
