'use strict';
// Regression: the dedicated "Evolución y acumulado" recurring-income view stays removed.
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../../src/app.js'),'utf8');
const section=app.split('/* V55 ·')[1]?.split('/* vive el hoy V56')[0];
test('ingresos recurrentes conserva solo las tres pestañas vigentes',()=>{
 assert.ok(section);
 for(const label of ['Visión general','Trabajo formal','Trabajo informal · Joseo'])assert.ok(section.includes(label));
 assert.ok(!section.includes('Evolución y acumulado'));
 assert.ok(!section.includes("['evolution'"));
 assert.ok(!section.includes('function evolution('));
 assert.ok(!section.includes(':evolution(m)'));
 assert.ok(section.includes("['general','formal','informal'].includes(ui.v55RecurringTab)"));
});
test('se mantienen funciones y gráficos compartidos',()=>{
 for(const key of ['function general(m)','function formal(m)','function informal(m)','stackChart(trend)','function lineChart('])assert.ok(section.includes(key));
});
