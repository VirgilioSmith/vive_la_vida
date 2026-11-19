const acorn=require('/opt/node-tools/node_modules/acorn'),walk=require('/opt/node-tools/node_modules/acorn-walk');
const fs=require('fs');const src=fs.readFileSync('/tmp/lint/app.js','utf8');
const lint=require('/tmp/lint/lint.json')[0].messages.filter(m=>m.ruleId==='no-unused-vars');
const ast=acorn.parse(src,{ecmaVersion:2023,locations:true,allowHashBang:true});
// map decl by identifier start line/col
const idx=new Map();
walk.fullAncestor(ast,(node,st,anc)=>{
 if((node.type==='FunctionDeclaration'||node.type==='ClassDeclaration')&&node.id){idx.set(node.id.loc.start.line+':'+node.id.loc.start.column,{kind:node.type==='FunctionDeclaration'?'function':'class',node})}
 if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'){const decl=anc[anc.length-2];idx.set(node.id.loc.start.line+':'+node.id.loc.start.column,{kind:'var',node,decl})}
});
const rows=[];let total=0;
for(const m of lint){const e=idx.get(m.line+':'+(m.column-1));if(!e){rows.push({name:m.message.split("'")[1],line:m.line,kind:'?',lines:1});continue}
 const n=e.kind==='var'&&e.decl&&e.decl.declarations.length===1?e.decl:e.node;const lines=n.loc.end.line-n.loc.start.line+1;
 const hasCall=e.kind==='var'&&e.node.init&&/Call|New|Await/.test(e.node.init.type);
 rows.push({name:m.message.split("'")[1],line:m.line,kind:e.kind,lines,sideEffect:hasCall})}
rows.sort((a,b)=>b.lines-a.lines);
const by={};for(const r of rows){by[r.kind]=(by[r.kind]||{n:0,lines:0});by[r.kind].n++;by[r.kind].lines+=r.lines;total+=r.lines}
console.log(JSON.stringify(by),'total lines',total);
console.log(rows.slice(0,25).map(r=>r.kind+' '+r.name+' L'+r.line+' ('+r.lines+' líneas)'+(r.sideEffect?' [llamada]':'')).join('\n'));
fs.writeFileSync('/tmp/lint/unused.json',JSON.stringify(rows,null,1));
