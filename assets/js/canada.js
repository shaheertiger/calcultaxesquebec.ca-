/* Canada sales tax calculator (GST / HST / PST / QST by province) — vanilla JS, no deps.
 * Province rates live on the <option> elements (data-fed, data-prov, data-kind), written by build.js. */
(function () {
  "use strict";
  var roots = document.querySelectorAll("[data-ca]");
  if (!roots.length) return;
  var fr = (document.documentElement.lang || "fr").slice(0, 2) !== "en";
  var fmt = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var pctFmt = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 3 });
  var T = fr
    ? { add: "Montant avant taxes", remove: "Montant avec taxes incluses", sub: "Sous-total", subR: "Total avec taxes incluses", big: "Total avec taxes", bigR: "Montant avant taxes",
        gst: "TPS", hst: "TVH", pst: "TVP", rst: "TVD", qst: "TVQ", copyIdle: "Copier le résultat", copyDone: "Copié ✓", copyErr: "Copie impossible" }
    : { add: "Amount before tax", remove: "Total with tax included", sub: "Subtotal", subR: "Total with tax", big: "Total with tax", bigR: "Amount before tax",
        gst: "GST", hst: "HST", pst: "PST", rst: "RST", qst: "QST", copyIdle: "Copy result", copyDone: "Copied ✓", copyErr: "Copy failed" };

  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function parse(str) {
    var m = String(str || "").replace(/[^0-9.,]/g, "");
    if (!m) return 0;
    var idx = Math.max(m.lastIndexOf("."), m.lastIndexOf(","));
    var val = idx < 0 ? parseFloat(m) : parseFloat((m.slice(0, idx).replace(/[.,]/g, "") || "0") + "." + (m.slice(idx + 1).replace(/[.,]/g, "") || "0"));
    return isFinite(val) && val > 0 ? val : 0;
  }

  function init(root) {
    var input = root.querySelector("[data-ca-input]");
    var sel = root.querySelector("[data-ca-prov]");
    var modeBtns = root.querySelectorAll("[data-ca-mode]");
    var q = function (k) { return root.querySelector('[data-ca-out="' + k + '"]'); };
    var lab = function (k) { return root.querySelector('[data-ca-label="' + k + '"]'); };
    var mode = root.getAttribute("data-ca-default-mode") === "remove" ? "remove" : "add";
    var copyBtn = root.querySelector("[data-ca-copy]");
    var summary = "";

    function rateLabel(name, r) { return name + " " + pctFmt.format(r); }

    function compute() {
      var o = sel.options[sel.selectedIndex];
      var fed = parseFloat(o.getAttribute("data-fed")), prov = parseFloat(o.getAttribute("data-prov"));
      var kind = o.getAttribute("data-kind");
      var rate = fed + prov, x = parse(input.value);
      var base, total;
      if (mode === "remove") { total = x; base = r2(x / (1 + rate)); } else { base = x; }
      var t1, t2;
      if (kind === "hst") { t1 = r2(base * rate); t2 = 0; } else { t1 = r2(base * fed); t2 = r2(base * prov); }
      if (mode === "add") total = r2(base + t1 + t2);

      var l1 = kind === "hst" ? rateLabel(T.hst, rate) : rateLabel(T.gst, fed);
      var l2 = prov > 0 && kind !== "hst" ? rateLabel(T[kind], prov) : "";
      lab("t1").textContent = l1;
      lab("t2").textContent = l2;
      q("t2").parentNode.hidden = !l2;
      lab("input").textContent = mode === "remove" ? T.remove : T.add;
      lab("row1").textContent = mode === "remove" ? T.subR : T.sub;
      lab("big").textContent = mode === "remove" ? T.bigR : T.big;
      q("row1").textContent = fmt.format(mode === "remove" ? total : base);
      q("t1").textContent = fmt.format(t1);
      q("t2").textContent = fmt.format(t2);
      q("big").textContent = fmt.format(mode === "remove" ? base : total);
      q("rate").textContent = pctFmt.format(rate);
      summary = o.textContent.trim() + " — " + (mode === "remove" ? T.bigR : T.sub) + ": " + fmt.format(base) + " | " + l1 + ": " + fmt.format(t1) +
        (l2 ? " | " + l2 + ": " + fmt.format(t2) : "") + " | " + T.big + ": " + fmt.format(total);
    }

    function setMode(m) {
      mode = m;
      for (var i = 0; i < modeBtns.length; i++) modeBtns[i].setAttribute("aria-pressed", String(modeBtns[i].getAttribute("data-ca-mode") === m));
      compute();
    }
    for (var i = 0; i < modeBtns.length; i++) modeBtns[i].addEventListener("click", function () { setMode(this.getAttribute("data-ca-mode")); });
    input.addEventListener("input", compute);
    sel.addEventListener("change", compute);
    var chips = root.querySelectorAll("[data-ca-chip]");
    for (var j = 0; j < chips.length; j++) chips[j].addEventListener("click", function () { input.value = this.getAttribute("data-ca-chip"); compute(); });
    var clearBtn = root.querySelector("[data-ca-clear]");
    if (clearBtn) clearBtn.addEventListener("click", function () { input.value = ""; compute(); input.focus(); });
    if (copyBtn) {
      var reset;
      copyBtn.addEventListener("click", function () {
        var done = function (ok) {
          clearTimeout(reset);
          copyBtn.textContent = ok ? T.copyDone : T.copyErr;
          copyBtn.classList.toggle("copied", ok);
          reset = setTimeout(function () { copyBtn.textContent = T.copyIdle; copyBtn.classList.remove("copied"); }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(summary).then(function () { done(true); }, function () { done(false); });
        else done(false);
      });
    }
    setMode(mode);
  }
  for (var k = 0; k < roots.length; k++) init(roots[k]);
})();
