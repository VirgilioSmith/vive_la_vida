/* VIVE · LIQUID ART — ilustraciones de cristal para «Buscar» (Mi dinero, Tarjetas, Pagos, Servicios, Movimientos, Analítica).
   Mismo lenguaje que el Liquid Glass Engine: cuerpo translúcido con absorción cromática, rim de luz, brillo de curvatura,
   reflejo especular, espesor (extrusión/sombra de contacto) y refracción del contenido que queda detrás del cristal.
   Son SVG estáticos (se dibujan una vez; sin animación, sin filtros dinámicos). Cada ilustración conserva su color de identidad. */
(function(){
 'use strict';
 const W=150,H=130;
 /* Definiciones compartidas por ilustración (ids únicos por prefijo u). c1 = tinte claro, c2 = tinte profundo. */
 const defs=(u,c1,c2)=>`<defs>
  <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".42" stop-color="${c1}" stop-opacity=".58"/><stop offset="1" stop-color="${c2}" stop-opacity=".88"/></linearGradient>
  <linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".34" stop-color="#fff" stop-opacity=".14"/><stop offset=".68" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>
  <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="${u}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
  <filter id="${u}bl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="${u}sh" x="-30%" y="-40%" width="160%" height="200%"><feGaussianBlur stdDeviation="5.5"/></filter>
  <filter id="${u}rf" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="1" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>
 </defs>`;
 /* Un cristal = cuerpo + brillo de curvatura + rim. shape(attrs) devuelve el elemento con esos atributos. */
 const glass=(u,shape,spec)=>shape(`fill="url(#${u}b)"`)+shape(`fill="none" stroke="url(#${u}d)" stroke-width=".9" opacity=".38"`)+shape(`fill="url(#${u}s)" opacity=".55"`)+shape(`fill="none" stroke="url(#${u}r)" stroke-width="1.7"`)+(spec?`<ellipse cx="${spec[0]}" cy="${spec[1]}" rx="${spec[2]}" ry="${spec[3]}" fill="#fff" opacity=".7" filter="url(#${u}bl)"/>`:'');
 const rect=(x,y,w,h,r,t='')=>a=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${t} ${a}/>`;
 const path=(d,t='')=>a=>`<path d="${d}" ${t} ${a}/>`;
 const shadow=(u,cx,cy,rx,ry,c)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity=".3" filter="url(#${u}sh)"/>`;
 const svg=(u,c1,c2,body)=>`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${defs(u,c1,c2)}${body}</svg>`;

 const art={
  /* Mi dinero · estructura bancaria de cristal */
  dinero(){const u='vlaD';
   const col=x=>glass(u,rect(x,42,13,48,6.5),[x+4,50,3,9])+`<rect x="${x+3.4}" y="50" width="2.6" height="34" rx="1.3" fill="#fff" opacity=".45"/>`;
   return svg(u,'#7cc4ff','#2563eb',
    shadow(u,75,116,50,7,'#1d4ed8')+
    glass(u,rect(22,100,106,11,5))+glass(u,rect(31,91,88,10,5))+
    [37,58,79,100].map(col).join('')+
    glass(u,rect(26,34,98,10,5),[48,37,16,2.4])+
    glass(u,path('M75 8 126 33H24z','stroke-linejoin="round"'),[62,24,12,3.4])+
    `<circle cx="75" cy="25" r="5.4" fill="#fff" opacity=".78"/><circle cx="75" cy="25" r="2.6" fill="url(#${u}d)" opacity=".9"/>`)},
  /* Tarjetas · tarjetas de crédito translúcidas superpuestas */
  tarjetas(){const u='vlaT';
   const card=(rot,cx,cy,chip)=>`<g transform="rotate(${rot} ${cx} ${cy})">`+glass(u,rect(cx-40,cy-26,80,52,11),[cx-24,cy-17,18,4])+
     (chip?`<rect x="${cx-30}" y="${cy-8}" width="17" height="13" rx="3.4" fill="#fff" opacity=".82"/><rect x="${cx-30}" y="${cy-8}" width="17" height="13" rx="3.4" fill="url(#${u}d)" opacity=".35"/><path d="M${cx+20} ${cy-6}c4 3 4 9 0 12m5-15c7 5 7 17 0 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`:`<path d="M${cx-34} ${cy+12}h26m6 0h8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`)+`</g>`;
   return svg(u,'#c4a5ff','#7c3aed',
    shadow(u,78,112,46,6,'#6d28d9')+
    `<g filter="url(#${u}rf)">`+card(-15,58,52,false)+`</g>`+card(9,86,78,true))},
  /* Pagos · calendario volumétrico */
  pagos(){const u='vlaP';
   return svg(u,'#ffd29a','#f97316',
    shadow(u,76,118,48,6,'#ea580c')+
    `<rect x="23" y="31" width="98" height="78" rx="15" fill="url(#${u}d)" opacity=".7" transform="translate(3 4.5)"/>`+
    glass(u,rect(23,31,98,78,15),[46,40,20,4.2])+
    `<path d="M23 54h98" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/><path d="M38 31h68a15 15 0 0 1 15 15v8H23v-8a15 15 0 0 1 15-15z" fill="url(#${u}d)" opacity=".5"/>`+
    glass(u,rect(45,19,9,24,4.5))+glass(u,rect(90,19,9,24,4.5))+
    `<g filter="url(#${u}rf)"><path d="M49 80l17 17 33-34" fill="none" stroke="url(#${u}d)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/></g><path d="M49 80l17 17 33-34" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".75" transform="translate(-1.2 -1.6)"/>`)},
  /* Servicios · composición 3D de marcas */
  servicios(){const u='vlaS';
   const apple='M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
   const tile=(rot,cx,cy,s,tint,inner)=>`<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${cx-s/2+3}" y="${cy-s/2+5}" width="${s}" height="${s}" rx="${s*.28}" fill="${tint}" opacity=".35" filter="url(#${u}sh)"/>`+glass(u,rect(cx-s/2,cy-s/2,s,s,s*.28),[cx-s*.18,cy-s*.3,s*.2,s*.07])+inner+`</g>`;
   return svg(u,'#ffffff','#9aa3b5',
    tile(-9,46,66,58,'#dc2626',`<rect x="22" y="48" width="48" height="36" rx="10" fill="#e11d2e" opacity=".9"/><path d="M40 56l17 10-17 10z" fill="#fff"/>`)+
    tile(10,102,92,54,'#0a0a0f',`<rect x="76" y="66" width="52" height="52" rx="15" fill="#0b0b10" opacity=".86"/><rect x="92" y="80" width="8" height="24" rx="1.5" fill="#b20710"/><rect x="108" y="80" width="8" height="24" rx="1.5" fill="#b20710"/><path d="M92 80h8l16 24h-8z" fill="#e50914"/>`)+
    tile(7,108,36,50,'#6b7280',`<g fill="#17171b" transform="translate(94.5 21) scale(.62)"><path d="${apple}"/></g>`))},
  /* Movimientos · documento financiero translúcido */
  movimientos(){const u='vlaM';
   const doc='M54 12h50a11 11 0 0 1 11 11v82l-9 9-9-6-9 6-9-6-9 6-9-6-9 6-9-9V23a11 11 0 0 1 11-11z';
   return svg(u,'#8ff0d6','#0d9488',
    shadow(u,78,122,42,6,'#0f766e')+
    `<g transform="rotate(5 80 66)"><g filter="url(#${u}rf)"><path d="M54 36h42M54 49h34M54 62h40" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" opacity=".9"/><rect x="56" y="88" width="9" height="16" rx="3" fill="#5eead4"/><rect x="72" y="78" width="9" height="26" rx="3" fill="#2dd4bf"/><rect x="88" y="68" width="9" height="36" rx="3" fill="url(#${u}d)"/></g>`+
    glass(u,path(doc),[58,24,18,3.6])+`<path d="M54 36h42M54 49h34M54 62h40" fill="none" stroke="url(#${u}d)" stroke-width="2.4" stroke-linecap="round" opacity=".5"/></g>`)},
  /* Analítica · gráfico tridimensional con refracción y profundidad */
  analitica(){const u='vlaA';
   const bar=(x,h)=>{const y=108-h;return `<path d="M${x+14} ${y+3}l6-4v${h}l-6 4z" fill="url(#${u}d)" opacity=".55"/>`+glass(u,rect(x,y,14,h,5),[x+4,y+7,3,5])};
   return svg(u,'#9ccaff','#2563eb',
    shadow(u,76,118,52,6,'#1d4ed8')+
    glass(u,rect(16,106,122,9,4.5))+
    bar(26,26)+bar(50,40)+bar(74,56)+bar(98,74)+
    `<g filter="url(#${u}rf)"><path d="M30 78 56 60 82 66 118 28" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/></g>`+
    `<path d="M30 78 56 60 82 66 118 28" fill="none" stroke="url(#${u}d)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`+
    [[30,78],[56,60],[82,66],[118,28]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#fff"/><circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="url(#${u}d)"/>`).join(''))}
 };
 window.ViveLiquidArt=Object.freeze(Object.fromEntries(Object.entries(art).map(([k,f])=>[k,()=>{try{return f()}catch(e){return ''}}])));
})();
