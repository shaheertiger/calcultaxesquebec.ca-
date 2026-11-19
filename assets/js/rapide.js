/* Méthode rapide TPS/TVQ — remittance estimator for a business with a permanent establishment
 * in Quebec, on taxable sales made in Quebec (vanilla JS, no deps).
 *
 * Rules (Revenu Québec, "Méthode rapide de calcul des montants de la TPS et de la TVQ à remettre",
 * and CRA guide RC4058):
 *  - GST remittance = GST-included sales × 1.8 % (goods bought for resale) or 3.6 % (services).
 *  - QST remittance = QST-included sales × 3.4 % or 6.6 %. The QST base includes QST only, not GST.
 *  - 1 % credit on the first 30 000 $ (GST-included) and 31 421 $ (QST-included) of eligible sales
 *    in each fiscal year; unused room is not carried forward.
 * Official example (cleaning business, services): 20 000 $ of sales in the first quarter
 * -> GST 546,00 $, QST 1 231,72 $. Checked by build.js at build time.
 */
(function () {
  "use strict";

  var R = {
    gst: 0.05,
    qst: 0.09975,
    rates: { services: { gst: 0.036, qst: 0.066 }, goods: { gst: 0.018, qst: 0.034 } },
    credit: 0.01,
    creditCap: { gst: 30000, qst: 31421 },
    threshold: { gst: 400000, qst: 418952 }
  };

  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /* sales: taxable sales in Quebec for the period, before tax.
   * type: "services" | "goods". prior: sales before tax already reported this fiscal year.
   * expenses (optional): taxable expenses before tax, to compare with the regular method. */
  function compute(sales, type, prior, expenses) {
    var rt = R.rates[type] || R.rates.services;
    sales = Math.max(0, sales || 0); prior = Math.max(0, prior || 0); expenses = Math.max(0, expenses || 0);
    var gstCollected = r2(sales * R.gst), qstCollected = r2(sales * R.qst);
    var gstBase = r2(sales + gstCollected), qstBase = r2(sales + qstCollected);
    var gstRoom = Math.max(0, R.creditCap.gst - r2(prior * (1 + R.gst)));
    var qstRoom = Math.max(0, R.creditCap.qst - r2(prior * (1 + R.qst)));
    var gstCredit = r2(Math.min(gstBase, gstRoom) * R.credit);
    var qstCredit = r2(Math.min(qstBase, qstRoom) * R.credit);
    var gstRemit = Math.max(0, r2(r2(gstBase * rt.gst) - gstCredit));
    var qstRemit = Math.max(0, r2(r2(qstBase * rt.qst) - qstCredit));
    var regGst = r2(gstCollected - r2(expenses * R.gst)), regQst = r2(qstCollected - r2(expenses * R.qst));
    return {
      gstCollected: gstCollected, qstCollected: qstCollected,
      gstBase: gstBase, qstBase: qstBase,
      gstCredit: gstCredit, qstCredit: qstCredit,
      gstRemit: gstRemit, qstRemit: qstRemit,
      kept: r2(gstCollected + qstCollected - gstRemit - qstRemit),
      regular: r2(regGst + regQst),
      quick: r2(gstRemit + qstRemit)
    };
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { compute: compute, R: R }; return; }

  var root = document.querySelector("[data-qm]");
  if (!root) return;
  var fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function parse(v) {
    var m = String(v || "").replace(/[^0-9.,]/g, "");
    if (!m) return 0;
    var idx = Math.max(m.lastIndexOf("."), m.lastIndexOf(","));
    var dec = idx >= 0 && m.length - idx - 1 <= 2;
    var val = dec ? parseFloat((m.slice(0, idx).replace(/[.,]/g, "") || "0") + "." + m.slice(idx + 1)) : parseFloat(m.replace(/[.,]/g, ""));
    return isFinite(val) && val > 0 ? val : 0;
  }
  var el = function (k) { return root.querySelector('[data-qm="' + k + '"]') || root.querySelector('[data-qm-out="' + k + '"]'); };
  var inputs = ["sales", "type", "prior", "expenses"].map(el);
  function run() {
    var x = compute(parse(el("sales").value), el("type").value, parse(el("prior").value), parse(el("expenses").value));
    ["gstCollected", "qstCollected", "gstCredit", "qstCredit", "gstRemit", "qstRemit", "kept", "quick", "regular"].forEach(function (k) {
      var o = root.querySelector('[data-qm-out="' + k + '"]'); if (o) o.textContent = fmt.format(x[k]);
    });
    var cmp = root.querySelector('[data-qm-out="compare"]');
    if (cmp) {
      var hasExp = parse(el("expenses").value) > 0;
      cmp.parentNode.hidden = !hasExp;
      var reg = root.querySelector('[data-qm-out="regular"]');
      if (reg) reg.parentNode.hidden = !hasExp;
      if (hasExp) {
        var d = r2(x.regular - x.quick);
        cmp.textContent = d > 0 ? "La méthode rapide vous fait remettre " + fmt.format(d) + " de moins."
          : d < 0 ? "La méthode régulière vous fait remettre " + fmt.format(-d) + " de moins."
          : "Les deux méthodes donnent le même montant.";
      }
    }
  }
  inputs.forEach(function (i) { if (i) { i.addEventListener("input", run); i.addEventListener("change", run); } });
  run();
})();
