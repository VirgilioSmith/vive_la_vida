'use strict';
/* FASE 01 · Auditoría UX/UI: capturas reales + heurísticas medibles por pantalla (PC y móvil; Claro/Black; acentos). No modifica datos. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');
const OUT=path.join(__dirname,'..','docs','auditoria','fase01');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','score','settings','mobilesearch'];
const PROBE=()=>{
 const vw=innerWidth,vh=innerHeight,r={};
 const vis=e=>{const b=e.getBoundingClientRect();if(b.width<2||b.height<2)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05};
 const sel=e=>{let s=e.tagName.toLowerCase();if(e.id)s+='#'+e.id;const c=[...e.classList].slice(0,2).join('.');if(c)s+='.'+c;return s};
 const all=[...document.querySelectorAll('#page *,.dock *,nav *')].filter(vis);
 r.scrollOverflowX=document.documentElement.scrollWidth-vw;
 r.h1=[...document.querySelectorAll('#page h1')].filter(vis).map(h=>h.textContent.trim().slice(0,40));
 const hs=[...document.querySelectorAll('#page h1,#page h2')].filter(vis).map(h=>h.textContent.trim().toLowerCase());r.dupHeadings=hs.filter((t,i)=>t&&hs.indexOf(t)!==i).slice(0,6);
 const tiny=new Map(),clip=[],white=[],thick=[];let textNodes=0;
 const light=!/dark|black/.test(document.body.className);
 for(const e of all){
  const s=getComputedStyle(e),b=e.getBoundingClientRect();
  const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  if(own){textNodes++;const fs=parseFloat(s.fontSize);if(fs<11){const k=sel(e)+' '+fs+'px';tiny.set(k,(tiny.get(k)||0)+1)}
   if((e.scrollWidth>e.clientWidth+1)&&/hidden|clip/.test(s.overflowX)&&!/ellipsis/.test(s.textOverflow)&&e.clientWidth>0)clip.push(sel(e)+' «'+e.textContent.trim().slice(0,24)+'»');
   if(b.right>vw+1||b.left<-1)clip.push('FUERA '+sel(e)+' «'+e.textContent.trim().slice(0,20)+'»')}
  const m=s.backgroundColor.match(/rgba?\(([^)]+)\)/);
  if(m&&b.width*b.height>15000){const [R,G,B,A=1]=m[1].split(',').map(Number);
   if(A>=.97){ if(light&&R>=250&&G>=250&&B>=250)white.push(sel(e)+' '+Math.round(b.width)+'x'+Math.round(b.height)); if(!light&&(R+G+B)/3>200)white.push('CLARO-EN-BLACK '+sel(e)+' '+Math.round(b.width)+'x'+Math.round(b.height))}}
  const bw=parseFloat(s.borderTopWidth);if(bw>=2&&s.borderTopStyle!=='none'&&b.width*b.height>4000)thick.push(sel(e)+' '+bw+'px');
 }
 r.tiny=[...tiny.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);r.tinyTotal=[...tiny.values()].reduce((a,b)=>a+b,0);r.textNodes=textNodes;
 r.clipped=[...new Set(clip)].slice(0,8);r.opaque=[...new Set(white)].slice(0,8);r.opaqueTotal=white.length;r.thick=[...new Set(thick)].slice(0,6);
 const icons=[...document.querySelectorAll('#page svg')].filter(vis).filter(v=>v.getBoundingClientRect().width<=40);
 r.iconSizes=Object.fromEntries(Object.entries(icons.reduce((a,v)=>{const k=Math.round(v.getBoundingClientRect().width);a[k]=(a[k]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,6));
 r.iconStrokes=[...new Set(icons.map(v=>getComputedStyle(v).strokeWidth).filter(x=>x&&x!=='0px'))].slice(0,8);
 const wts=new Map();for(const e of all){if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const w=getComputedStyle(e).fontWeight;wts.set(w,(wts.get(w)||0)+1)}}r.weights=Object.fromEntries([...wts.entries()].sort());
 const dock=document.querySelector('.mobile-dock,.v-dock,nav.dock,[class*="dock"]:not(svg)');
 if(vw<=790){const nav=[...document.querySelectorAll('nav,div')].filter(vis).find(e=>{const s=getComputedStyle(e);return s.position==='fixed'&&e.getBoundingClientRect().bottom>vh-8&&e.getBoundingClientRect().height>40&&e.getBoundingClientRect().width>vw*.7});
  if(nav){const top=nav.getBoundingClientRect().top;const sc=document.scrollingElement;const maxScroll=sc.scrollHeight-vh;const lastBottom=Math.max(...[...document.querySelectorAll('#page *')].filter(vis).map(e=>e.getBoundingClientRect().bottom+sc.scrollTop));r.dockTop=Math.round(top);r.contentBottomAtEnd=Math.round(lastBottom-maxScroll);r.dockOverlap=Math.round(lastBottom-maxScroll-top)}}
 const cs=getComputedStyle(document.body);r.accentVar=getComputedStyle(document.documentElement).getPropertyValue('--lg-accent').trim()||getComputedStyle(document.body).getPropertyValue('--lg-accent').trim()||getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim();
 const pb=[...document.querySelectorAll('#page .btn.primary,#page button.primary,#page .btn:not(.ghost):not(.soft)')].filter(vis)[0];r.primaryBtnBg=pb?getComputedStyle(pb).backgroundColor:null;
 r.theme=document.body.className;
 return r;
};
async function pass(browser,{w,h,theme,pal,pages,dir}){
 process.env.THEME=theme;if(pal)process.env.PALHEX=pal;else delete process.env.PALHEX;if(w<=790)process.env.TOUCH='1';else delete process.env.TOUCH;
 const {ctx,p}=await open(browser,w,h);const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 const res={};
 if(pal)await p.evaluate(h=>{const t=window.__T,d=t.dbg();d.settings.paletteChoice='custom';d.settings.paletteHex='#'+h;t.inv()},pal);
 for(const pg of pages){
  try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(pg==='score'?2500:450);
   const exists=await p.evaluate(()=>!!document.querySelector('#page')&&document.querySelector('#page').innerText.trim().length>20);
   if(!exists){res[pg]={vacia:true};continue}
   const tag=`${pg}-${theme}${pal?'-'+pal:''}`;
   await p.screenshot({path:path.join(OUT,dir,tag+'.png'),fullPage:false});
   const data=await p.evaluate(PROBE);
   if(w<=790){const sh=await p.evaluate(()=>document.scrollingElement.scrollHeight);if(sh>900){await p.screenshot({path:path.join(OUT,dir,tag+'-full.png'),fullPage:true})}}
   res[pg]=data;
  }catch(e){res[pg]={error:String(e.message).slice(0,160)}}
 }
 res.__errors=[...new Set(errs)].slice(0,6);await ctx.close();return res;
}
(async()=>{
 const b=await chromium.launch(),all={};
 if(!process.env.ONLY_ACC){all.pc_light=await pass(b,{w:1440,h:900,theme:'light',pages:PAGES,dir:'pc'});
 all.pc_black=await pass(b,{w:1440,h:900,theme:'black',pages:PAGES,dir:'pc'});
 all.mob_light=await pass(b,{w:390,h:844,theme:'light',pages:PAGES,dir:'movil'});
 all.mob_black=await pass(b,{w:390,h:844,theme:'black',pages:PAGES,dir:'movil'});}
 const subset=['overview','banks','expenses','wallet','income','settings'];
 all.pc_acc=await pass(b,{w:1440,h:900,theme:'light',pal:'e5484d',pages:subset,dir:'pc'});
 all.mob_acc=await pass(b,{w:390,h:844,theme:'light',pal:'16a34a',pages:['overview','banks','mobilehub','income','settings'],dir:'movil'});
 const f=path.join(OUT,process.env.ONLY_ACC?'datos-acentos.json':'datos.json');fs.writeFileSync(f,JSON.stringify(all,null,1));
 await b.close();console.log('fase01: datos y capturas guardados');
})().catch(e=>{console.error(e);process.exit(1)});
