/* VIVE · INTELLIGENCE — caja de herramientas estadística (pura, determinista, sin DOM ni red).
   Métodos robustos y de bajo costo; cada uno es interpretable y verificable con las pruebas unitarias.
   Aleatoriedad: generador con semilla (mulberry32) → resultados reproducibles y auditables. */
(function(root){
 'use strict';
 const sum=a=>a.reduce((s,x)=>s+x,0);
 const mean=a=>a.length?sum(a)/a.length:0;
 const sorted=a=>[...a].sort((x,y)=>x-y);
 function quantile(a,q){if(!a.length)return 0;const s=sorted(a),p=(s.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return s[lo]+(s[hi]-s[lo])*(p-lo)}
 const median=a=>quantile(a,.5);
 const variance=a=>{if(a.length<2)return 0;const m=mean(a);return sum(a.map(x=>(x-m)**2))/(a.length-1)};
 const stdev=a=>Math.sqrt(variance(a));
 /* MAD escalada (consistente con σ en normal) */
 const mad=a=>{if(!a.length)return 0;const m=median(a);return 1.4826*median(a.map(x=>Math.abs(x-m)))};
 const iqr=a=>quantile(a,.75)-quantile(a,.25);
 /* z-score robusto: (x − mediana)/MAD. Con MAD=0 usa la desviación media absoluta como respaldo; si todo es constante → 0 */
 function robustZ(x,a){const m=median(a);let s=mad(a);if(!(s>0)){const d=mean(a.map(v=>Math.abs(v-m)))*1.2533;s=d>0?d:0}return s>0?(x-m)/s:0}
 /* Rangos personales de normalidad: [Q1−1.5·IQR, Q3+1.5·IQR] */
 function personalRange(a){const q1=quantile(a,.25),q3=quantile(a,.75),r=q3-q1;return {q1,q3,low:q1-1.5*r,high:q3+1.5*r,median:median(a)}}
 /* Media móvil exponencial */
 function ewma(a,alpha){const out=[];let s=null;for(const x of a){s=s==null?x:alpha*x+(1-alpha)*s;out.push(s)}return out}
 /* CUSUM bilateral sobre valores estandarizados con la línea base (primeros n0 puntos).
    k = holgura (en σ), h = umbral (en σ). Devuelve índice del primer cambio y su dirección. */
 function cusum(a,{n0=Math.max(6,Math.floor(a.length/2)),k=.5,h=4}={}){
  if(a.length<n0+3)return null;const base=a.slice(0,n0);const m=median(base);let s=mad(base);if(!(s>0))s=stdev(base)||0;if(!(s>0))return null;
  let hi=0,lo=0,idx=-1,dir=0;
  for(let i=n0;i<a.length;i++){const z=(a[i]-m)/s;hi=Math.max(0,hi+z-k);lo=Math.max(0,lo-z-k);if(hi>h){idx=i;dir=1;break}if(lo>h){idx=i;dir=-1;break}}
  if(idx<0)return null;
  /* retroceder hasta el inicio probable del cambio (último punto donde la suma acumulada fue 0) */
  let start=idx;const run=dir>0?(i=>(a[i]-m)/s-k):(i=>-(a[i]-m)/s-k);let acc=0;for(let i=idx;i>=n0;i--){acc+=run(i);if(acc<=0){start=i+1;break}start=i}
  return {index:idx,start,direction:dir,baseline:m,scale:s,after:median(a.slice(start)),shiftPct:m?100*(median(a.slice(start))-m)/Math.abs(m):null};
 }
 /* Regresión lineal simple con intervalo de predicción aproximado (t ≈ 2 para n≥10) */
 function linreg(y){
  const n=y.length;if(n<3)return null;const x=y.map((_,i)=>i),mx=mean(x),my=mean(y);
  let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(x[i]-mx)**2;sxy+=(x[i]-mx)*(y[i]-my)}
  const b=sxx?sxy/sxx:0,a=my-b*mx;const res=y.map((v,i)=>v-(a+b*i));const se=Math.sqrt(sum(res.map(r=>r*r))/Math.max(1,n-2));
  const r2=(()=>{const ss=sum(y.map(v=>(v-my)**2));return ss?1-sum(res.map(r=>r*r))/ss:0})();
  const t=n>=30?1.96:n>=15?2.13:n>=8?2.45:3.2;
  return {slope:b,intercept:a,se,r2,n,predict:(i)=>({mean:a+b*i,low:a+b*i-t*se*Math.sqrt(1+1/n+((i-mx)**2)/(sxx||1)),high:a+b*i+t*se*Math.sqrt(1+1/n+((i-mx)**2)/(sxx||1))})};
 }
 /* Generador con semilla */
 function rng(seed){let a=(seed>>>0)||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
 function ranks(a){const idx=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);const r=new Array(a.length);let i=0;while(i<idx.length){let j=i;while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;const rk=(i+j)/2+1;for(let k=i;k<=j;k++)r[idx[k][1]]=rk;i=j+1}return r}
 function pearson(x,y){const n=x.length;if(n<3)return 0;const mx=mean(x),my=mean(y);let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy}return sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):0}
 const spearman=(x,y)=>pearson(ranks(x),ranks(y));
 /* Correlación de Spearman con valor p por permutación (semilla fija) */
 function spearmanPerm(x,y,{perms=1000,seed=7}={}){
  const n=x.length;const r=spearman(x,y);const R=rng(seed);let ge=0;const rx=ranks(x),ry=ranks(y);const yy=[...ry];
  for(let p=0;p<perms;p++){for(let i=n-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=yy[i];yy[i]=yy[j];yy[j]=t}if(Math.abs(pearson(rx,yy))>=Math.abs(r)-1e-12)ge++}
  return {rho:r,p:(ge+1)/(perms+1),n};
 }
 /* Corrección de Benjamini–Hochberg (control de tasa de falsos descubrimientos) */
 function benjaminiHochberg(ps,q=.1){const m=ps.length;const o=ps.map((p,i)=>[p,i]).sort((a,b)=>a[0]-b[0]);let k=-1;for(let i=0;i<m;i++)if(o[i][0]<=(i+1)/m*q)k=i;const keep=new Set();for(let i=0;i<=k;i++)keep.add(o[i][1]);return ps.map((_,i)=>keep.has(i))}
 /* Prueba binomial exacta unilateral (P[X ≥ k]) para secuencias */
 function binomTail(n,k,p){if(k<=0)return 1;let s=0,c=1;const lp=Math.log(p),lq=Math.log(1-p);const lf=[0];for(let i=1;i<=n;i++)lf[i]=lf[i-1]+Math.log(i);for(let i=k;i<=n;i++){s+=Math.exp(lf[n]-lf[i]-lf[n-i]+i*lp+(n-i)*lq)}return Math.min(1,s)}
 /* Isolation Forest compacto (Liu et al., 2008). Puntuación ∈ (0,1): cercana a 1 = más aislado */
 function isolationForest(X,{trees=64,sample=128,seed=11}={}){
  const n=X.length;if(n<20)return X.map(()=>0.5);const R=rng(seed),psi=Math.min(sample,n),maxD=Math.ceil(Math.log2(psi));
  const c=m=>m<=1?0:2*(Math.log(m-1)+0.5772156649)-2*(m-1)/m;
  const build=(rows,d)=>{if(d>=maxD||rows.length<=1)return {size:rows.length};const f=Math.floor(R()*rows[0].length);const vals=rows.map(r=>r[f]);const lo=Math.min(...vals),hi=Math.max(...vals);if(lo===hi)return {size:rows.length};const s=lo+R()*(hi-lo);return {f,s,l:build(rows.filter(r=>r[f]<s),d+1),r:build(rows.filter(r=>r[f]>=s),d+1)}};
  const forest=[];for(let t=0;t<trees;t++){const idx=[];for(let i=0;i<psi;i++)idx.push(X[Math.floor(R()*n)]);forest.push(build(idx,0))}
  const path=(x,node,d)=>node.f==null?d+c(node.size):(x[node.f]<node.s?path(x,node.l,d+1):path(x,node.r,d+1));
  const cn=c(psi)||1;return X.map(x=>{const e=mean(forest.map(t=>path(x,t,0)));return Math.pow(2,-e/cn)});
 }
 /* Remuestreo (bootstrap) con semilla */
 function bootstrap(a,n,R){const out=[];for(let i=0;i<n;i++)out.push(a[Math.floor(R()*a.length)]);return out}
 /* Intervalo de confianza bootstrap de la mediana */
 function bootCI(a,{reps=300,seed=5,level=.9}={}){if(a.length<5)return null;const R=rng(seed),m=[];for(let i=0;i<reps;i++)m.push(median(bootstrap(a,a.length,R)));return {low:quantile(m,(1-level)/2),high:quantile(m,1-(1-level)/2)}}
 const api={sum,mean,median,quantile,variance,stdev,mad,iqr,robustZ,personalRange,ewma,cusum,linreg,rng,ranks,pearson,spearman,spearmanPerm,benjaminiHochberg,binomTail,isolationForest,bootstrap,bootCI};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ViveStats=api;
})(typeof window!=='undefined'?window:globalThis);
