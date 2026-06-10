/* Calcul Salaire Net Québec — net-pay estimator (vanilla JS, no deps)
 *
 * Estimates take-home pay for a salaried Quebec resident using 2026 parameters:
 * federal + Quebec income tax, QPP/RRQ (incl. QPP2), EI (Quebec rate) and QPIP/RQAP.
 * Consumer-grade estimate: single person, employment income only, basic credits.
 */
(function () {
  "use strict";

  // ---- 2026 parameters (sources documented in README) -------------------
  var R = {
    qpp: { exemption: 3500, ympe: 74600, yampe: 85000, base: 0.0530, firstAdd: 0.0100, secondAdd: 0.0400 },
    ei: { mie: 68900, rate: 0.0130 },
    qpip: { mie: 103000, rate: 0.00430 },
    federal: {
      brackets: [[58523, 0.14], [117045, 0.205], [181440, 0.26], [258482, 0.29], [Infinity, 0.33]],
      bpaMax: 16452, bpaMin: 14829, bpaPhaseStart: 181440, bpaPhaseEnd: 258482,
      canadaEmployment: 1501, lowRate: 0.14, abatement: 0.165
    },
    quebec: {
      brackets: [[54345, 0.14], [108680, 0.19], [132245, 0.24], [Infinity, 0.2575]],
      bpa: 18952, lowRate: 0.14, workerDedRate: 0.06, workerDedMax: 1260
    }
  };

  var I18N = {
    fr: {
      net: "Salaire net", gross: "Salaire brut", fed: "Impôt fédéral", qc: "Impôt du Québec",
      qpp: "RRQ (Régime de rentes)", ei: "Assurance-emploi", qpip: "RQAP", ded: "Retenues totales",
      rate: "Taux d'imposition effectif", copyIdle: "Copier le résultat", copyDone: "Copié ✓",
      copyErr: "Copie impossible", perMonth: "par mois", perBiweek: "aux 2 semaines",
      perWeek: "par semaine", perHour: "par heure", approx: "≈"
    },
    en: {
      net: "Net pay", gross: "Gross pay", fed: "Federal tax", qc: "Quebec tax",
      qpp: "QPP (pension plan)", ei: "Employment Insurance", qpip: "QPIP", ded: "Total deductions",
      rate: "Effective tax rate", copyIdle: "Copy result", copyDone: "Copied ✓",
      copyErr: "Copy failed", perMonth: "per month", perBiweek: "every 2 weeks",
      perWeek: "per week", perHour: "per hour", approx: "≈"
    }
  };

  function parseAmount(str) {
    if (str == null) return 0;
    var m = String(str).replace(/[^0-9.,]/g, "");
    if (!m) return 0;
    var idx = Math.max(m.lastIndexOf("."), m.lastIndexOf(","));
    var val;
    if (idx < 0) val = parseFloat(m);
    else {
      var intDigits = m.slice(0, idx).replace(/[.,]/g, "");
      var frac = m.slice(idx + 1).replace(/[.,]/g, "");
      val = parseFloat((intDigits || "0") + "." + (frac || "0"));
    }
    if (!isFinite(val) || val < 0) return 0;
    return val;
  }

  function bracketTax(income, brackets) {
    var tax = 0, lower = 0;
    for (var i = 0; i < brackets.length; i++) {
      var cap = brackets[i][0], rate = brackets[i][1];
      if (income > cap) { tax += (cap - lower) * rate; lower = cap; }
      else { tax += (income - lower) * rate; break; }
    }
    return tax < 0 ? 0 : tax;
  }

  function federalBPA(income) {
    var f = R.federal;
    if (income <= f.bpaPhaseStart) return f.bpaMax;
    if (income >= f.bpaPhaseEnd) return f.bpaMin;
    var frac = (income - f.bpaPhaseStart) / (f.bpaPhaseEnd - f.bpaPhaseStart);
    return f.bpaMax - (f.bpaMax - f.bpaMin) * frac;
  }

  // Annual gross -> full breakdown (all annual amounts)
  function computeNet(gross) {
    gross = Math.max(0, gross);

    // QPP / RRQ
    var pensionable = Math.max(0, Math.min(gross, R.qpp.ympe) - R.qpp.exemption);
    var qppBase = pensionable * R.qpp.base;
    var qppFirst = pensionable * R.qpp.firstAdd;
    var qpp2 = Math.max(0, Math.min(gross, R.qpp.yampe) - R.qpp.ympe) * R.qpp.secondAdd;
    var qpp = qppBase + qppFirst + qpp2;
    var qppEnhanced = qppFirst + qpp2; // deductible from taxable income

    // EI (Quebec rate) and QPIP / RQAP
    var ei = Math.min(gross, R.ei.mie) * R.ei.rate;
    var qpip = Math.min(gross, R.qpip.mie) * R.qpip.rate;

    // Federal income tax
    var fedTaxable = Math.max(0, gross - qppEnhanced);
    var fedTax = bracketTax(fedTaxable, R.federal.brackets);
    var fedCredits = (federalBPA(fedTaxable) + qppBase + ei + qpip + R.federal.canadaEmployment) * R.federal.lowRate;
    var basicFed = Math.max(0, fedTax - fedCredits);
    var fedNet = basicFed * (1 - R.federal.abatement); // Quebec abatement

    // Quebec income tax
    var workerDed = Math.min(gross * R.quebec.workerDedRate, R.quebec.workerDedMax);
    var qcTaxable = Math.max(0, gross - qppEnhanced - workerDed);
    var qcTax = bracketTax(qcTaxable, R.quebec.brackets);
    var qcCredits = (R.quebec.bpa + qppBase + ei + qpip) * R.quebec.lowRate;
    var qcNet = Math.max(0, qcTax - qcCredits);

    var deductions = qpp + ei + qpip + fedNet + qcNet;
    var net = gross - deductions;
    return {
      gross: gross, fed: fedNet, qc: qcNet, qpp: qpp, ei: ei, qpip: qpip,
      deductions: deductions, net: net, rate: gross > 0 ? deductions / gross : 0
    };
  }

  var FREQ = {
    year: { mult: 1, perDiv: 12, per: "perMonth" },
    month: { mult: 12, perDiv: 12, per: "perMonth" },
    biweek: { mult: 26, perDiv: 26, per: "perBiweek" },
    week: { mult: 52, perDiv: 52, per: "perWeek" },
    hour: { mult: null, perDiv: null, per: "perHour" }
  };

  function initSalary(root) {
    var lang = (document.documentElement.lang || "fr").slice(0, 2);
    if (!I18N[lang]) lang = "fr";
    var t = I18N[lang];
    var locale = lang === "en" ? "en-CA" : "fr-CA";
    var money = new Intl.NumberFormat(locale, { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var pct = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    function fmt(n) { return money.format(n); }

    var input = root.querySelector("[data-sal-input]");
    var freqSel = root.querySelector("[data-sal-freq]");
    var hoursWrap = root.querySelector("[data-sal-hourswrap]");
    var hoursInput = root.querySelector("[data-sal-hours]");
    var out = {};
    ["net", "netperiod", "gross", "fed", "qc", "qpp", "ei", "qpip", "deductions", "rate"].forEach(function (k) {
      out[k] = root.querySelector('[data-sal-out="' + k + '"]');
    });
    var copyBtn = root.querySelector("[data-sal-copy]");
    var clearBtn = root.querySelector("[data-sal-clear]");

    function annualGross() {
      var v = parseAmount(input.value);
      var f = freqSel ? freqSel.value : "year";
      if (f === "hour") {
        var h = hoursInput ? parseAmount(hoursInput.value) : 0;
        return v * h * 52;
      }
      return v * (FREQ[f] ? FREQ[f].mult : 1);
    }

    function periodInfo() {
      var f = freqSel ? freqSel.value : "year";
      if (f === "hour") {
        var h = hoursInput ? parseAmount(hoursInput.value) : 0;
        return { div: h * 52, per: t.perHour };
      }
      var cfg = FREQ[f] || FREQ.year;
      return { div: cfg.perDiv, per: t[cfg.per] };
    }

    function set(el, val) { if (el) el.textContent = val; }

    function compute() {
      var gross = annualGross();
      var r = computeNet(gross);
      set(out.gross, fmt(r.gross));
      set(out.fed, "−" + fmt(r.fed));
      set(out.qc, "−" + fmt(r.qc));
      set(out.qpp, "−" + fmt(r.qpp));
      set(out.ei, "−" + fmt(r.ei));
      set(out.qpip, "−" + fmt(r.qpip));
      set(out.deductions, "−" + fmt(r.deductions));
      set(out.net, fmt(r.net));
      set(out.rate, pct.format(r.rate));
      var pi = periodInfo();
      if (out.netperiod) {
        out.netperiod.textContent = (pi.div && isFinite(pi.div) && pi.div > 0)
          ? t.approx + " " + fmt(r.net / pi.div) + " " + pi.per
          : "";
      }
      root._summary =
        t.gross + ": " + fmt(r.gross) + " | " +
        t.fed + ": " + fmt(r.fed) + " | " + t.qc + ": " + fmt(r.qc) + " | " +
        t.qpp + ": " + fmt(r.qpp) + " | " + t.ei + ": " + fmt(r.ei) + " | " + t.qpip + ": " + fmt(r.qpip) + " | " +
        t.net + ": " + fmt(r.net) + " (" + pct.format(r.rate) + ")";
    }

    function syncHours() {
      if (!hoursWrap) return;
      var isHour = freqSel && freqSel.value === "hour";
      hoursWrap.hidden = !isHour;
    }

    input.addEventListener("input", compute);
    if (freqSel) freqSel.addEventListener("change", function () { syncHours(); compute(); });
    if (hoursInput) hoursInput.addEventListener("input", compute);
    if (clearBtn) clearBtn.addEventListener("click", function () { input.value = ""; compute(); input.focus(); });

    if (copyBtn) {
      var resetLbl;
      copyBtn.addEventListener("click", function () {
        var text = root._summary || "";
        var done = function (ok) {
          clearTimeout(resetLbl);
          copyBtn.textContent = ok ? t.copyDone : t.copyErr;
          copyBtn.classList.toggle("copied", ok);
          resetLbl = setTimeout(function () { copyBtn.textContent = t.copyIdle; copyBtn.classList.remove("copied"); }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else { done(false); }
      });
    }

    syncHours();
    compute();
  }

  function boot() {
    var roots = document.querySelectorAll("[data-salary]");
    for (var i = 0; i < roots.length; i++) initSalary(roots[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
