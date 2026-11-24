'use strict';
/* Huella visual: para cada ruta (PC/móvil, Claro/Black) calcula un hash de geometría + estilos visibles clave. Sirve para demostrar que una
   limpieza de código/CSS no cambia lo que se ve. Uso: node tests/huella-visual.js <salida.json> */
const fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('playwright');const open=require('./harness');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','settings','mobilesearch','score'];
const F=()=>{const out=[];for(const e of document.querySelectorAll('#app *')){const b=e.getBoundingClientRect();if(b.width<1||b.height<1)continue;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')continue;
 out.push([e.tagName,String(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className).slice(0,60),Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height),s.color,s.backgroundColor,s.fontSize,s.fontWeight,s.borderTopWidth,s.borderRadius,s.boxShadow!=='none'?1:0,s.backdropFilter!=='none'?1:0].join('|'))}
 return out};
(async()=>{
 const b=await chromium.launch(),res={};
 for(const [w,h] of [[1440,900],[390,844]])for(const theme of ['light','black']){
  process.env.THEME=theme;if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);const key=`${w}-${theme}`;res[key]={};
  for(const pg of PAGES){try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(pg==='score'?2500:500);const arr=await p.evaluate(F);
   res[key][pg]={n:arr.length,h:crypto.createHash('md5').update(arr.join('\n')).digest('hex'),arr:arr.length<1500?arr:undefined}}catch(e){res[key][pg]={error:1}}}
  await ctx.close()}
 await b.close();fs.writeFileSync(process.argv[2]||'/tmp/huella.json',JSON.stringify(res));console.log('huella ok');
})().catch(e=>{console.error(e);process.exit(1)});
