/* Detecta (y con el argumento «write» elimina) declaraciones de variables de src/app.js sin lecturas ni escrituras por nombre en todo el archivo. Uso: npm i acorn@8.12.1 acorn-walk@8.3.3 && node docs/auditoria/codigo-muerto.js [write] */
const acorn=require('acorn'),walk=require('acorn-walk'),fs=require('fs');
const R=require('path').resolve(__dirname,'../..')+'/';let src=fs.readFileSync(R+'src/app.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:2022,locations:true,allowReturnOutsideFunction:true});
const declIds=new Set(),count={};
walk.full(ast,n=>{if(n.type==='VariableDeclarator'&&n.id.type==='Identifier')declIds.add(n.id);if(n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern')for(const p of n.id.properties){const v=p.value||p.argument;if(v&&v.type==='Identifier')declIds.add(v)}});
walk.full(ast,n=>{if(n.type==='VariablePattern'||(n.type==='Identifier'&&0)){}});
const vp=n=>{count[n.name]=(count[n.name]||0)+1};
walk.full(ast,n=>{if(n.type==='AssignmentExpression'||n.type==='UpdateExpression'){const t=n.left||n.argument;const grab=x=>{if(!x)return;if(x.type==='Identifier')vp(x);else if(x.type==='ObjectPattern')x.properties.forEach(q=>grab(q.value||q.argument));else if(x.type==='ArrayPattern')x.elements.forEach(grab);else if(x.type==='AssignmentPattern')grab(x.left);else if(x.type==='RestElement')grab(x.argument)};grab(t)}if(n.type==='ForInStatement'||n.type==='ForOfStatement'){if(n.left.type==='Identifier')vp(n.left)}});
walk.ancestor(ast,{Identifier(n,_,anc){if(declIds.has(n))return;const p=anc[anc.length-2];if(p&&p.type==='MemberExpression'&&p.property===n&&!p.computed)return;if(p&&p.type==='Property'&&p.key===n&&!p.computed&&!p.shorthand)return;count[n.name]=(count[n.name]||0)+1}});
const PURE=['Literal','ArrowFunctionExpression','FunctionExpression','ArrayExpression','ObjectExpression','TemplateLiteral'];
const cuts=[];
walk.ancestor(ast,{VariableDeclaration(n,_,anc){if(n.declarations.length!==1)return;const d=n.declarations[0];if(d.id.type!=='Identifier'||count[d.id.name]||!d.init||!PURE.includes(d.init.type))return;
 const parent=anc[anc.length-2];if(!['BlockStatement','Program'].includes(parent.type))return;
 // plantilla/objeto/array puros: sin llamadas internas (efectos)
 let impure=false;walk.full(d.init,m=>{if(m.type==='CallExpression'&&d.init.type!=='ArrowFunctionExpression'&&d.init.type!=='FunctionExpression')impure=true;if(m.type==='NewExpression')impure=true});if(impure)return;
 cuts.push([n.start,n.end,d.id.name,n.loc.start.line,n.loc.end.line-n.loc.start.line+1])}});
cuts.sort((a,b)=>b[0]-a[0]);let total=0;
for(const [s,e,name,l,len] of cuts){src=src.slice(0,s)+src.slice(e).replace(/^[ \t]*\n?/,'');total+=len;}
console.log('eliminadas',cuts.length,'declaraciones;',total,'líneas:',cuts.map(c=>c[2]+'@'+c[3]).join(' '));
if(process.argv[2]==='write')fs.writeFileSync(R+'src/app.js',src);
