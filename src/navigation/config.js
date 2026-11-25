/* VIVE · Navegación universal — parámetros centrales (único archivo de configuración). Valores iniciales según la especificación. */
window.ViveNavConfig=Object.freeze({
 edgeZone:28,            // px: zona de activación en cada lateral (24–32)
 intentDistance:12,      // px mínimos para decidir la intención
 horizontalDominance:1.5,// el desplazamiento horizontal debe superar 1.5× el vertical
 confirmRatio:.28,       // fracción del ancho para confirmar
 confirmVelocity:.65,    // px/ms: confirmación alternativa por velocidad…
 minFlingDistance:48,    // …con desplazamiento mínimo
 commitMs:260,           // 220–300 ms
 cancelMs:300,           // retorno elástico
 maxMobileWidth:790,     // sólo móvil/táctil
 sensitivity:{low:{edgeZone:20,confirmRatio:.38,confirmVelocity:.85},normal:{},high:{edgeZone:34,confirmRatio:.2,confirmVelocity:.5}},
 storageKey:'vive.nav.prefs.v1',
 defaults:{enabled:true,sides:'both',sensitivity:'normal',animations:true,reducedMotion:false}
});
