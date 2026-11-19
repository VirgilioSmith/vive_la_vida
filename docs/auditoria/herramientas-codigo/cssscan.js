const fs=require('fs');
const css=fs.readFileSync('/home/user/vive_la_vida/src/styles.css','utf8');
const js=fs.readFileSync('/home/user/vive_la_vida/src/app.js','utf8')+fs.readFileSync('/home/user/vive_la_vida/index.html','utf8')+['early.js','vive-score/host.js','vive-score/score.js','vive-score/state.js','vive-score/questionnaire.js','vive-score/settings.js','vive-score/seed.js','vive-score/transunion.js','vive-score/adapter.js'].map(f=>fs.readFileSync('/home/user/vive_la_vida/src/'+f,'utf8')).join('\n')+fs.readFileSync('/home/user/vive_la_vida/src/vive-score/frame.html','utf8');
const tokens=new Set(js.split(/[^A-Za-z0-9_-]+/));
// parse
let i=0,n=css.length;const rules=[];
function parse(ctx,depth){
 while(i<n){
  // skip whitespace/comments
  while(i<n&&/\s/.test(css[i]))i++;
  if(css.startsWith('/*',i)){const e=css.indexOf('*/',i+2);i=e<0?n:e+2;continue}
  if(css[i]==='}'){i++;return}
  const start=i;let j=i;let depthp=0;
  while(j<n&&css[j]!=='{'&&css[j]!==';'){if(css[j]==='(')depthp++;if(css[j]===')')depthp--;j++}
  if(css[j]===';'){i=j+1;continue}
  const head=css.slice(i,j).trim();i=j+1;
  if(head.startsWith('@')){
   if(/^@(media|supports|layer|container)/.test(head)){parse(ctx+'|'+head,depth+1)}
   else{ // keyframes / font-face: skip balanced
    let d=1;while(i<n&&d>0){if(css[i]==='{')d++;else if(css[i]==='}')d--;i++}}
  }else{
   const bs=i;let d=1;while(i<n&&d>0){if(css[i]==='{')d++;else if(css[i]==='}')d--;i++}
   const body=css.slice(bs,i-1);
   const startLine=css.slice(0,start).split('\n').length;
   rules.push({ctx,sel:head,body:body.trim(),start,end:i,startLine,lines:css.slice(start,i).split('\n').length});
  }
 }
}
parse('',0);
console.log('reglas',rules.length);
// duplicates
const seen=new Map();let dup=0,dupLines=0;const dups=[];
for(const r of rules){const k=r.ctx+'¦'+r.sel.replace(/\s+/g,' ')+'¦'+r.body.replace(/\s+/g,' ');if(seen.has(k)){dup++;dupLines+=r.lines;dups.push(r)}else seen.set(k,r)}
console.log('reglas idénticas repetidas (mismo selector, contexto y cuerpo):',dup,'líneas',dupLines);
// same body different selectors? skip
// dead selectors
let dead=0,deadLines=0,deadBytes=0;const deadList=[];
for(const r of rules){
 const sels=r.sel.split(/,(?![^(]*\))/).map(s=>s.trim());
 const allDead=sels.every(s=>{const cl=[...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map(m=>m[1]);if(!cl.length)return false;return cl.some(c=>!tokens.has(c))});
 if(allDead){dead++;deadLines+=r.lines;deadBytes+=r.end-r.start;deadList.push(r)}
}
console.log('reglas con clases/ids que no existen en ningún JS/HTML:',dead,'líneas',deadLines,'bytes',deadBytes);
let imp=(css.match(/!important/g)||[]).length;console.log('!important',imp);
const total=css.split('\n').length;console.log('líneas totales',total,'bytes',css.length);
fs.writeFileSync('/tmp/lint/css-dead.json',JSON.stringify(deadList.slice(0,2000).map(r=>({l:r.startLine,sel:r.sel.slice(0,120),lines:r.lines,ctx:r.ctx}))));
fs.writeFileSync('/tmp/lint/css-dups.json',JSON.stringify(dups.map(r=>({l:r.startLine,sel:r.sel.slice(0,120),lines:r.lines}))));
// by version prefix
const ver={};for(const r of rules){const m=r.sel.match(/\.(v\d+)[-_ .{:,>\[]/);const k=m?m[1]:'(sin versión)';ver[k]=(ver[k]||0)+1}
console.log('prefijos vNNN distintos en selectores:',Object.keys(ver).length);
// refinado: ¿posible nombre dinámico?
let dyn=0,strict=0,strictLines=0,strictBytes=0;const strictList=[];
for(const r of deadList){
 const sels=r.sel.split(/,(?![^(]*\))/).map(s=>s.trim());
 const reallyDead=sels.every(s=>{const cl=[...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map(m=>m[1]);if(!cl.length)return false;return cl.some(c=>{if(tokens.has(c))return false;const k=c.lastIndexOf('-');const pre=k>0?c.slice(0,k+1):null;return !(pre&&js.includes(pre))})});
 if(reallyDead){strict++;strictLines+=r.lines;strictBytes+=r.end-r.start;strictList.push(r)}else dyn++;
}
console.log('de ellas, probablemente dinámicas (se conserva el prefijo en el JS):',dyn,'| muertas con certeza razonable:',strict,'líneas',strictLines,'bytes',strictBytes);
// selectores repetidos
const bySel=new Map();for(const r of rules){const k=r.ctx+'¦'+r.sel.replace(/\s+/g,' ');bySel.set(k,(bySel.get(k)||0)+1)}
let rep3=0,repExtra=0;for(const [k,c] of bySel){if(c>=2){rep3++;repExtra+=c-1}}
console.log('selectores definidos 2+ veces:',rep3,'reglas sobrantes si se fusionaran:',repExtra);
fs.writeFileSync('/tmp/lint/css-strict.json',JSON.stringify(strictList.map(r=>({s:r.start,e:r.end,sel:r.sel.slice(0,100),l:r.startLine,lines:r.lines}))));
