/* Calcul pourboire Québec — tip on the pre-tax amount, plus GST/QST and split. Vanilla JS, no deps. */
(function () {
  "use strict";
  var root = document.querySelector("[data-tip]");
  if (!root) return;
  var fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function parse(str) {
    var m = String(str || "").replace(/[^0-9.,]/g, "");
    if (!m) return 0;
    var idx = Math.max(m.lastIndexOf("."), m.lastIndexOf(","));
    var val = idx < 0 ? parseFloat(m) : parseFloat((m.slice(0, idx).replace(/[.,]/g, "") || "0") + "." + (m.slice(idx + 1).replace(/[.,]/g, "") || "0"));
    return isFinite(val) && val > 0 ? val : 0;
  }
  var input = root.querySelector("[data-tip-input]");
  var people = root.querySelector("[data-tip-people]");
  var rateBtns = root.querySelectorAll("[data-tip-rate]");
  var out = function (k) { return root.querySelector('[data-tip-out="' + k + '"]'); };
  var rate = 0.15;

  function compute() {
    var base = parse(input.value);
    var n = Math.max(1, Math.round(parse(people.value) || 1));
    var g = r2(base * 0.05), q = r2(base * 0.09975);
    var withTax = r2(base + g + q);
    var tip = r2(base * rate);
    var total = r2(withTax + tip);
    out("tps").textContent = fmt.format(g);
    out("tvq").textContent = fmt.format(q);
    out("withtax").textContent = fmt.format(withTax);
    out("tip").textContent = fmt.format(tip);
    out("total").textContent = fmt.format(total);
    out("each").textContent = fmt.format(r2(total / n));
  }
  function setRate(r) {
    rate = r;
    for (var i = 0; i < rateBtns.length; i++) rateBtns[i].setAttribute("aria-pressed", String(parseFloat(rateBtns[i].getAttribute("data-tip-rate")) === r));
    compute();
  }
  for (var i = 0; i < rateBtns.length; i++) rateBtns[i].addEventListener("click", function () { setRate(parseFloat(this.getAttribute("data-tip-rate"))); });
  input.addEventListener("input", compute);
  people.addEventListener("input", compute);
  var clearBtn = root.querySelector("[data-tip-clear]");
  if (clearBtn) clearBtn.addEventListener("click", function () { input.value = ""; people.value = "1"; compute(); input.focus(); });
  compute();
})();
