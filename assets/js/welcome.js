/* Welcome tax (droits de mutation) calculator — 2026 brackets come from build.js (window.WT). */
(function () {
  "use strict";
  var root = document.querySelector("[data-wt]");
  if (!root || !window.WT) return;
  var lang = (document.documentElement.lang || "fr").slice(0, 2) === "en" ? "en-CA" : "fr-CA";
  var fmt = new Intl.NumberFormat(lang, { style: "currency", currency: "CAD", minimumFractionDigits: 2 });
  var price = root.querySelector("[data-wt-price]");
  var city = root.querySelector("[data-wt-city]");
  var first = root.querySelector("[data-wt-first]");
  var out = { tax: root.querySelector('[data-wt-out="tax"]'), credit: root.querySelector('[data-wt-out="credit"]'), net: root.querySelector('[data-wt-out="net"]') };

  function parse(v) {
    var s = String(v || "").replace(/[\s  $]/g, "");
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function tax(base, table) {
    var prev = 0, t = 0;
    for (var i = 0; i < table.length; i++) {
      var cap = table[i][0] === null ? Infinity : table[i][0];
      if (base > prev) t += (Math.min(base, cap) - prev) * table[i][1];
      prev = cap;
    }
    return Math.round(t * 100) / 100;
  }
  function credit(t, p) {
    if (p >= 1000000) return 0;
    return Math.round((Math.min(t, 5000) + Math.max(0, Math.min(t - 5000, 3500)) * 0.25) * 100) / 100;
  }
  function run() {
    var p = parse(price.value);
    var t = tax(p, window.WT[city.value] || window.WT.standard);
    var c = first.checked ? credit(t, p) : 0;
    out.tax.textContent = fmt.format(t);
    out.credit.textContent = fmt.format(c);
    out.net.textContent = fmt.format(Math.max(0, t - c));
  }
  price.addEventListener("input", run);
  city.addEventListener("change", run);
  first.addEventListener("change", run);
  run();
})();
