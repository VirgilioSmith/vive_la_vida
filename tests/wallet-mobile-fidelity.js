'use strict';
/* Auditoría visual y funcional de las tres pantallas aprobadas de Wallet móvil.
   Pruebas reales en Chromium/WebKit, datos locales de tests/harness.
   Capturas y métricas en test-results/wallet-mobile-fidelity. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const open=require('./harness');
const browserName=process.env.WALLET_BROWSER==='webkit'?'webkit':'chromium';
const engine=browserName==='webkit'?webkit:chromium;
const sizes=[320,375,390,430],themes=['light','black'],GLOBAL='__vive_wallet_credit_global__';
const root='test-results/wallet-mobile-fidelity';
const results=[];
const visible=async locator=>await locator.isVisible();
const readGeometry=async page=>page.evaluate(()=>{
 const rect=e=>{let r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
 const isVisible=e=>{let c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0};
 const wallet=document.querySelector('.v68-wallet'),dock=document.querySelector('.vive-mobile-dock');
 const panels=wallet?[...wallet.children].filter(e=>e.matches('.wallet-mobile-summary,.v1244-state,.v1244-cutpanel,.v371-card-return,.v1301-distribution,.wallet-benefits-cards')).filter(isVisible):[];
 /* scrollWidth en .v1301-rank incluye una decoración de 9px;
    sus tres hijos están íntegramente dentro del renglón. Validar contenido real. */
 const overflowing=e=>{
   if(!e.matches('.v1301-rank'))return e.scrollWidth>e.clientWidth+3;
   const bounds=e.getBoundingClientRect();
   return [...e.children].some(c=>{
     const r=c.getBoundingClientRect();
     return c.scrollWidth>c.clientWidth+3||r.left<bounds.left-3||r.right>bounds.right+3;
   });
 };
 const clipping=[...document.querySelectorAll('.v1244-limits,.v1301-rank,.v1301-rank-info,.v1301-equivalent,.v371-return-tile,.v1244-pill,.wallet-return-actions button')].filter(isVisible).filter(overflowing).map(e=>({className:e.className,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,text:e.innerText.slice(0,60)}));
 return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
  wallet:wallet&&rect(wallet),mainCarousel:!!wallet?.classList.contains('wallet-carousel-restored'),panels:panels.map(e=>({name:e.className,box:rect(e)})),
  dock:dock&&rect(dock),clipping,
  mobileToolsOpen:!!wallet?.querySelector('.wallet-mobile-tools')?.open,
  navigation:[...document.querySelectorAll('.vive-mobile-dock-item')].map(e=>e.getAttribute('aria-label'))};
});
const assertGeometry=(g,label,width)=>{
 assert.ok(g.wallet,'Wallet inexistente '+label);
 assert.ok(g.scrollWidth<=width+2,'Scroll horizontal '+label+': '+JSON.stringify(g));
 if(g.mainCarousel)assert.ok(g.wallet.left>=-2&&g.wallet.right<=width+2,'La portada Wallet excede viewport '+label+': '+JSON.stringify(g.wallet));
 else assert.ok(g.wallet.left>=12&&g.wallet.right<=width-12,'La subvista Wallet excede viewport '+label+': '+JSON.stringify(g.wallet));
 assert.ok(g.panels.length>=2,'Paneles principales ausentes '+label);
 for(const p of g.panels){if(g.mainCarousel)assert.ok(p.box.left>=6&&p.box.right<=width-6&&p.box.width>=width-28,'Panel no aprovecha los bordes de Wallet '+label+': '+JSON.stringify(p));
 else assert.ok(p.box.left>=12&&p.box.right<=width-12,'Panel de subvista fuera de márgenes '+label+': '+JSON.stringify(p));}
 for(let i=1;i<g.panels.length;i++)assert.ok(g.panels[i].box.top>=g.panels[i-1].box.bottom+7,'Paneles solapados '+label+': '+g.panels[i].name);
 assert.deepEqual(g.clipping,[],'Texto recortado '+label);
 assert.deepEqual(g.navigation,['Inicio','Wallet','Bancos','Explorar','Buscar']);
};
const screenshot=async(p,dir,name)=>p.screenshot({path:path.join(dir,name+'.png'),fullPage:true,animations:'disabled'});
(async()=>{
 const browser=await engine.launch({headless:true});
 let failed=0;
 try{
  for(const theme of themes)for(const width of sizes){
   const dir=path.join(root,browserName,theme,String(width));fs.mkdirSync(dir,{recursive:true});
   process.env.TOUCH='1';process.env.THEME=theme;process.env.PALHEX=theme==='black'?'#44b7a4':'#087b72';
   const {p,ctx}=await open(browser,width,844);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   const run={browser:browserName,theme,width,checks:[]};
   try{
    await p.evaluate(()=>window.__T.go('wallet'));
    const wallet=p.locator('.v68-wallet');await wallet.waitFor();
    assert.equal(await p.locator('.v68-wallet > .v1244-state').count(),1,'Crédito no es primera tarjeta');
    assert.equal(await p.locator('.v68-wallet > .v1244-cutpanel').count(),1);
    assert.equal(await p.locator('.v68-wallet > .v371-card-return').count(),1);
    assert.equal(await p.locator('.v68-wallet > .v1301-distribution').count(),1);
    await p.getByRole('heading',{name:'Estado del crédito',exact:true}).waitFor();
    assert.equal(await p.locator('.v68-wallet > .v266-gallery').count(),1,'El carrusel debe ser visible fuera del menú +');
    assert.ok(await visible(p.locator('.v68-wallet > .v266-gallery')),'El carrusel de tarjetas está oculto');
    assert.ok(await visible(p.locator('.v68-wallet-face.selected')),'La tarjeta seleccionada no está visible');
    assert.equal(await p.locator('.v68-wallet > .v266-gallery .v68-wallet-face').first().getAttribute('data-id'),GLOBAL,'Crédito Global debe ir primero');
    assert.equal(await p.locator('.wallet-mobile-tools').isVisible(),false,'El disclosure duplicado debe ocultarse');
    assert.equal(await p.locator('.wallet-mobile-summary > .v266-selected-balance').count(),1,'Falta resumen superior independiente');
    assert.equal(await p.locator('.wallet-mobile-summary > .v266-wallet-actions button').count(),4,'Faltan las operaciones reales arriba');
    assert.equal(await p.locator('.v1244-state .v266-selected-balance').count(),0,'El resumen sigue dentro de Estado del crédito');
    const topOrder=await p.evaluate(()=>[...document.querySelector('.v68-wallet').children].map(e=>e.classList[0]));
    assert.ok(topOrder.indexOf('wallet-mobile-summary')<topOrder.indexOf('v266-wallet-panel'),'Resumen no está sobre Estado del crédito');
    /* Portada sin cabecera universal, como Bancos móvil. */
    // El carrusel suspende temporalmente el snap para centrar la tarjeta
    // inicial. Esperar al segundo frame antes de verificar el estilo final.
    await p.waitForFunction(()=>{const e=document.querySelector('.v68-wallet-gallery');
      return !!e && getComputedStyle(e).scrollSnapType.includes('mandatory');
    },null,{timeout:9000});
    const top=await p.evaluate(()=>{
      const box=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}:null};
      const nav=document.querySelector('#app > .vive-mobile-top');
      const css=nav?getComputedStyle(nav):null;
      const rail=document.querySelector('.v68-wallet > .v266-gallery .v68-wallet-gallery');
      const faces=[...(rail?.querySelectorAll('.v68-wallet-face')||[])];
      return {head:box('.v68-wallet > .v266-wallet-header'),add:box('.v68-wallet > .v266-wallet-header .v266-wallet-add'),
        gallery:box('.v68-wallet > .v266-gallery'),rail:box('.v68-wallet > .v266-gallery .v68-wallet-gallery'),
        first:box('.v68-wallet-gallery > .v68-wallet-face:first-child'),
        second:box('.v68-wallet-gallery > .v68-wallet-face:nth-child(2)'),
        firstCard:box('.v68-wallet-gallery > .v68-wallet-face:first-child .v266-physical-card'),
        snap:rail&&getComputedStyle(rail).scrollSnapType,
        headerHidden:!nav||css.display==='none',faceCount:faces.length};
    });
    assert.equal(top.headerHidden,true,'Sigue visible el header vive el hoy en Wallet');
    assert.ok(top.head&&top.add&&top.gallery&&top.rail,'Falta encabezado, botón o carrusel');
    assert.ok(top.head.top<130,'Encabezado demasiado bajo: '+top.head.top);
    assert.ok(Math.abs(top.head.top-top.add.top)<20,'Mis tarjetas y + no están en la misma línea');
    assert.ok(top.gallery.left<=3&&top.gallery.right>=width-3,'El carrusel no llega a los bordes: '+JSON.stringify(top.gallery));
    assert.ok(top.rail.width>=width-3,'El carrusel está comprimido');
    assert.ok(top.first.width>=width*.89&&top.first.width<=width*.94,'Tarjeta no recupera el ancho casi completo: '+top.first.width);
    assert.ok(top.first.height>=185&&top.first.height<=252,'La tarjeta no recuperó altura: '+top.first.height);
    assert.ok(top.firstCard.height===top.first.height,'La tarjeta visual no ocupa la altura asignada');
    assert.ok(top.first.left<=18,'Primera tarjeta demasiado separada del borde: '+top.first.left);
    assert.ok(top.second.left<width-4,'No asoma la segunda tarjeta');
    assert.ok(top.second.left>=top.first.right+5,'Las tarjetas se superponen');
    assert.ok((top.snap||'').includes('mandatory'),'Falta scroll-snap obligatorio');
    run.checks.push({screen:'encabezado-carrusel',top});

    const gauge=await p.locator('.v1244-gauge b').innerText();assert.match(gauge,/^-?\d+(\.\d+)?%$/);
    const glass=await p.locator('.v1244-state').evaluate(el=>{const x=getComputedStyle(el);return x.backdropFilter||x.webkitBackdropFilter});
    assert.ok(glass.includes('blur(28px)'),'Cristal sin desenfoque');
    let g=await readGeometry(p);assertGeometry(g,theme+' '+width+' inicio',width);run.checks.push({screen:'estado',gauge,glass,geometry:g});
    await screenshot(p,dir,'01-estado-credito');
    /* Verificar desplazamiento nativo hasta la última tarjeta y retorno global.
       La selección y los puntos deben seguir sincronizados. */
    if(width===390&&theme==='light'){
      const rail=p.locator('.v68-wallet > .v266-gallery .v68-wallet-gallery');
      const lastId=await rail.locator('.v68-wallet-face').last().getAttribute('data-id');
      await rail.evaluate(el=>el.scrollTo({left:el.scrollWidth-el.clientWidth,behavior:'instant'}));
      await p.waitForFunction(id=>document.querySelector('.v68-wallet-face.selected')?.dataset.id===id,lastId,{timeout:10000});
      assert.equal(await p.locator('.v68-wallet-dots .active').getAttribute('data-id'),lastId,'Punto final desincronizado');
      await screenshot(p,dir,'01b-carrusel-ultima');
      await p.locator('.v68-wallet-dots button[data-id="'+GLOBAL+'"]').click();
      await p.waitForFunction(id=>document.querySelector('.v68-wallet-face.selected')?.dataset.id===id,GLOBAL,{timeout:10000});
      assert.equal(await p.locator('.v68-wallet-dots .active').getAttribute('data-id'),GLOBAL,'Punto global desincronizado');
      await screenshot(p,dir,'01c-carrusel-regreso');
    }

    /* La participación de consumo es distinta de la utilización del límite. */
    const shares=await p.locator('.v1301-share').allTextContents();
    const segments=await p.locator('.v1301-donut-segment').count();
    if(segments){
     assert.ok(shares.length>0,'Faltan porcentajes individuales de consumo');
     const total=shares.map(t=>parseFloat(t)).reduce((a,b)=>a+b,0);
     assert.ok(Math.abs(total-100)<=shares.length*.051,'Participación no suma 100%: '+total);
    }else assert.ok(await p.locator('.wallet-mobile-empty-consumption').count()||await p.locator('.v1301-distribution p').count(),'Falta estado de consumo sin datos');
    run.checks.push({screen:'consumo',shares,segments});
    /* Selección individual con carrusel restaurado, además de acceso por lista. */
    const row=p.locator('.wallet-mobile-select-card').first();
    assert.ok(await row.count()>0,'La lista no permite seleccionar tarjetas');
    const cardId=await row.getAttribute('data-id');await row.click();
    await p.waitForTimeout(250);
    assert.equal(await p.locator('.v68-wallet-face.selected').getAttribute('data-id'),cardId);
    await screenshot(p,dir,'02-tarjeta-individual');
    /* Las operaciones ahora están siempre visibles en el resumen superior. */
    assert.equal(await p.locator('.wallet-mobile-tools').isVisible(),false);
    assert.ok(await visible(p.locator('.v266-gallery')),'El carrusel desapareció');
    assert.equal(await p.locator('.wallet-mobile-summary .v266-wallet-actions button').count(),4);
    const back=p.locator('.v68-wallet-dots button[data-id="'+GLOBAL+'"]');await back.click();
    await p.waitForTimeout(250);
    assert.equal(await p.locator('.v68-wallet-face.selected').getAttribute('data-id'),GLOBAL);
    g=await readGeometry(p);assertGeometry(g,theme+' '+width+' regreso',width);
    /* Cortes: ambas monedas y sin fechas impresas en la tarjeta. */
    assert.equal(await p.locator('.v1244-pill').count(),2);
    assert.equal(await p.locator('.v1244-cutpanel .v1244-cuthead').count(),1);
    run.checks.push({screen:'cortes',values:await p.locator('.v1244-pill em').allTextContents()});
    await screenshot(p,dir,'03-beneficios-resumen');
    await p.locator('.v371-return-action').click();
    await p.getByRole('heading',{name:'Beneficios y retorno',exact:true}).waitFor();
    assert.equal(await p.locator('.wallet-benefits-mobile').count(),1);
    assert.ok(await p.getByRole('button',{name:'Registrar beneficio',exact:true}).count()>0);
    assert.ok(await p.getByRole('button',{name:'Anualidad y seguros',exact:true}).count()>0);
    g=await readGeometry(p);assertGeometry(g,theme+' '+width+' beneficios',width);
    await screenshot(p,dir,'04-beneficios-detalle');
    /* Probar navegación entre pantallas y acceso a formularios, sin guardar nada. */
    if(width===390){
     const openForm=async(label,selector)=>{
      await p.getByRole('button',{name:label,exact:true}).click();
      const picker=p.locator('.v789-product-backdrop');
      if(await picker.isVisible().catch(()=>false)){
       await picker.locator('.v789-picker-row').first().click();
       await picker.locator('.v789-picker-confirm').click();
      }
      await p.locator(selector).waitFor({state:'visible',timeout:10000});
      await p.locator('#modal-root [data-act="closeModal"]').first().click();
     };
     await openForm('Registrar beneficio','#v144CashbackForm');
     await openForm('Anualidad y seguros','#annualFeeForm');
    }
    await p.getByRole('button',{name:'Volver a Wallet'}).click();
    await p.getByRole('heading',{name:'Estado del crédito',exact:true}).waitFor();
    await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await p.waitForTimeout(250);
    const bottom=await readGeometry(p);
    assert.ok(bottom.scrollWidth<=width+2,'Desborde al final de Wallet');
    assert.deepEqual(errors,[],'Errores JS');
    run.checks.push({screen:'scroll-final',scrollWidth:bottom.scrollWidth,navigation:bottom.navigation});
    console.log('OK fidelity',browserName,theme,width);
   }catch(e){
    failed++;run.error=String(e.stack||e);
    await p.screenshot({path:path.join(dir,'fallo.png'),fullPage:true}).catch(()=>{});
    console.error('FAIL fidelity',browserName,theme,width,e.message);
   }finally{
    results.push(run);fs.writeFileSync(path.join(dir,'resultado.json'),JSON.stringify(run,null,2));await ctx.close();
   }
  }
 }finally{await browser.close();fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'resumen-'+browserName+'.json'),JSON.stringify({failures:failed,results},null,2))}
 if(failed)process.exitCode=1;
})();
