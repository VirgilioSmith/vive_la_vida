const acorn=require('/opt/node-tools/node_modules/acorn'),walk=require('/opt/node-tools/node_modules/acorn-walk'),fs=require('fs');
const src=fs.readFileSync('/tmp/lint/app.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:2023,locations:true});
// 2) function declarations that are later reassigned (name = ...)
const decls=new Map();const assigns=[];
walk.full(ast,n=>{
 if(n.type==='FunctionDeclaration'&&n.id){const a=decls.get(n.id.name)||[];a.push(n);decls.set(n.id.name,a)}
 if(n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&/Function/.test(n.right.type))assigns.push(n)});
let ov=0,ovLines=0,wrapCapture=0;const rows=[];
for(const a of assigns){const d=decls.get(a.left.name);if(!d)continue;const orig=d[0];
 // ¿el reemplazo conserva el original? busca captura previa: "=name" o "name.apply/call" en texto del reemplazo o línea anterior
 const body=src.slice(a.start,a.end);const before=src.slice(Math.max(0,a.start-400),a.start);
 const keeps=new RegExp('(=\\s*'+a.left.name+'\\s*[;,)]|\\b'+a.left.name+'\\.(apply|call)\\b|previous|prev\\w*|original\\w*|old\\w*)').test(before+body);
 ov++;if(!keeps){ovLines+=orig.loc.end.line-orig.loc.start.line+1;rows.push([a.left.name,orig.loc.end.line-orig.loc.start.line+1])}else wrapCapture++}
console.log('funciones declaradas y luego reasignadas:',ov,'| que parecen conservar la original (envoltorio):',wrapCapture,'| que NO la conservan (original posiblemente muerta):',rows.length,'→ líneas de esas originales:',ovLines);
console.log(rows.sort((a,b)=>b[1]-a[1]).slice(0,10).map(r=>r.join(' ')).join(', '));
// 3) case labels con ruta de activación
const cases=[];walk.full(ast,n=>{if(n.type==='SwitchCase'&&n.test&&n.test.type==='Literal'&&typeof n.test.value==='string')cases.push(n)});
const allText=src;let deadCase=0,deadCaseLines=0;const dc=[];
const seen=new Set();
for(const c of cases){const lbl=c.test.value;if(seen.has(lbl))continue;seen.add(lbl);
 const re=new RegExp("data-act=\\\\?[\"']"+lbl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\\\\?[\"']|act:\\s*['\"]"+lbl+"['\"]|['\"]"+lbl+"['\"]","g");
 const hits=(allText.match(re)||[]).length;
 if(hits<=1){deadCase++;deadCaseLines+=c.loc.end.line-c.loc.start.line+1;dc.push(lbl)}}
console.log('etiquetas de acción (case) únicas:',seen.size,'| sin ningún origen aparte del propio case:',deadCase,'líneas',deadCaseLines);
console.log(dc.slice(0,25).join(', '));
// 4) bloques versionados
const tags=src.match(/\/\*\s*V\d+[\s·:]/g)||[];console.log('bloques comentados «V###»:',tags.length);
// pages overrides
const pg=(src.match(/\bpages\.\w+\s*=/g)||[]);const cnt={};for(const p of pg)cnt[p]=(cnt[p]||0)+1;console.log('reasignaciones pages.X:',Object.entries(cnt).map(([k,v])=>k+'×'+v).join(' '));
const renders=(src.match(/\brender\s*=\s*function/g)||[]).length;console.log('render=function ×',renders);
