/* Hoomio · calculadora de la home.
   El estado se refleja en la URL (?f=4250&actual=gestora&com=20&plan=estandar#calculadora)
   para poder compartir un cálculo o enlazarlo desde campañas. */
(function () {
  "use strict";

  var form = document.getElementById("calc");
  if (!form) return;

  var PLANS = {
    basico: {
      name: "Básico", rate: 0.125, hours: 12,
      forget: "mensajes a deshoras, entrega de llaves, registro de viajeros y quejas por ruido."
    },
    estandar: {
      name: "Estándar", rate: 0.15, hours: 25,
      forget: "mensajes a deshoras, llaves, registro de viajeros, quejas por ruido, limpiezas que fallan, averías y reseñas."
    },
    premium: {
      name: "Premium", rate: 0.185, hours: 28, kit: true,
      forget: "todo lo del Estándar, y además de precios mal ajustados y de seguros o suministros más caros de lo necesario."
    }
  };
  var ORDER = ["basico", "estandar", "premium"];

  // Formato propio: Intl en es-ES no agrupa los números de 4 cifras (3613 en vez de 3.613).
  var num = { format: function (n) {
    var r = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 && Math.round(n) !== 0 ? "−" : "") + r;
  } };
  var eur = { format: function (n) { return num.format(n) + " €"; } };
  var pct = function (r) { return (r * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "%"; };
  var $ = function (id) { return document.getElementById(id); };

  var el = {
    f: $("f"), fRange: $("f-range"), precio: $("precio"), noches: $("noches"), nochesOut: $("noches-out"),
    fEst: $("f-est"), com: $("com"), comWrap: $("com-wrap"),
    label: $("out-label"), net: $("out-net"), delta: $("out-delta"), bars: $("out-bars"),
    forget: $("out-forget"), cta: $("out-cta"), share: $("out-share"), cmp: $("cmp"), thLast: $("th-last")
  };

  var peekNet = $("peek-net"), peekDelta = $("peek-delta"), peek = $("calc-peek");
  // Barra de resultado en móvil: visible mientras se editan los datos y el resultado no está en pantalla.
  if (peek && "IntersectionObserver" in window) {
    var inView = { in: false, out: false };
    var upd = function () { peek.classList.toggle("show", inView.in && !inView.out); };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { inView[e.target === form.querySelector(".calc-in") ? "in" : "out"] = e.isIntersecting; });
      upd();
    }).observe(form.querySelector(".calc-in"));
    new IntersectionObserver(function (es) { inView.out = es[0].isIntersecting; upd(); }, { threshold: .25 })
      .observe($("calc-out"));
  }

  var state = { modo: "mes", f: 4250, precio: 175, noches: 24, actual: "gestora", com: 20, plan: "estandar" };

  function parseNum(v) {
    var n = parseFloat(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r && r.value; }
  function setRadio(name, value) {
    var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }

  // ---- Estado desde la URL ----
  (function readUrl() {
    var q = new URLSearchParams(location.search);
    if (q.get("f")) state.f = clamp(parseNum(q.get("f")), 0, 100000);
    if (q.get("modo") === "noches") state.modo = "noches";
    if (q.get("precio")) state.precio = clamp(parseNum(q.get("precio")), 0, 5000);
    if (q.get("noches")) state.noches = clamp(Math.round(parseNum(q.get("noches"))), 1, 31);
    if (q.get("actual") === "yo") state.actual = "yo";
    if (q.get("com")) { var c = parseFloat(q.get("com").replace(",", ".")); if (isFinite(c)) state.com = clamp(c, 0, 50); }
    if (PLANS[q.get("plan")]) state.plan = q.get("plan");
  })();

  function writeUrl() {
    try {
      var q = new URLSearchParams(location.search);
      ["f", "modo", "precio", "noches", "actual", "com", "plan"].forEach(function (k) { q.delete(k); });
      if (state.modo === "noches") { q.set("modo", "noches"); q.set("precio", state.precio); q.set("noches", state.noches); }
      else q.set("f", Math.round(state.f));
      q.set("actual", state.actual);
      if (state.actual === "gestora") q.set("com", state.com);
      q.set("plan", state.plan);
      history.replaceState(null, "", location.pathname + "?" + q.toString() + "#calculadora");
    } catch (e) { /* sin history API */ }
  }

  // ---- Pintado del formulario ----
  function syncInputs() {
    setRadio("modo", state.modo);
    setRadio("actual", state.actual);
    setRadio("plan", state.plan);
    if (document.activeElement !== el.f) el.f.value = num.format(state.f);
    el.fRange.value = clamp(state.f, 500, 12000);
    if (document.activeElement !== el.precio) el.precio.value = num.format(state.precio);
    el.noches.value = state.noches;
    el.nochesOut.textContent = state.noches;
    if (document.activeElement !== el.com) el.com.value = String(state.com).replace(".", ",");
    form.querySelectorAll(".mode-panel").forEach(function (p) { p.hidden = p.getAttribute("data-modo") !== state.modo; });
    el.comWrap.hidden = state.actual !== "gestora";
  }

  function bar(name, value, max, cls, extra) {
    var w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return '<div class="bar ' + cls + '">' +
      '<div class="bar-top"><span>' + name + '</span><b>' + eur.format(value) + '</b></div>' +
      '<div class="track"><i style="width:' + w + '%"></i></div>' +
      (extra ? '<small>' + extra + '</small>' : '') +
      '</div>';
  }

  function revenue() { return state.modo === "noches" ? state.precio * state.noches : state.f; }

  function render() {
    var rev = revenue();
    var p = PLANS[state.plan];
    var fee = rev * p.rate;
    var net = rev - fee;
    var com = state.com / 100;

    el.fEst.textContent = eur.format(rev);
    el.label.textContent = "Con el plan " + p.name + " te quedan cada mes";
    el.net.textContent = eur.format(net);
    peekNet.textContent = eur.format(net);
    if (state.actual === "gestora") {
      var dm = net - rev * (1 - com);
      peekDelta.textContent = Math.abs(dm) >= 1 ? (dm > 0 ? "+" : "−") + eur.format(Math.abs(dm)) + "/mes" : "";
    } else {
      peekDelta.textContent = "~" + p.hours + " h libres";
    }

    var hoomioName = "Hoomio " + p.name + " (" + pct(p.rate) + ")";
    if (state.actual === "gestora") {
      var curNet = rev * (1 - com);
      var diff = net - curNet;
      if (diff >= 1) {
        el.delta.className = "out-delta up";
        el.delta.innerHTML = "<b>+" + eur.format(diff) + " al mes</b>, " + eur.format(diff * 12) +
          " más al año que con tu gestora al " + pct(com) + ".";
      } else if (diff <= -1) {
        el.delta.className = "out-delta down";
        el.delta.innerHTML = "Pagarías " + eur.format(-diff) + " más al mes que con tu gestora al " + pct(com) +
          ". Mira si te compensa lo que incluye el plan, o prueba otro.";
      } else {
        el.delta.className = "out-delta";
        el.delta.textContent = "Lo mismo que con tu gestora actual, con la tecnología Hoomio incluida.";
      }
      el.bars.innerHTML =
        bar("Tu gestora (" + pct(com) + ")", curNet, rev, "cur") +
        bar(hoomioName, net, rev, "new");
    } else {
      var perHour = p.hours > 0 ? fee / p.hours : 0;
      el.delta.className = "out-delta up";
      el.delta.innerHTML = "<b>Recuperas ~" + p.hours + " h al mes.</b> Te cuesta " + eur.format(fee) +
        ", unos " + eur.format(perHour) + " por cada hora que dejas de dedicarle.";
      el.bars.innerHTML =
        bar("Lo llevas tú", rev, rev, "cur", "y unas " + p.hours + " h de tu tiempo al mes") +
        bar(hoomioName, net, rev, "new", "sin dedicarle tiempo");
    }

    el.forget.innerHTML = "<b>Te olvidas de:</b> " + p.forget +
      (p.kit ? ' <span class="kit-note">Kit Hoomio incluido con contrato mínimo de 2 años.</span>' : "");
    el.cta.textContent = "Quiero el plan " + p.name;
    el.cta.setAttribute("data-cta", "calculadora_" + state.plan);

    // Tabla comparativa
    el.thLast.textContent = state.actual === "gestora" ? "Frente a tu gestora, al año" : "Horas que recuperas";
    el.cmp.innerHTML = ORDER.map(function (k) {
      var pl = PLANS[k], n = rev * (1 - pl.rate), last;
      if (state.actual === "gestora") {
        var d = (n - rev * (1 - com)) * 12;
        last = (d >= 0 ? "+" : "−") + eur.format(Math.abs(d));
      } else {
        last = "~" + pl.hours + " h/mes";
      }
      return '<tr' + (k === state.plan ? ' class="sel"' : "") + '><th scope="row">' + pl.name + "</th><td>" + pct(pl.rate) +
        "</td><td>" + eur.format(n) + "</td><td>" + last + "</td></tr>";
    }).join("");
  }

  // ---- Interacción ----
  var touched = false, urlTimer;
  function changed(source) {
    if (!touched && window.hoomioTrack) { touched = true; window.hoomioTrack("calculadora_uso", { campo: source }); }
    syncInputs();
    render();
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeUrl, 400);
  }

  form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "modo") {
      state.modo = t.value;
      // Al cambiar de modo, mantenemos la misma facturación aproximada.
      if (state.modo === "noches") state.precio = Math.max(20, Math.round(state.f / state.noches / 5) * 5);
      else state.f = Math.round(state.precio * state.noches / 50) * 50;
    }
    if (t.name === "actual") state.actual = t.value;
    if (t.name === "plan") state.plan = t.value;
    changed(t.name || t.id);
  });

  el.f.addEventListener("input", function () { state.f = clamp(parseNum(el.f.value), 0, 100000); changed("f"); });
  el.fRange.addEventListener("input", function () { state.f = Number(el.fRange.value); el.f.value = num.format(state.f); changed("f-range"); });
  el.precio.addEventListener("input", function () { state.precio = clamp(parseNum(el.precio.value), 0, 5000); changed("precio"); });
  el.noches.addEventListener("input", function () { state.noches = Number(el.noches.value); changed("noches"); });
  el.com.addEventListener("input", function () {
    var c = parseFloat(el.com.value.replace(",", ".").replace(/[^\d.]/g, ""));
    state.com = clamp(isFinite(c) ? c : 0, 0, 50);
    changed("com");
  });
  [el.f, el.precio, el.com].forEach(function (inp) {
    inp.addEventListener("blur", function () { syncInputs(); });
    inp.addEventListener("focus", function () { inp.select(); });
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  el.share.addEventListener("click", function () {
    writeUrl();
    var done = function (ok) {
      el.share.textContent = ok ? "Enlace copiado" : "Copia la dirección del navegador";
      setTimeout(function () { el.share.textContent = "Copiar enlace"; }, 2200);
    };
    try {
      navigator.clipboard.writeText(location.href).then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
    if (window.hoomioTrack) window.hoomioTrack("calculadora_compartir", { plan: state.plan });
  });

  syncInputs();
  render();
})();
