# Comparación de los cuatro flujos con la propuesta visual

Leyenda: **Igual** = coincide con la imagen · **Adaptado** = difiere con motivo · **Pendiente** = sin resolver.

## Reglas generales
| Elemento | Estado | Nota |
|---|---|---|
| Estructura de una columna, cabecera con flecha circular, título centrado y X | Igual | Móvil: pantalla completa. Tableta y escritorio: la misma pantalla en una columna centrada de 520 px. |
| Indicador de progreso de cuatro segmentos | Igual | Segmentos completados con el acento. |
| Color de acento | Adaptado | La imagen usa ciruela; la app toma el acento elegido en Personalización (la ciruela es una de las opciones). Sin degradados. |
| Modo Claro y Black | Igual | Superficies limpias en Claro y oscuras en Black. |
| Fondo web | Igual | Fondo neutro suave detrás de la columna, sin elementos decorativos. |
| Selectores | Igual | Cuenta, institución, moneda y frecuencia usan los mismos componentes en todos los anchos. |

## Flujo 1 · Ingreso recurrente
| Pantalla | Estado | Nota |
|---|---|---|
| 1 Datos | Igual | Modalidad, nombre, importe base, importe bruto, moneda y «Vincular institución». |
| 2 Descuentos | Igual | Chip, AFP/SFS/ISR «Estimado», «Otros descuentos» con categoría, «Deducciones de empresa» con «+ Añadir deducción»; en informal solo se muestra la nota. |
| 3 Calendario y cuenta | Adaptado | La cuenta destino viene preseleccionada con la primera cuenta que no es efectivo (como en la imagen); el selector de fecha usa el calendario nativo del dispositivo, mostrado como dd/mm/aaaa. |
| 4 Confirmación | Igual | «Según configuración», «Se calcula con tus reglas», «Primer cobro: dd/mm/aaaa», «Los recibos anteriores no cambian». |

## Flujo 2 · Registrar cobro
| Pantalla | Estado | Nota |
|---|---|---|
| 1 Datos del cobro | Igual | Etiqueta dentro de cada caja, resumen en dos columnas, cuenta con logo y moneda. |
| 2 Confirmar cobro | Igual | Etiqueta, importe grande, tarjeta de datos, «Así quedará este cobro» y «Editar datos». |

## Flujo 3 · Ampliar catálogo
| Estado | Estado | Nota |
|---|---|---|
| A Categoría | Igual | Botón «Crear categoría». |
| B Subcategoría | Igual | Botón «Añadir subcategoría». Las etiquetas externas de la maqueta no se implementan. |

## Flujo 4 · Registrar salario
| Pantalla | Estado | Nota |
|---|---|---|
| 1 Datos del cobro | Igual | Mismos componentes que el flujo 2, con etiquetas encima de cada caja y encabezado en mayúsculas. |
| 2 Revisión final | Igual | «Después del registro», texto de acreditación y «Editar datos» subrayado. |

## Resultado por ancho
Las siete pantallas se verificaron sin scroll interno, superposiciones ni cortes a 390×844, 430×932, 768×1024, 1280×800 y 1440×900.

## Pruebas
```
node tests/flujos-ingresos.js
W=390 H=844 node tests/pantallas-sin-scroll.js    # repetir con 430x932, 768x1024, 1280x800, 1440x900
node tests/smoke.js && node tests/csp.js && node tests/xss.js && node tests/rendimiento.js
```
