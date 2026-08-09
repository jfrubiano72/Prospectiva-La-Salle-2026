/* ============================================================================
   ASISTENTE DEL TABLERO DE PROSPECTIVA · Universidad de La Salle
   Chat con voz (entrada y salida) + generacion de graficas a pedido (Gemini).
   Requiere: window.LASALLE_KB (base-conocimiento.js) y Chart.js (ya cargado).
   Publicable en GitHub Pages. La clave de API se guarda solo en el navegador.
   ============================================================================ */
(function () {
  "use strict";
  if (window.__asistenteLaSalle) return;
  window.__asistenteLaSalle = true;

  /* ---------- Configuracion y paleta de marca ---------- */
  var PAL = {
    navy: "#0B1B2B", navyMed: "#1A2A4A", teal: "#1F7A8C", gold: "#C8963E",
    neon: "#00F0B5", azul: "#7FB0D0", cream: "#F8F5EE", white: "#FFFFFF",
    ink: "#182430", muted: "#5c6b78", green: "#2e8b6f", red: "#b5502f", purple: "#7d5a9c"
  };
  var SERIE = [PAL.teal, PAL.gold, PAL.azul, PAL.green, PAL.purple, PAL.navyMed];
  var LS = { key: "lasalle_gemini_key", model: "lasalle_gemini_model", voz: "lasalle_voz_out" };
  var MODELO_DEF = "gemini-2.5-flash";
  var NOMBRE = "Juana";
  // Si se despliega el proxy (para que cualquiera use el chat sin poner clave), aqui va su URL.
  // Vacio = cada usuario ingresa su propia clave de Gemini en Configuracion.
  var BACKEND_URL = "https://juana-lasalle.jfrubiano.workers.dev/";

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- Formato de numeros en espanol ---------- */
  function nEs(v) {
    if (typeof v !== "number") { var p = parseFloat(v); if (isNaN(p)) return v; v = p; }
    return v.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  }

  /* ---------- Estilos ---------- */
  var CSS = `
  #als-btn{position:fixed;bottom:22px;right:22px;z-index:99998;width:60px;height:60px;border:none;border-radius:50%;
    background:linear-gradient(135deg,${PAL.teal},${PAL.gold});color:#fff;cursor:pointer;box-shadow:0 8px 26px rgba(11,27,43,.34);
    display:flex;align-items:center;justify-content:center;transition:transform .18s,box-shadow .18s}
  #als-btn:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 32px rgba(11,27,43,.42)}
  #als-btn svg{width:28px;height:28px}
  #als-panel{position:fixed;bottom:22px;right:22px;z-index:99999;width:410px;max-width:calc(100vw - 24px);height:640px;
    max-height:calc(100vh - 40px);background:${PAL.cream};border-radius:18px;box-shadow:0 18px 60px rgba(11,27,43,.40);
    display:none;flex-direction:column;overflow:hidden;font-family:'Source Sans 3',system-ui,sans-serif;color:${PAL.ink}}
  #als-panel.open{display:flex;animation:alsUp .28s ease}
  @keyframes alsUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .als-head{background:linear-gradient(135deg,${PAL.navy},${PAL.navyMed});color:#fff;padding:13px 15px;display:flex;align-items:center;gap:10px}
  .als-head .mk{width:34px;height:34px;border-radius:10px;background:url("juana.png") center 12%/cover no-repeat,linear-gradient(135deg,${PAL.teal},${PAL.gold});flex:none;box-shadow:0 1px 4px rgba(0,0,0,.2)}
  .als-juana-hero{display:block;height:92px;width:auto;margin:0 auto 10px;object-fit:contain}
  .als-head .tt{flex:1;min-width:0}
  .als-head .tt b{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:14.5px;display:block;line-height:1.1}
  .als-head .tt span{font-size:9px;text-transform:uppercase;letter-spacing:1.1px;color:${PAL.azul};display:block;margin-top:2px}
  .als-icon{background:rgba(127,176,208,.16);border:none;color:#fff;width:32px;height:32px;border-radius:8px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;flex:none;transition:background .15s}
  .als-icon:hover{background:rgba(127,176,208,.34)}
  .als-icon svg{width:17px;height:17px}
  .als-icon.on{background:${PAL.gold};color:${PAL.navy}}
  .als-body{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
  .als-msg{max-width:88%;padding:10px 13px;border-radius:13px;font-size:13.5px;line-height:1.55;white-space:normal;word-wrap:break-word}
  .als-msg.u{align-self:flex-end;background:${PAL.navy};color:#fff;border-bottom-right-radius:4px}
  .als-msg.a{align-self:flex-start;background:#fff;border:1px solid rgba(11,27,43,.09);box-shadow:0 2px 10px rgba(11,27,43,.05);border-bottom-left-radius:4px}
  .als-msg.a b{color:${PAL.navy};font-weight:600}
  .als-msg.a a{color:${PAL.teal}}
  .als-msg ul{margin:6px 0 2px;padding-left:18px}.als-msg li{margin:3px 0}
  .als-src{font-size:10.5px;color:${PAL.muted};margin-top:7px;padding-top:6px;border-top:1px solid rgba(11,27,43,.08);line-height:1.4}
  .als-chartbox{background:#fff;border:1px solid rgba(11,27,43,.09);border-radius:12px;padding:12px 12px 8px;margin-top:9px}
  .als-chartbox .ct{font-family:'Playfair Display',Georgia,serif;font-size:13px;color:${PAL.navy};margin-bottom:8px;line-height:1.2}
  .als-chartwrap{position:relative;height:230px}
  .als-chartbox .cf{font-size:9.5px;color:${PAL.muted};margin-top:6px;line-height:1.35}
  .als-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:#fff;border:1px solid rgba(11,27,43,.09);border-radius:13px}
  .als-typing i{width:7px;height:7px;border-radius:50%;background:${PAL.azul};animation:alsBlink 1.2s infinite}
  .als-typing i:nth-child(2){animation-delay:.2s}.als-typing i:nth-child(3){animation-delay:.4s}
  @keyframes alsBlink{0%,60%,100%{opacity:.3}30%{opacity:1}}
  .als-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
  .als-chip{background:rgba(31,122,140,.10);border:1px solid rgba(31,122,140,.25);color:${PAL.navy};font-size:11.5px;
    padding:6px 10px;border-radius:16px;cursor:pointer;text-align:left;line-height:1.3;transition:background .15s}
  .als-chip:hover{background:rgba(31,122,140,.20)}
  .als-foot{padding:10px 12px;background:${PAL.cream};border-top:1px solid rgba(11,27,43,.10)}
  .als-inputrow{display:flex;align-items:flex-end;gap:7px;background:#fff;border:1px solid rgba(11,27,43,.16);border-radius:13px;padding:5px 6px 5px 12px}
  .als-inputrow textarea{flex:1;border:none;outline:none;resize:none;font-family:inherit;font-size:13.5px;color:${PAL.ink};
    background:transparent;max-height:96px;line-height:1.4;padding:6px 0}
  .als-send,.als-mic{border:none;border-radius:10px;width:36px;height:36px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .als-send{background:${PAL.teal};color:#fff}.als-send:hover{background:#2792a6}
  .als-mic{background:rgba(11,27,43,.06);color:${PAL.navy}}.als-mic:hover{background:rgba(11,27,43,.12)}
  .als-mic.rec{background:${PAL.red};color:#fff;animation:alsPulse 1.1s infinite}
  @keyframes alsPulse{0%{box-shadow:0 0 0 0 rgba(181,80,47,.5)}70%{box-shadow:0 0 0 9px rgba(181,80,47,0)}100%{box-shadow:0 0 0 0 rgba(181,80,47,0)}}
  .als-send svg,.als-mic svg{width:18px;height:18px}
  .als-hint{font-size:10px;color:${PAL.muted};text-align:center;margin-top:6px}
  .als-cfg{position:absolute;inset:0;background:${PAL.cream};z-index:5;display:none;flex-direction:column;padding:18px 16px;overflow-y:auto}
  .als-cfg.show{display:flex}
  .als-cfg h4{font-family:'Playfair Display',Georgia,serif;color:${PAL.navy};font-size:16px;margin:0 0 4px}
  .als-cfg p{font-size:12px;color:${PAL.muted};line-height:1.5;margin:0 0 14px}
  .als-cfg label{font-size:10.5px;text-transform:uppercase;letter-spacing:.9px;color:${PAL.muted};font-weight:600;display:block;margin:10px 0 5px}
  .als-cfg input{width:100%;border:1px solid rgba(11,27,43,.18);border-radius:9px;padding:9px 11px;font-family:inherit;font-size:13px;outline:none}
  .als-cfg input:focus{border-color:${PAL.teal}}
  .als-cfg .save{margin-top:18px;background:${PAL.teal};color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:600;cursor:pointer}
  .als-cfg .save:hover{background:#2792a6}
  .als-cfg .lnk{font-size:11.5px;color:${PAL.teal};margin-top:12px;text-align:center;display:block;text-decoration:none}
  .als-err{color:${PAL.red};font-size:12px;margin-top:8px}
  @media(max-width:480px){#als-panel{bottom:0;right:0;width:100vw;height:100vh;max-height:100vh;border-radius:0}}
  `;

  /* ---------- Iconos ---------- */
  var IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/></svg>',
    spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>',
    spkoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
    cfg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  /* ---------- Construccion del DOM ---------- */
  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "als-btn"; btn.setAttribute("aria-label", "Abrir a Juana"); btn.innerHTML = IC.chat;
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.id = "als-panel";
  panel.innerHTML =
    '<div class="als-head">' +
      '<div class="mk"></div>' +
      '<div class="tt"><b>Juana</b><span>Asistente &middot; Universidad de La Salle</span></div>' +
      '<button class="als-icon" id="als-voz" title="Voz de respuesta"></button>' +
      '<button class="als-icon" id="als-cfgbtn" title="Configuracion">' + IC.cfg + '</button>' +
      '<button class="als-icon" id="als-x" title="Cerrar">' + IC.close + '</button>' +
    '</div>' +
    '<div class="als-body" id="als-body"></div>' +
    '<div class="als-foot">' +
      '<div class="als-inputrow">' +
        '<textarea id="als-in" rows="1" placeholder="Preguntale a Juana..."></textarea>' +
        '<button class="als-mic" id="als-mic" title="Hablar">' + IC.mic + '</button>' +
        '<button class="als-send" id="als-send" title="Enviar">' + IC.send + '</button>' +
      '</div>' +
      '<div class="als-hint">Respuestas basadas en el tablero. Verifica cifras sensibles.</div>' +
    '</div>' +
    '<div class="als-cfg" id="als-cfg">' +
      '<h4>Configuracion</h4>' +
      '<p>El asistente usa la API de Google Gemini. Tu clave se guarda solo en este navegador y nunca se sube a GitHub.</p>' +
      '<label>Clave de API de Google Gemini</label>' +
      '<input id="als-key" type="password" placeholder="AIza..." autocomplete="off">' +
      '<label>Modelo</label>' +
      '<input id="als-mdl" type="text" placeholder="' + MODELO_DEF + '">' +
      '<div class="als-err" id="als-cfgerr"></div>' +
      '<button class="save" id="als-savecfg">Guardar</button>' +
      '<a class="lnk" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Obtener una clave gratis en Google AI Studio</a>' +
    '</div>';
  document.body.appendChild(panel);

  var $ = function (id) { return document.getElementById(id); };
  var body = $("als-body");

  /* ---------- Estado ---------- */
  var historial = [];            // {role:'user'|'model', text}
  var vozOut = get(LS.voz, "1") === "1";
  var recognizing = false, recog = null;

  /* ---------- Voz de respuesta (toggle) ---------- */
  function pintarVoz() {
    var b = $("als-voz");
    b.innerHTML = vozOut ? IC.spk : IC.spkoff;
    b.classList.toggle("on", vozOut);
    b.title = vozOut ? "Voz de respuesta: activada" : "Voz de respuesta: silenciada";
  }
  pintarVoz();

  /* ---------- Sintesis de voz (salida) ----------
     Juana no tiene voz grabada: usa la del sistema operativo, asi que suena
     distinto en cada equipo. La seleccion anterior tomaba la PRIMERA voz en
     espanol de la lista, que en Windows suele ser una voz local antigua de
     timbre mayor. Los equipos actuales ya traen voces neurales mucho mejores
     -las "Online (Natural)" de Microsoft y las de Google-; solo habia que
     pedirlas.

     Se puntua cada voz disponible y se elige la mejor:
       neural  +40  ·  nombre femenino  +25  ·  Colombia  +20
       otro pais de America  +12  ·  Espana  +4  ·  no local  +6

     Si el equipo de la sala trae otro juego de voces, se puede cambiar en el
     momento sin tocar el codigo:
         vozJuanaLista()        muestra las disponibles
         vozJuana("nombre")     fija una y la prueba
  */
  var vozEs = null;
  var NEURAL   = /(natural|online|neural|google|premium|enhanced|siri)/i;
  var FEMENINA = /(salom|ximena|dalia|paloma|elena|elvira|sabina|helena|laura|catalina|isabela|luciana|camila|sofia|valentina|monica|penelope|lupe|mia|female|mujer)/i;
  var MASCULINO= /(jorge|carlos|diego|pablo|miguel|alvaro|dalia_male|male|hombre)/i;

  function puntajeVoz(v) {
    var n = ((v.name || "") + " " + (v.voiceURI || ""));
    var l = (v.lang || "");
    if (!/^es/i.test(l)) return -1;
    var p = 0;
    if (NEURAL.test(n))    p += 40;
    if (FEMENINA.test(n))  p += 25;
    if (MASCULINO.test(n)) p -= 30;
    if (/es(-|_)?CO/i.test(l))                        p += 20;
    else if (/es(-|_)?(MX|419|US|AR|CL|PE)/i.test(l)) p += 12;
    else if (/es(-|_)?ES/i.test(l))                   p += 4;
    if (v.localService === false) p += 6;
    return p;
  }
  function vocesEs() {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices().filter(function (v) { return /^es/i.test(v.lang || ""); });
  }
  function cargarVoz() {
    var vs = vocesEs();
    if (!vs.length) return;
    var fijada = null;
    try { fijada = window.localStorage.getItem("juana.voz"); } catch (e) {}
    if (fijada) {
      var f = vs.filter(function (v) { return v.name === fijada; })[0];
      if (f) { vozEs = f; return; }
    }
    vozEs = vs.slice().sort(function (a, b) { return puntajeVoz(b) - puntajeVoz(a); })[0] || null;
  }
  if ("speechSynthesis" in window) {
    cargarVoz();
    window.speechSynthesis.onvoiceschanged = cargarVoz;
  }

  /* Herramientas para escoger la voz en la sala, sin tocar el codigo. */
  window.vozJuanaLista = function () {
    var vs = vocesEs().slice().sort(function (a, b) { return puntajeVoz(b) - puntajeVoz(a); });
    if (!vs.length) { console.log("Este equipo no tiene voces en espanol instaladas."); return []; }
    console.table(vs.map(function (v, i) {
      return { orden: i + 1, nombre: v.name, idioma: v.lang,
               puntaje: puntajeVoz(v), enUso: vozEs && v.name === vozEs.name ? "si" : "" };
    }));
    return vs.map(function (v) { return v.name; });
  };
  window.vozJuana = function (nombre) {
    var v = vocesEs().filter(function (x) { return x.name === nombre; })[0];
    if (!v) { console.log("No encuentro esa voz. Use vozJuanaLista() para ver las disponibles."); return; }
    vozEs = v;
    try { window.localStorage.setItem("juana.voz", nombre); } catch (e) {}
    hablar("Soy Juana, el asistente de prospectiva de la Universidad de La Salle. Con esta voz le voy a responder.");
  };

  /* Voz propia. El servicio guarda la clave del lado del servidor: el navegador
     solo manda el texto y recibe el audio. Si el servicio no responde -sin red,
     sin creditos, lo que sea- Juana sigue hablando con la voz del sistema. Nunca
     se queda muda delante de nadie. */
  var VOZ_SERVICIO = "https://voz-lasalle.jfrubiano.workers.dev/voz";
  var audioVoz = null;

  function hablarSistema(txt) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (!vozEs) cargarVoz();
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = "es-CO";
      if (vozEs) u.voice = vozEs;
      /* Ritmo de exposicion, no de lectura rapida: va a decir cifras.
         El tono apenas por encima del natural quita gravedad sin volverla infantil. */
      u.rate = 1.0; u.pitch = 1.06; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function hablar(txt) {
    if (!vozOut || !txt) return;
    callar();
    var t = String(txt).slice(0, 700);
    var pedido;
    try {
      pedido = fetch(VOZ_SERVICIO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t })
      });
    } catch (e) { hablarSistema(t); return; }

    pedido.then(function (r) {
      if (!r.ok) throw new Error("voz " + r.status);
      return r.blob();
    }).then(function (b) {
      if (!b || b.size < 512) throw new Error("audio vacio");
      var url = URL.createObjectURL(b);
      audioVoz = new Audio(url);
      audioVoz.onended = function () { try { URL.revokeObjectURL(url); } catch (e) {} };
      return audioVoz.play();
    }).catch(function () {
      audioVoz = null;
      hablarSistema(t);
    });
  }

  function callar() {
    if (audioVoz) {
      try { audioVoz.pause(); audioVoz.currentTime = 0; } catch (e) {}
      audioVoz = null;
    }
    if ("speechSynthesis" in window) try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  /* ---------- Reconocimiento de voz (entrada) ----------
     En iPhone el dictado del navegador no funciona: Safari expone el objeto
     pero falla en silencio, y Chrome en iOS corre sobre el mismo motor, asi
     que tampoco. El boton se encendia y no pasaba nada, porque el error se
     estaba tragando sin avisar.

     Ahora: si el equipo es iPhone o iPad, el boton lleva directo al teclado y
     explica que use el microfono del teclado, que en iOS si dicta y ademas lo
     hace bien en espanol. En computador todo sigue igual, y si el dictado
     falla o no responde en seis segundos, avisa en vez de quedarse mudo. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var ES_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var relojMic = null;

  function pararMic() {
    recognizing = false;
    if (relojMic) { clearTimeout(relojMic); relojMic = null; }
    var b = $("als-mic"); if (b) b.classList.remove("rec");
  }

  function initRecog() {
    if (!SR) return null;
    var r = new SR();
    r.lang = "es-CO"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onstart = function () {
      recognizing = true;
      $("als-mic").classList.add("rec");
      /* Si en seis segundos no llego ni una palabra, algo lo esta bloqueando. */
      relojMic = setTimeout(function () {
        if (!recognizing) return;
        try { r.stop(); } catch (e) {}
        pararMic();
        dictadoManual("No alcancé a oírla. Escriba su pregunta o use el micrófono del teclado.");
      }, 6000);
    };
    r.onend = pararMic;
    r.onerror = function (e) {
      pararMic();
      var causa = (e && e.error) || "";
      if (causa === "not-allowed" || causa === "service-not-allowed") {
        dictadoManual("El navegador no me dio permiso para el micrófono. Actívelo en la barra de direcciones, o escriba su pregunta.");
      } else if (causa === "no-speech") {
        dictadoManual("No escuché nada. Inténtelo otra vez o escriba su pregunta.");
      } else {
        dictadoManual("El dictado no está disponible en este navegador. Escriba su pregunta o use el micrófono del teclado.");
      }
    };
    r.onresult = function (e) {
      if (relojMic) { clearTimeout(relojMic); relojMic = null; }
      var t = "";
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      $("als-in").value = t; autosize($("als-in"));
      if (e.results[e.results.length - 1].isFinal) { setTimeout(function () { enviar(); }, 250); }
    };
    return r;
  }

  /* Deja el cursor puesto en el campo y abre el teclado: en iPhone el
     microfono del teclado dicta perfecto y no depende del navegador. */
  function dictadoManual(mensaje) {
    var campo = $("als-in");
    if (campo) { try { campo.focus(); campo.click(); } catch (e) {} }
    if (mensaje) pintarError(mensaje);
  }

  function toggleMic() {
    if (ES_IOS) {
      dictadoManual("En iPhone y iPad el dictado va por el teclado: toque el micrófono que aparece junto a la barra espaciadora.");
      return;
    }
    if (!SR) {
      dictadoManual("Este navegador no dicta por voz. Escriba su pregunta, o abra el tablero en Chrome desde el computador.");
      return;
    }
    if (recognizing) { try { recog.stop(); } catch (e) {} pararMic(); return; }
    callar();
    if (!recog) recog = initRecog();
    try { recog.start(); } catch (e) { pararMic(); dictadoManual("No pude abrir el micrófono. Escriba su pregunta."); }
  }

  /* ---------- Utilidades de UI ---------- */
  function autosize(el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 96) + "px"; }
  function scrollAbajo() { body.scrollTop = body.scrollHeight; }

  function mdLite(s) {
    s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // listas con guion
    var lineas = s.split("\n"), out = [], enLista = false;
    for (var i = 0; i < lineas.length; i++) {
      var m = /^\s*[-•]\s+(.*)/.exec(lineas[i]);
      if (m) { if (!enLista) { out.push("<ul>"); enLista = true; } out.push("<li>" + m[1] + "</li>"); }
      else { if (enLista) { out.push("</ul>"); enLista = false; } out.push(lineas[i]); }
    }
    if (enLista) out.push("</ul>");
    return out.join("\n").replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
  }

  function msgUsuario(txt) {
    var d = document.createElement("div");
    d.className = "als-msg u"; d.textContent = txt; body.appendChild(d); scrollAbajo();
  }
  function msgAsistente(txt, spec, fuente) {
    var d = document.createElement("div");
    d.className = "als-msg a";
    d.innerHTML = mdLite(txt || "");
    if (fuente) { var f = document.createElement("div"); f.className = "als-src"; f.innerHTML = "Fuente: " + mdLite(fuente); d.appendChild(f); }
    body.appendChild(d);
    if (spec) { try { renderGrafica(d, spec); } catch (e) { /* si falla, se ignora la grafica */ } }
    scrollAbajo();
    return d;
  }
  function typing(on) {
    var t = $("als-typing");
    if (on && !t) { t = document.createElement("div"); t.className = "als-typing"; t.id = "als-typing"; t.innerHTML = "<i></i><i></i><i></i>"; body.appendChild(t); scrollAbajo(); }
    else if (!on && t) t.remove();
  }
  function pintarError(m) { msgAsistente(m); }

  /* ---------- Render de graficas con estilo de marca ---------- */
  function renderGrafica(cont, spec) {
    if (!window.Chart || !spec || !spec.etiquetas || !spec.series) return;
    var box = document.createElement("div"); box.className = "als-chartbox";
    if (spec.titulo) { var ct = document.createElement("div"); ct.className = "ct"; ct.textContent = spec.titulo; box.appendChild(ct); }
    var wrap = document.createElement("div"); wrap.className = "als-chartwrap";
    var cv = document.createElement("canvas"); wrap.appendChild(cv); box.appendChild(wrap);
    if (spec.fuente) { var cf = document.createElement("div"); cf.className = "cf"; cf.textContent = "Fuente: " + spec.fuente; box.appendChild(cf); }
    cont.appendChild(box);

    var tipo = (spec.tipo || "barras").toLowerCase();
    var unidad = spec.unidad || "";
    var fmt = function (v) { return nEs(v) + (unidad === "%" ? "%" : ""); };

    var cfg;
    if (tipo === "doughnut" || tipo === "dona" || tipo === "torta") {
      var vals = spec.series[0].datos, tot = vals.reduce(function (a, b) { return a + (+b || 0); }, 0);
      cfg = {
        type: "doughnut",
        data: { labels: spec.etiquetas, datasets: [{ data: vals, backgroundColor: spec.etiquetas.map(function (_, i) { return SERIE[i % SERIE.length]; }), borderColor: "#fff", borderWidth: 2 }] },
        options: baseOpc(false),
      };
      cfg.options.cutout = "58%";
      cfg.options.plugins.legend = { position: "bottom", labels: { boxWidth: 11, font: { size: 11 }, padding: 10 } };
      cfg.options.plugins.datalabels = { display: true, color: "#fff", font: { size: 11, weight: "700" },
        formatter: function (v) { return tot ? Math.round(v / tot * 100) + "%" : v; } };
    } else if (tipo === "lineas" || tipo === "linea" || tipo === "line") {
      cfg = { type: "line",
        data: { labels: spec.etiquetas, datasets: spec.series.map(function (s, i) {
          var c = SERIE[i % SERIE.length];
          return { label: s.nombre || "", data: s.datos, borderColor: c, backgroundColor: hex2rgba(c, .08),
                   fill: true, tension: .35, borderWidth: 2.4, pointRadius: 3, pointBackgroundColor: c }; }) },
        options: baseOpc(spec.series.length > 1) };
      ejeY(cfg, unidad);
    } else if (tipo === "radar") {
      cfg = { type: "radar",
        data: { labels: spec.etiquetas, datasets: spec.series.slice(0, 3).map(function (s, i) {
          var c = SERIE[i % SERIE.length];
          return { label: s.nombre || "", data: s.datos, borderColor: c, backgroundColor: hex2rgba(c, .18), borderWidth: 2, pointBackgroundColor: c }; }) },
        options: baseOpc(spec.series.length > 1) };
      cfg.options.scales = { r: { angleLines: { color: "rgba(11,27,43,.08)" }, grid: { color: "rgba(11,27,43,.08)" }, pointLabels: { font: { size: 10 } }, ticks: { display: false } } };
    } else {
      var horiz = (tipo === "barras_h" || tipo === "barras_horizontal" || tipo === "ranking" || tipo === "horizontal");
      var una = spec.series.length === 1;
      cfg = { type: "bar",
        data: { labels: spec.etiquetas, datasets: spec.series.map(function (s, i) {
          var col;
          if (una) { var mx = Math.max.apply(null, s.datos.map(Number)); col = s.datos.map(function (v) { return (+v === mx) ? PAL.gold : PAL.teal; }); }
          else col = SERIE[i % SERIE.length];
          return { label: s.nombre || "", data: s.datos, backgroundColor: col, borderRadius: 4, barPercentage: .78, categoryPercentage: .74 }; }) },
        options: baseOpc(!una) };
      if (horiz) cfg.options.indexAxis = "y";
      cfg.options.plugins.datalabels = {
        display: true, anchor: "end", align: "end", clamp: true, offset: 2,
        color: PAL.navy, font: { size: 10.5, weight: "700" }, formatter: fmt
      };
      cfg.options.layout = { padding: horiz ? { right: 34 } : { top: 22 } };
      ejeY(cfg, unidad, horiz);
    }
    new window.Chart(cv.getContext("2d"), cfg);
  }
  function baseOpc(legend) {
    return { responsive: true, maintainAspectRatio: false,
      plugins: { legend: legend ? { position: "bottom", labels: { boxWidth: 11, font: { size: 11 }, padding: 10 } } : { display: false },
                 datalabels: { display: false },
                 tooltip: { callbacks: { label: function (c) { var v = c.parsed.y != null ? c.parsed.y : (c.parsed.x != null ? c.parsed.x : c.parsed); return (c.dataset.label ? c.dataset.label + ": " : "") + nEs(v); } } } },
      scales: {} };
  }
  function ejeY(cfg, unidad, horiz) {
    var val = { beginAtZero: true, grid: { color: "rgba(11,27,43,.06)" }, ticks: { font: { size: 10 }, callback: function (v) { return nEs(v) + (unidad === "%" ? "%" : ""); } } };
    var cat = { grid: { display: false }, ticks: { font: { size: 10 } } };
    if (horiz) { cfg.options.scales.x = val; cfg.options.scales.y = cat; }
    else { cfg.options.scales.y = val; cfg.options.scales.x = cat; }
  }
  function hex2rgba(h, a) { var n = parseInt(h.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }

  /* ---------- Instruccion de sistema ---------- */
  function sistema() {
    return (window.LASALLE_KB || "") + "\n\n---\n\nQUIEN ERES:\n" +
      "Eres Juana, la asistente virtual de la Universidad de La Salle, inspirada en la mascota de la Universidad. Acompanas a quien consulta el Informe de Prospectiva de la Educacion Superior de la Universidad de La Salle. Tu tono es calido, cercano, amable y humano, fiel al espiritu lasallista de servicio y cercania, pero siempre profesional y claro. Hablas en primera persona como Juana.\n\n" +
      "INSTRUCCIONES DE RESPUESTA:\n" +
      "- Preséntate como Juana solo si te saludan o te preguntan quien eres; no repitas tu nombre en cada respuesta.\n" +
      "- Responde en espanol colombiano, con calidez y sencillez, como alguien que de verdad quiere ayudar. Nunca suenes robotica ni acartonada.\n" +
      "- Apoyate SOLO en la base de conocimiento anterior. Si un dato no esta, dilo con amabilidad y honestidad; nunca inventes cifras.\n" +
      "- Si en la pregunta del usuario aparece un bloque marcado como [DATOS SNIES RELEVANTES PARA ESTA PREGUNTA], tratalo como fuente oficial valida (Registro Nacional SNIES, cierre 2025) y responde con esas cifras; con ese bloque puedes hablar de los programas de cualquier universidad del pais.\n" +
      "- Escribe en frases limpias y naturales. Evita el formato cargado: nada de asteriscos, almohadillas (#), comillas invertidas ni vinetas con simbolos. Si necesitas resaltar algo, hazlo con palabras, no con signos. Recuerda que tu respuesta tambien se lee en voz alta, asi que debe sonar bien hablada.\n" +
      "- Usa formato de numeros en espanol (coma decimal, punto de miles). Cuando cites una cifra, menciona la fuente si aparece en la base, de forma natural dentro de la frase.\n" +
      "- Se breve y calida: 2 a 5 frases salvo que pidan detalle.\n" +
      "- Sin guiones largos (em-dash).\n" +
      "- Cuando el usuario pida una grafica, un grafico, comparar visualmente o 'muestrame', incluye al final un bloque exactamente asi:\n" +
      "```grafica\n{\"tipo\":\"barras|barras_h|doughnut|lineas|radar\",\"titulo\":\"...\",\"etiquetas\":[\"...\"],\"series\":[{\"nombre\":\"...\",\"datos\":[num,...]}],\"unidad\":\"%\" o \"\",\"fuente\":\"...\"}\n```\n" +
      "  Reglas de la grafica: usa 'barras' para comparaciones verticales, 'barras_h' para rankings, 'doughnut' para participacion o composicion, 'lineas' para series de tiempo o tendencias, 'radar' para perfiles multivariable (max 3 series). Usa solo datos reales de la base. Antes o despues del bloque escribe 1 o 2 frases de lectura del dato. No expliques el JSON.\n" +
      "- Si no piden grafica, no incluyas ningun bloque de codigo.";
  }

  /* ---------- Consulta selectiva al registro SNIES (envia solo la universidad relevante) ---------- */
  function snNorm(s){ return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ ]/g, " "); }
  var SNIES_KW = ["programa","oferta","carrera","pregrado","posgrado","maestria","doctorado","especializacion","tecnologico","tecnologia","tecnico","universidad","facultad","matricula","matriculados","ingreso","cerrado","inactivo","activos","acreditad","snies"];
  function contextoSNIES(preg){
    if (!window.SNIES_INST || !window.SNIES_INST.length) return "";
    var q = snNorm(preg), pal = {};
    q.split(/\s+/).forEach(function(w){ if (w.length >= 4) pal[w] = 1; });
    var matches = [];
    window.SNIES_INST.forEach(function(inst){
      var score = 0, dist = false;
      (inst.k || []).forEach(function(t){ if (pal[t]) { score++; if (t.length >= 4) dist = true; } });
      if (score > 0) matches.push({ t: inst.t, nn: inst.nn, score: score, dist: dist });
    });
    matches.sort(function(a, b){ return b.score - a.score; });
    var buenos = matches.filter(function(m){ return m.dist || m.score >= 2; });
    var esProg = SNIES_KW.some(function(k){ return q.indexOf(k) >= 0; });
    if (buenos.length){
      var out = "", n = 0;
      for (var i = 0; i < buenos.length && n < 4; i++){
        var blk = buenos[i].t;
        if (window.SNIES_MATRICULADOS && buenos[i].nn && window.SNIES_MATRICULADOS[buenos[i].nn]) blk += "\n" + window.SNIES_MATRICULADOS[buenos[i].nn];
        if (out.length + blk.length > 60000) break;
        out += (out ? "\n\n" : "") + blk; n++;
      }
      return out + "\n\n(Fuente: Registro Nacional de Programas y Matriculados SNIES, cierre 2025.)";
    }
    if (esProg && window.SNIES_RESUMEN){
      return window.SNIES_RESUMEN + "\n\n(Si necesitas el detalle de una universidad puntual, pregunta por su nombre. Fuente: SNIES, cierre 2025.)";
    }
    return "";
  }

  /* ---------- Llamada a Gemini ---------- */
  function llamarGemini(onOK, onErr) {
    var key = get(LS.key, ""), model = get(LS.model, MODELO_DEF);
    if (!BACKEND_URL && !key) { onErr("SINKEY"); return; }
    var contents = historial.map(function (h) { return { role: h.role, parts: [{ text: h.text }] }; });
    try {
      for (var _i = contents.length - 1; _i >= 0; _i--) {
        if (contents[_i].role === "user") {
          var _ctx = contextoSNIES(contents[_i].parts[0].text);
          if (_ctx) contents[_i].parts.push({ text: "\n\n[DATOS SNIES RELEVANTES PARA ESTA PREGUNTA]\n" + _ctx });
          break;
        }
      }
    } catch (e) {}
    var payload = {
      systemInstruction: { parts: [{ text: sistema() }] },
      contents: contents,
      generationConfig: { temperature: 0.55, maxOutputTokens: 1400 }
    };
    var url, opts;
    if (BACKEND_URL) {
      payload.model = model;
      url = BACKEND_URL;
      opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    } else {
      url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    }
    fetch(url, opts)
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          var m = res.j && res.j.error && res.j.error.message ? res.j.error.message : ("Error " + res.status);
          onErr(m); return;
        }
        var c = res.j.candidates && res.j.candidates[0];
        var txt = c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ""; }).join("") : "";
        if (!txt) { onErr("La respuesta llego vacia. Intenta reformular la pregunta."); return; }
        onOK(txt);
      })
      .catch(function (e) { onErr("No se pudo conectar con Gemini. Revisa tu conexion. " + (e && e.message ? e.message : "")); });
  }

  /* ---------- Parseo de la grafica en la respuesta ---------- */
  function extraerGrafica(txt) {
    var re = /```grafica\s*([\s\S]*?)```/i;
    var m = re.exec(txt);
    if (!m) return { texto: txt, spec: null };
    var spec = null;
    try { spec = JSON.parse(m[1].trim()); } catch (e) {
      try { spec = JSON.parse(m[1].trim().replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")); } catch (e2) { spec = null; }
    }
    var texto = txt.replace(m[0], "").trim();
    return { texto: texto, spec: spec };
  }

  /* ---------- Envio ---------- */
  var enviando = false;
  function enviar() {
    var el = $("als-in"), txt = el.value.trim();
    if (!txt || enviando) return;
    if (!BACKEND_URL && !get(LS.key, "")) { abrirCfg(true); return; }
    callar();
    msgUsuario(txt);
    historial.push({ role: "user", text: txt });
    el.value = ""; autosize(el);
    enviando = true; typing(true);
    llamarGemini(function (out) {
      typing(false); enviando = false;
      var p = extraerGrafica(out);
      var fuente = null; // la fuente ya va dentro del texto/grafica
      historial.push({ role: "model", text: out });
      msgAsistente(p.texto, p.spec, fuente);
      hablar(limpiarParaVoz(p.texto));
    }, function (err) {
      typing(false); enviando = false;
      if (err === "SINKEY") { abrirCfg(true); return; }
      var ayuda = "";
      if (/API key not valid|API_KEY_INVALID|invalid/i.test(err)) ayuda = " Revisa la clave en Configuracion.";
      else if (/not found|is not found|NOT_FOUND|404/i.test(err)) ayuda = " El modelo no existe para tu clave. Cambia el modelo en Configuracion (por ejemplo gemini-2.5-flash o gemini-flash-latest).";
      else if (/quota|RESOURCE_EXHAUSTED|429/i.test(err)) ayuda = " Superaste la cuota de tu clave por ahora.";
      msgAsistente("No pude responder. " + err + ayuda);
    });
  }
  function limpiarParaVoz(t) {
    return (t || "")
      .replace(/```[\s\S]*?```/g, " ")        // bloques de codigo/grafica
      .replace(/`([^`]*)`/g, "$1")            // codigo en linea
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // enlaces markdown -> texto
      .replace(/https?:\/\/\S+/g, " ")        // urls sueltas
      .replace(/[*_#>`~|]/g, " ")             // simbolos de markdown
      .replace(/^\s*[-•]\s+/gm, "")           // vinetas al inicio de linea
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /* ---------- Bienvenida y chips ---------- */
  var CHIPS = [
    "Resume el diagnostico de La Salle en 3 puntos",
    "Grafica la matricula de La Salle por plaza",
    "Compara TIC de La Salle contra el pais",
    "Grafica la supervivencia de programas por nivel",
    "Que dice el tablero sobre el futuro del trabajo?"
  ];
  function bienvenida() {
    if (body.childElementCount) return;
    var d = document.createElement("div"); d.className = "als-msg a";
    d.innerHTML = '<img class="als-juana-hero" src="juana.png" alt="Juana" onerror="this.style.display=\'none\'">' +
      "<b>Hola, soy Juana</b>, tu asistente para explorar el Informe de Prospectiva de la Universidad de La Salle. Pregúntame con confianza sobre el entorno de la educación superior, el mercado, los territorios o el portafolio de la Universidad. Si quieres, también te armo una gráfica con los datos del informe. Puedes escribirme o hablarme con el micrófono.";
    body.appendChild(d);
    var ch = document.createElement("div"); ch.className = "als-chips";
    CHIPS.forEach(function (c) {
      var b = document.createElement("button"); b.className = "als-chip"; b.textContent = c;
      b.onclick = function () { $("als-in").value = c; enviar(); };
      ch.appendChild(b);
    });
    body.appendChild(ch);
    if (!BACKEND_URL && !get(LS.key, "")) {
      var w = document.createElement("div"); w.className = "als-msg a";
      w.innerHTML = "Antes de empezar, abre la <b>configuración</b> (el engranaje de arriba) y pega tu clave de Google Gemini. Se guarda solo en este navegador.";
      body.appendChild(w);
    }
    scrollAbajo();
  }

  /* ---------- Configuracion ---------- */
  function abrirCfg(show) {
    $("als-key").value = get(LS.key, "");
    $("als-mdl").value = get(LS.model, MODELO_DEF);
    $("als-cfgerr").textContent = "";
    $("als-cfg").classList.toggle("show", show !== false);
  }
  function guardarCfg() {
    var k = $("als-key").value.trim(), m = $("als-mdl").value.trim() || MODELO_DEF;
    set(LS.key, k); set(LS.model, m);
    $("als-cfg").classList.remove("show");
    if (k && body.querySelectorAll(".als-msg").length) {
      // quitar aviso de "pega tu clave" si estaba
    }
    if (!body.childElementCount) bienvenida();
  }

  /* ---------- Eventos ---------- */
  function abrir() { panel.classList.add("open"); btn.style.display = "none"; bienvenida(); setTimeout(function () { $("als-in").focus(); }, 100); }
  function cerrar() { panel.classList.remove("open"); btn.style.display = "flex"; callar(); if (recognizing) try { recog.stop(); } catch (e) {} }

  btn.onclick = abrir;
  $("als-x").onclick = cerrar;
  $("als-send").onclick = enviar;
  $("als-mic").onclick = toggleMic;
  $("als-cfgbtn").onclick = function () { abrirCfg(true); };
  $("als-savecfg").onclick = guardarCfg;
  $("als-voz").onclick = function () { vozOut = !vozOut; set(LS.voz, vozOut ? "1" : "0"); pintarVoz(); if (!vozOut) callar(); };
  var inp = $("als-in");
  inp.addEventListener("input", function () { autosize(inp); });
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });

  // ocultar el mic si el navegador no lo soporta
  if (!SR) { $("als-mic").style.display = "none"; }
})();
