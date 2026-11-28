/* Quebec sales-tax math shared by build.js and the tests (TPS 5 %, TVQ 9,975 %).
 * Reverse rule (also used by assets/js/calculator.js): amount before tax = total ÷ 1.14975,
 * rounded to the cent; TPS and TVQ are computed on that rounded amount, each rounded to the cent. */
"use strict";
const TPS = 0.05, TVQ = 0.09975, COMBINED = 1.14975;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function addTax(x) { const g = r2(x * TPS), q = r2(x * TVQ); return { base: x, g, q, total: r2(x + g + q) }; }
function removeTax(t) { const base = r2(t / COMBINED), g = r2(base * TPS), q = r2(base * TVQ); return { total: t, base, g, q }; }
module.exports = { TPS, TVQ, COMBINED, r2, addTax, removeTax };
