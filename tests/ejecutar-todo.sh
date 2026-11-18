#!/usr/bin/env bash
# Ejecuta todas las pruebas automáticas y resume el resultado.  Uso: bash tests/ejecutar-todo.sh [salida.txt]
# Variables: AXE=/ruta/axe.min.js (activa la prueba de accesibilidad)
cd "$(dirname "$0")/.." || exit 1
OUT=${1:-/tmp/resultado-pruebas.txt}; : > "$OUT"; FALLOS=0
correr() { local nombre="$1"; shift; local t0=$(date +%s); if timeout 900 "$@" > /tmp/prueba.log 2>&1; then r=APROBADA; else r=FALLIDA; FALLOS=$((FALLOS+1)); fi; printf '%s | %s | %ss | %s\n' "$r" "$nombre" "$(( $(date +%s)-t0 ))" "$(tail -1 /tmp/prueba.log | cut -c1-110)" | tee -a "$OUT"; }
for f in ingest link shortcuts; do correr "Edge Function $f (unitaria)" node --test supabase/tests/$f.test.mjs; done
correr "Reglas financieras (unitarias)" node --test tests/logica/reglas.test.js tests/logica/red.test.js
correr "Paridad app/biblioteca, recorridos de lógica" node tests/logica/run.js
for T in light black; do
  export THEME=$T
  for s in smoke csp xss adversarial remediacion-03 experiencia-04 rendimiento vive-score vive-score-reglas; do correr "$s [$T]" node tests/$s.js; done
  for d in "390 844" "430 932" "768 1024" "1440 900"; do set -- $d; W=$1 H=$2 correr "pantallas-sin-scroll $1x$2 [$T]" node tests/pantallas-sin-scroll.js; done
  [ -n "$AXE" ] && correr "auditoria-recorrido + axe [$T]" env AXE="$AXE" node tests/auditoria-recorrido.js /tmp/recorrido-$T.json
done
unset THEME
correr "flujos-ingresos (claro, Black y escritorio)" node tests/flujos-ingresos.js
correr "editar-movimientos" node tests/editar-movimientos.js
echo "FALLOS=$FALLOS" | tee -a "$OUT"; exit $FALLOS
