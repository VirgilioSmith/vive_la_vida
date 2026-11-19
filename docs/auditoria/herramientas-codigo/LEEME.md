Scripts usados en AUDITORIA-06 (solo lectura; no modifican el proyecto).
Requieren eslint y acorn (`/opt/node-tools/node_modules`) y trabajan sobre una copia en `/tmp/lint/app.js`:

    mkdir -p /tmp/lint && cp src/app.js /tmp/lint/app.js && cp docs/auditoria/herramientas-codigo/* /tmp/lint/
    cd /tmp/lint && /opt/node-tools/node_modules/.bin/eslint -c eslint.config.js -f json app.js > lint.json
    node sizes.js   # variables y funciones sin uso, con su tamaño
    node more.js    # funciones sobrescritas, acciones sin disparador, capas V###
    node cssscan.js # reglas CSS duplicadas / con clases inexistentes / selectores repetidos
