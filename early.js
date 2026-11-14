/* v866-direct-component-assembly */
/* V866: Montaje síncrono de vistas existentes. No oculta contenido ni inserta overlays. */
window.__v866Runners=Object.create(null);
window.__v866Compose=function(){
 const order=['v785','v790','v794','financial','v797','v798','v799','f834','f835','f836','f837','v844','v849','v854','v855','v857','v861','v864','v865'];
 for(let pass=0;pass<2;pass++)for(const name of order){
  const fn=window.__v866Runners[name];
  if(typeof fn==='function')try{fn()}catch(err){console.error('[V866] Componente '+name,err)}
 }
};

/* v386-early-submit-guard */
document.addEventListener('submit',function(e){if(e.target?.id==='recurringForm'&&typeof window.v386ValidateRecurringForm==='function')window.v386ValidateRecurringForm(e);},true);

/* vive-feature-flag */
window.VIVE_ENABLED=window.VIVE_ENABLED!==false;
