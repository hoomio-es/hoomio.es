/* Hoomio · comportamiento común a todas las páginas.
   - Cabecera con borde al hacer scroll
   - Menú móvil
   - Año del pie
   - Medición: empuja eventos a window.dataLayer (listo para Google Tag Manager / GA4)
   - Conserva los parámetros de campaña (utm_*, gclid) de la primera visita de la sesión */
(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  // Parámetros de campaña: se guardan la primera vez que llegan en la sesión.
  var CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  var campaign = {};
  try {
    var stored = sessionStorage.getItem("hoomio_campaign");
    if (stored) campaign = JSON.parse(stored) || {};
    var qs = new URLSearchParams(location.search);
    var found = false;
    CAMPAIGN_KEYS.forEach(function (k) {
      if (qs.get(k)) { campaign[k] = qs.get(k); found = true; }
    });
    if (found) sessionStorage.setItem("hoomio_campaign", JSON.stringify(campaign));
  } catch (e) { /* almacenamiento no disponible: seguimos sin él */ }

  window.hoomioTrack = function (event, data) {
    var payload = { event: event, page: location.pathname };
    Object.keys(campaign).forEach(function (k) { payload[k] = campaign[k]; });
    if (data) Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
    window.dataLayer.push(payload);
  };

  // Clics en "reservar llamada" y en teléfono / email.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("calendar.app.google") !== -1) {
      var section = a.closest("section, header, aside, footer");
      window.hoomioTrack("reserva_llamada_click", {
        cta: a.getAttribute("data-cta") || (section && section.id) || "otro",
        cta_text: a.textContent.trim()
      });
    } else if (href.indexOf("tel:") === 0) {
      window.hoomioTrack("telefono_click");
    } else if (href.indexOf("mailto:") === 0) {
      window.hoomioTrack("email_click");
    }
  });

  // Cabecera
  var header = document.getElementById("top");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Menú móvil
  var btn = document.querySelector(".menu-btn");
  if (btn && header) {
    var label = btn.querySelector(".sr");
    var setOpen = function (open) {
      header.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) label.textContent = open ? "Cerrar menú" : "Abrir menú";
    };
    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    header.addEventListener("click", function (e) {
      if (e.target.closest("nav a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("menu-open")) { setOpen(false); btn.focus(); }
    });
  }

  // Año
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Aparición suave de bloques (página de historia). Sin JS, todo se ve.
  var reveal = document.querySelectorAll("[data-reveal]");
  if (reveal.length && "IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("can-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    reveal.forEach(function (el) { io.observe(el); });
  }
})();
