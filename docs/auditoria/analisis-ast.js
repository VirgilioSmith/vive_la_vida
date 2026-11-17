/* Análisis estático de src/app.js (AST): funciones redefinidas, listeners globales dentro de funciones, intervalos y fechas.  Uso: npm i acorn@8.12.1 acorn-walk@8.3.3 && node docs/auditoria/analisis-ast.js [ruta/app.js] */
const acorn=require('acorn'),walk=require('acorn-walk'),fs=require('fs');
const src=fs.readFileSync(''+(process.argv[2]||'src/app.js')+'','utf8');
const ast=acorn.parse(src,{ecmaVersion:2022,locations:true,allowReturnOutsideFunction:true});
const lineOf=n=>n.loc.start.line;
// 1. declaraciones y reasignaciones de funciones por nombre (en cualquier ámbito)
const decl={},assign={};
walk.full(ast,n=>{if(n.type==='FunctionDeclaration'&&n.id)(decl[n.id.name]=decl[n.id.name]||[]).push(lineOf(n));
 if(n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&/Function/.test(n.right.type))(assign[n.left.name]=assign[n.left.name]||[]).push(lineOf(n));});
const dupDecl=Object.entries(decl).filter(([k,v])=>v.length>1);
const reassigned=Object.entries(assign).filter(([k,v])=>decl[k]||v.length>1);
console.log('declaraciones de función:',Object.keys(decl).length,'· nombres declarados >1 vez:',dupDecl.length,'· funciones reasignadas (override):',reassigned.length,'· total reasignaciones:',reassigned.reduce((a,[k,v])=>a+v.length,0));
console.log('top overrides:',reassigned.sort((a,b)=>b[1].length-a[1].length).slice(0,10).map(([k,v])=>k+'×'+(v.length+(decl[k]?decl[k].length:0))).join(', '));
// 2. listeners globales dentro de funciones (se repiten por llamada)
let inFn=0;const gl=[];
walk.ancestor(ast,{CallExpression(n,_,anc){const c=n.callee;if(c.type==='MemberExpression'&&c.property.name==='addEventListener'&&c.object.type==='Identifier'&&/^(document|window)$/.test(c.object.name)){const fns=anc.filter(a=>/Function/.test(a.type));
 // dentro de una función que NO es el IIFE raíz
 if(fns.length>1){inFn++;const f=fns[fns.length-1];gl.push([lineOf(n),f.id?f.id.name:'(anon)'])}}}});
console.log('document/window.addEventListener dentro de funciones anidadas:',inFn);
console.log(gl.slice(0,40).map(x=>x.join('@')).join(' '));
// 3. setInterval sin clear
walk.simple(ast,{CallExpression(n){if(n.callee.name==='setInterval')console.log('setInterval @',lineOf(n))}});
// 4. promesas: .then sin catch / async sin try
let thens=0,thenNoCatch=0;
walk.simple(ast,{CallExpression(n){const c=n.callee;if(c.type==='MemberExpression'&&c.property.name==='then'){thens++;}}});
console.log('.then(:',thens);
// 5. Date local vs UTC
let dstr=0;walk.simple(ast,{CallExpression(n){const c=n.callee;if(c.type==='MemberExpression'&&['getFullYear','getMonth','getDate','getDay'].includes(c.property.name))dstr++}});
console.log('getFullYear/Month/Date/Day (hora local):',dstr);
let utc=0;walk.simple(ast,{CallExpression(n){const c=n.callee;if(c.type==='MemberExpression'&&/^getUTC/.test(c.property.name))utc++}});console.log('getUTC*:',utc);
// 6. aritmética de flotantes sobre importes sin rnd: multiplicaciones por 'amount' etc.
let mulAmt=0;walk.simple(ast,{BinaryExpression(n){if(n.operator==='*'||n.operator==='/'){const t=src.slice(n.start,n.end);if(/amount|balance|total|rate|fx/i.test(t))mulAmt++}}});console.log('operaciones * y / sobre importes/tasas:',mulAmt);
