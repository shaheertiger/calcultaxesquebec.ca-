#!/usr/bin/env node
/* Reverse-tax unit test: total ÷ 1.14975, TPS 5 %, TVQ 9.975 %, rounded to the cent.
 * Checks the build's math (scripts/tax-math.js) AND the live calculator (assets/js/calculator.js,
 * run in a minimal fake DOM) against hand-checked expected values.
 * Run: node scripts/reverse-tax.test.js   (also run by build.js; a failure fails the build) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { removeTax } = require("./tax-math.js");

// [total taxes incluses, avant taxes, TPS, TVQ]: worked out by hand
const CASES = [
  [114.98, 100.0, 5.0, 9.98],  // 114.98 / 1.14975 = 100.0043  -> TPS 5.00, TVQ 9.975 -> 9.98
  [50, 43.49, 2.17, 4.34],     // 43.4877 -> 43.49; 2.1745 -> 2.17; 4.3381 -> 4.34
  [100, 86.98, 4.35, 8.68],    // 86.9754 -> 86.98; 4.349 -> 4.35; 8.6763 -> 8.68
  [229.95, 200.0, 10.0, 19.95],
  [0.06, 0.05, 0.0, 0.0]       // 0.0522 -> 0.05; TPS 0.0025 -> 0.00; TVQ 0.0050 -> 0.00 (rounding edge case)
];

/* Run calculator.js against a fake calculator card in remove mode and read the displayed values. */
function calculatorJs(total) {
  const el = (attrs = {}) => ({
    textContent: "", value: "", attrs, listeners: {},
    getAttribute(k) { return this.attrs[k] ?? null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, f) { this.listeners[t] = f; },
    focus() {}, classList: { toggle() {}, remove() {} }
  });
  const nodes = {
    "[data-input]": el(), "[data-out=row1]": el(), "[data-out=tps]": el(), "[data-out=tvq]": el(), "[data-out=big]": el(),
    "[data-label=input]": el(), "[data-label=row1]": el(), "[data-label=big]": el(), "[data-copy]": null, "[data-clear]": null
  };
  nodes["[data-input]"].value = String(total).replace(".", ",");
  const root = el({ "data-default-mode": "remove" });
  root.querySelector = (s) => nodes[s];
  root.querySelectorAll = () => [];
  const document = { readyState: "complete", documentElement: { lang: "fr-CA" }, querySelectorAll: () => [root] };
  const src = fs.readFileSync(path.join(__dirname, "..", "assets", "js", "calculator.js"), "utf8");
  vm.runInNewContext(src, { document, navigator: {}, window: {}, Intl, Math, Number, String, parseFloat, isFinite, setTimeout, clearTimeout });
  const num = (s) => Number(s.replace(/[^0-9,]/g, "").replace(",", "."));
  return { base: num(nodes["[data-out=big]"].textContent), g: num(nodes["[data-out=tps]"].textContent), q: num(nodes["[data-out=tvq]"].textContent) };
}

const results = [];
for (const [total, base, g, q] of CASES) {
  const b = removeTax(total);
  const j = calculatorJs(total);
  const ok = b.base === base && b.g === g && b.q === q && j.base === base && j.g === g && j.q === q;
  results.push({ ok, line: `${ok ? "PASS" : "FAIL"}  ${total.toFixed(2)} $ -> avant taxes ${base.toFixed(2)}, TPS ${g.toFixed(2)}, TVQ ${q.toFixed(2)}` +
    (ok ? "" : `   (build: ${b.base}/${b.g}/${b.q}, calculator.js: ${j.base}/${j.g}/${j.q})`) });
}

module.exports = results;
if (require.main === module) {
  results.forEach((r) => console.log(r.line));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} reverse-tax cases passed`);
  process.exit(failed ? 1 : 0);
}
