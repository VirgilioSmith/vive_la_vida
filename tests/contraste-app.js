'use strict';
/* Contraste WCAG 2.2 AA real de la aplicación: todas las rutas, PC y móvil, Claro/Black y acentos. Informe: docs/auditoria/fase02/contraste-app.json */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const open=require('./harness');const {medir}=require('./lib-contraste');
const PAGES=['overview','register','flow','income','expenses','wallet','banks','accounts','cards','loans','certificates','mobilehub','budget','categories','recurring','personal','patrimony','advanced','settings','mobilesearch'];
(async()=>{
 const b=await chromium.launch(),res={};
 const combos=(process.env.COMBOS?JSON.parse(process.env.COMBOS):[[1440,900,'light',null],[1440,900,'black',null],[1440,900,'light','#e5484d'],[390,844,'light',null],[390,844,'black',null],[390,844,'light','#16a34a']]);
 for(const [w,h,theme,acc] of combos){
  process.env.THEME=theme;if(w<800)process.env.TOUCH='1';else delete process.env.TOUCH;
  const {ctx,p}=await open(b,w,h);
  if(acc)await p.evaluate(x=>{const t=window.__T,d=t.dbg();d.settings.paletteChoice='custom';d.settings.paletteHex=x;t.inv()},acc);
  const key=`${w<800?'movil':'pc'}-${theme}${acc?'-'+acc.slice(1):''}`;res[key]={};
  for(const pg of PAGES){try{await p.evaluate(id=>window.__T.go(id),pg);await p.waitForTimeout(450);
   const r=await medir(p,{root:'body',max:500});res[key][pg]={medidos:r.medidos,fallos:r.fallos.length,ej:r.fallos.slice(0,6),todos:r.fallos.map(f=>[f.sel,f.text,f.ratio,f.fg,f.bg,f.size])}}catch(e){res[key][pg]={error:String(e.message).slice(0,100)}}}
  await ctx.close();console.log('listo',key);
 }
 await b.close();fs.writeFileSync(path.join(__dirname,'..','docs','auditoria','fase02',process.env.OUT||'contraste-app.json'),JSON.stringify(res,null,1));
})().catch(e=>{console.error(e);process.exit(1)});
