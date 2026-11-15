const {chromium}=require('playwright');const fs=require('fs');
const SP=__dirname;
const mock=fs.readFileSync(__dirname+'/mock.js','utf8');
module.exports=async function open(b,w,h){
  const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h||900}},process.env.TOUCH?{hasTouch:true,isMobile:true,deviceScaleFactor:2}:{}));
  await ctx.route('**/*',r=>{const u=r.request().url();const ROOT=process.env.ROOT||require('path').resolve(__dirname,'..');
  if(u.includes('supabase-js'))return r.fulfill({body:mock,contentType:'application/javascript'});
  const m=u.match(/^http:\/\/localhost:8765\/([^?#]*)/);
  if(m){const f=ROOT+'/'+(m[1]||'index.html');
   if(!fs.existsSync(f))return r.fulfill({status:404,body:''});
   let body=fs.readFileSync(f);const ext=f.split('.').pop();const ct={html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',webmanifest:'application/manifest+json'}[ext]||'application/octet-stream';
   if(ext==='html'||ext==='js'){let t=body.toString('utf8');const L=t.split('\n');const k=L.findIndex(l=>l.includes('window.__viveCore=Object.freeze'));if(k>=0){const i=L.findIndex((l,j)=>j>k&&l==='})();');if(i>=0){L.splice(i,0,"window.__T={rep:(k,e)=>v216Modal(k,e),dis:g=>v980DismissSplash(g),acc:()=>v980SplashAccent(),mt:()=>{const d=new Date();return monthlyTotals(d.getFullYear(),d.getMonth()+1)},inv:()=>v99Invalidate(),cap:()=>v89DebtCapacity(),capx:d=>v89CapacityExplanation(d),dbg:()=>db,cs:(id,c)=>cardStatus(card(id),c),fn:{today,loanRateAt,v169CardCycleLedger,txDop,v144CurrentFx,rnd,plusMonths,diffDays,cutFor,lastCutAt,cardDue,monthDay,fullOriginalLoan,certProjection,getAccountBalance,v49LoanPeriodsPerMonth,v49LoanPeriodCount,v49LoanPeriodInsurance,v49LoanPeriodFee,v49LoanPeriodInterest,v900Round:typeof v900Round==='function'?v900Round:null},boot(){db=migrateData(seedDemo());db.settings.theme=(window.__THEME||'light');if(window.__PALETTE){db.settings.paletteChoice=window.__PALETTE}if(window.__PALHEX){db.settings.paletteChoice='custom';db.settings.paletteHex=window.__PALHEX}f33User={id:'00000000-0000-0000-0000-000000000001'};f33Stamp='1';f33Ready();return f33Phase},go(pg){ui.page=pg;render()},ui:()=>ui,catIcon:(k,c,sb)=>v255TaxonomyIconName(k,c,sb),cats:k=>Object.keys(categoryMap(k)),subs:(k,c)=>categoryMap(k)[c]||[]};");t=L.join('\n');}}body=Buffer.from(t);}
   return r.fulfill({body,contentType:ct});}
  return r.abort();});
  await ctx.addInitScript('window.__THEME='+JSON.stringify(process.env.THEME||'light'));
  if(process.env.PALETTE)await ctx.addInitScript('window.__PALETTE='+JSON.stringify(process.env.PALETTE));
  if(process.env.PALHEX)await ctx.addInitScript('window.__PALHEX='+JSON.stringify(process.env.PALHEX));
  if(process.env.SAFE){const [t,bm]=process.env.SAFE.split(',');await ctx.addInitScript(`document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.id='__safe';st.textContent='html{--v954-safe-top:${t}px!important;--v954-safe-bottom:${bm}px!important}@media(max-width:790px){.shell{padding-top:calc(66px + ${t}px)!important}}';document.head.appendChild(st)})`)}
  if(process.env.KB)await ctx.addInitScript({path:__dirname+'/kbinit.js'});
  const p=await ctx.newPage();
  await p.goto('http://localhost:8765/index.html',{waitUntil:'load'});await p.waitForTimeout(2500);
  await p.evaluate(()=>window.__T.boot());await p.waitForTimeout(1200);
  return {ctx,p};
};
if(require.main===module)(async()=>{
 const b=await chromium.launch();const [w,pg,expr]=[+process.argv[2],process.argv[3],process.argv[4]];
 const {p}=await module.exports(b,w);
 await p.evaluate(pg=>window.__T.go(pg),pg);await p.waitForTimeout(600);
 console.log(await p.evaluate(expr));
 await b.close();
})();
