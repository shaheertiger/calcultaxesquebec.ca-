/* Calcul Taxes Québec — calculator engine (vanilla JS, no deps) */
(function () {
  "use strict";

  var GST = 0.05;        // TPS
  var QST = 0.09975;     // TVQ
  var COMBINED = 1.14975;

  var I18N = {
    fr: {
      sub: "Montant avant taxes",
      tps: "TPS",
      tvq: "TVQ",
      total: "Total",
      copyIdle: "Copier le résultat",
      copyDone: "Copié ✓",
      copyErr: "Copie impossible",
      inLabelAdd: "Montant avant taxes",
      inLabelRemove: "Montant avec taxes incluses",
      row1Add: "Sous-total",
      row1Remove: "Total avec taxes incluses",
      bigAdd: "Total avec taxes",
      bigRemove: "Montant avant taxes"
    },
    en: {
      sub: "Amount before tax",
      tps: "GST",
      tvq: "QST",
      total: "Total",
      copyIdle: "Copy result",
      copyDone: "Copied ✓",
      copyErr: "Copy failed",
      inLabelAdd: "Amount before tax",
      inLabelRemove: "Total with tax included",
      row1Add: "Subtotal",
      row1Remove: "Total with tax",
      bigAdd: "Total with tax",
      bigRemove: "Amount before tax"
    }
  };

  function parseAmount(str) {
    if (str == null) return 0;
    var m = String(str).replace(/[^0-9.,]/g, "");
    if (!m) return 0;
    var idx = Math.max(m.lastIndexOf("."), m.lastIndexOf(","));
    var val;
    if (idx < 0) {
      val = parseFloat(m);
    } else {
      var intDigits = m.slice(0, idx).replace(/[.,]/g, "");
      var frac = m.slice(idx + 1).replace(/[.,]/g, "");
      val = parseFloat((intDigits || "0") + "." + (frac || "0"));
    }
    if (!isFinite(val) || val < 0) return 0;
    return val;
  }

  function initCalc(root) {
    var lang = (document.documentElement.lang || "fr").slice(0, 2);
    if (!I18N[lang]) lang = "fr";
    var t = I18N[lang];
    var locale = lang === "en" ? "en-CA" : "fr-CA";

    var money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    function fmt(n) { return money.format(n); }

    var input = root.querySelector("[data-input]");
    var modeBtns = root.querySelectorAll("[data-mode]");
    var elRow1 = root.querySelector("[data-out=row1]");
    var elTps = root.querySelector("[data-out=tps]");
    var elTvq = root.querySelector("[data-out=tvq]");
    var elBig = root.querySelector("[data-out=big]");
    var elInLabel = root.querySelector("[data-label=input]");
    var elRow1Label = root.querySelector("[data-label=row1]");
    var elBigLabel = root.querySelector("[data-label=big]");
    var copyBtn = root.querySelector("[data-copy]");
    var clearBtn = root.querySelector("[data-clear]");
    var chips = root.querySelectorAll("[data-chip]");

    var mode = root.getAttribute("data-default-mode") === "remove" ? "remove" : "add";

    function setMode(m) {
      mode = m;
      for (var i = 0; i < modeBtns.length; i++) {
        var b = modeBtns[i];
        b.setAttribute("aria-pressed", b.getAttribute("data-mode") === m ? "true" : "false");
      }
      if (elInLabel) elInLabel.textContent = m === "remove" ? t.inLabelRemove : t.inLabelAdd;
      if (elRow1Label) elRow1Label.textContent = m === "remove" ? t.row1Remove : t.row1Add;
      if (elBigLabel) elBigLabel.textContent = m === "remove" ? t.bigRemove : t.bigAdd;
      compute();
    }

    function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

    function compute() {
      var amount = parseAmount(input.value);
      var sub, tps, tvq, total;
      if (mode === "remove") {
        total = amount;
        sub = amount / COMBINED;
        tps = sub * GST;
        tvq = sub * QST;
      } else {
        sub = amount;
        tps = amount * GST;
        tvq = amount * QST;
        total = amount + tps + tvq;
      }
      // round for display
      sub = round2(sub); tps = round2(tps); tvq = round2(tvq); total = round2(total);

      elTps.textContent = fmt(tps);
      elTvq.textContent = fmt(tvq);
      if (mode === "remove") {
        elRow1.textContent = fmt(total);
        elBig.textContent = fmt(sub);
      } else {
        elRow1.textContent = fmt(sub);
        elBig.textContent = fmt(total);
      }

      root._summary =
        t.sub + ": " + fmt(sub) + " | " +
        t.tps + ": " + fmt(tps) + " | " +
        t.tvq + ": " + fmt(tvq) + " | " +
        t.total + ": " + fmt(total);
    }

    input.addEventListener("input", compute);
    for (var i = 0; i < modeBtns.length; i++) {
      (function (b) {
        b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); input.focus(); });
      })(modeBtns[i]);
    }
    for (var c = 0; c < chips.length; c++) {
      (function (chip) {
        chip.addEventListener("click", function () {
          input.value = chip.getAttribute("data-chip");
          compute();
          input.focus();
        });
      })(chips[c]);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        input.value = "";
        compute();
        input.focus();
      });
    }

    if (copyBtn) {
      var resetLbl;
      copyBtn.addEventListener("click", function () {
        var text = root._summary || "";
        var done = function (ok) {
          clearTimeout(resetLbl);
          copyBtn.textContent = ok ? t.copyDone : t.copyErr;
          copyBtn.classList.toggle("copied", ok);
          resetLbl = setTimeout(function () {
            copyBtn.textContent = t.copyIdle;
            copyBtn.classList.remove("copied");
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
        } else { fallback(); }
        function fallback() {
          try {
            var ta = document.createElement("textarea");
            ta.value = text; ta.setAttribute("readonly", "");
            ta.style.position = "absolute"; ta.style.left = "-9999px";
            document.body.appendChild(ta); ta.select();
            var ok = document.execCommand("copy");
            document.body.removeChild(ta);
            done(ok);
          } catch (e) { done(false); }
        }
      });
    }

    setMode(mode);
    compute();
  }

  function boot() {
    var roots = document.querySelectorAll("[data-calc]");
    for (var i = 0; i < roots.length; i++) initCalc(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
