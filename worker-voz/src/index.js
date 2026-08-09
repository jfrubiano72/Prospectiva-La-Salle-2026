/*  VISORIA · Worker de voz para Juana · Universidad de La Salle
 *  9 de agosto de 2026
 *
 *  Por que existe: Juana responde en vivo, con texto distinto en cada pregunta,
 *  asi que no se puede pregrabar. Y llamar a ElevenLabs desde el navegador
 *  expondria la clave a cualquiera que abra el codigo fuente. Este Worker se
 *  queda con la clave del lado del servidor y solo devuelve audio.
 *
 *  No toca el Worker acceso-lasalle: es un servicio aparte.
 *
 *  Rutas
 *    POST /voz     {texto}  -> audio/mpeg
 *    GET  /voces            -> catalogo de voces en espanol, para escoger
 *    GET  /salud            -> diagnostico sin gastar creditos
 */

const ORIGENES = [
  "https://jfrubiano72.github.io",
  "https://visoria.com.co",
  "http://localhost:8080"
];

/* Flash cuesta la mitad de creditos que el multilingue y responde en menos de
   un segundo, que es lo que necesita un asistente que conversa. */
const MODELO = "eleven_flash_v2_5";
const FORMATO = "mp3_22050_32";
const TOPE_CARACTERES = 700;   /* el mismo tope que ya aplica el asistente */

/*  Las voces se fijan aqui y no en la configuracion del despliegue: asi se
    puede comparar una contra otra en el momento, sin volver a publicar, y sin
    que nadie de afuera pueda pedir una voz que no esta en esta lista.
    La primera es la que usa Juana si no se pide otra.  */
const VOCES = {
  karly:     "sM4f2a6lmttmqTug8V7W",   /* colombiana, joven, registro profesional */
  lina:      "SnspHxfVcWQjJgnp6SL3",   /* colombiana, mas madura, tono calmado    */
  catalina:  "6Gr4AVmTax1pMJO0lHRK"    /* chilena, joven, la mas usada del catalogo */
};
const VOZ_POR_DEFECTO = "karly";

function cors(origen) {
  const permitido = ORIGENES.includes(origen) ? origen : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(dato, estado, origen) {
  return new Response(JSON.stringify(dato), {
    status: estado || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origen) }
  });
}

/* Clave de cache: mismo texto y misma voz no se vuelven a pagar. Los decanos
   van a preguntar lo mismo varias veces y eso no debe costar dos veces. */
async function clave(texto, voz) {
  const datos = new TextEncoder().encode(voz + "|" + texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://voz-lasalle.interno/a/" + hex, { method: "GET" });
}

export default {
  async fetch(peticion, entorno, contexto) {
    const url = new URL(peticion.url);
    const origen = peticion.headers.get("Origin") || "";

    if (peticion.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origen) });
    }

    if (url.pathname === "/salud") {
      return json({
        ok: true,
        servicio: "voz-lasalle",
        modelo: MODELO,
        voz: VOZ_POR_DEFECTO,
        vocesDisponibles: Object.keys(VOCES),
        clave: entorno.ELEVENLABS_API_KEY ? "configurada" : "FALTA",
        topeCaracteres: TOPE_CARACTERES
      }, 200, origen);
    }

    /* Catalogo, para escoger la voz con datos y no de oido a ciegas. */
    if (url.pathname === "/voces") {
      if (!entorno.ELEVENLABS_API_KEY) return json({ error: "sin clave" }, 500, origen);
      const r = await fetch(
        "https://api.elevenlabs.io/v1/shared-voices?page_size=100&language=es&gender=female",
        { headers: { "xi-api-key": entorno.ELEVENLABS_API_KEY } }
      );
      if (!r.ok) return json({ error: "elevenlabs " + r.status, detalle: await r.text() }, 502, origen);
      const d = await r.json();
      const voces = (d.voices || []).map(v => ({
        id: v.voice_id, nombre: v.name, acento: v.accent, edad: v.age,
        idioma: v.language, descripcion: v.descriptive || v.description,
        caso: v.use_case, muestra: v.preview_url, usos: v.cloned_by_count
      }));
      return json({ total: voces.length, voces }, 200, origen);
    }

    if (url.pathname !== "/voz" || peticion.method !== "POST") {
      return json({ error: "ruta no encontrada" }, 404, origen);
    }
    if (!ORIGENES.includes(origen)) {
      return json({ error: "origen no autorizado" }, 403, origen);
    }
    if (!entorno.ELEVENLABS_API_KEY) {
      return json({ error: "servicio sin configurar" }, 500, origen);
    }

    let cuerpo;
    try { cuerpo = await peticion.json(); } catch (e) { cuerpo = null; }
    const texto = ((cuerpo && cuerpo.texto) || "").toString().trim().slice(0, TOPE_CARACTERES);
    if (!texto) return json({ error: "sin texto" }, 422, origen);

    /* Solo se acepta un nombre de la lista de arriba. Nunca un identificador
       suelto: si alguien pudiera mandar el que quisiera, podria gastar creditos
       con voces que no hemos aprobado. */
    const pedida = ((cuerpo && cuerpo.voz) || "").toString().toLowerCase().trim();
    const nombreVoz = Object.prototype.hasOwnProperty.call(VOCES, pedida) ? pedida : VOZ_POR_DEFECTO;
    const VOZ_ID = VOCES[nombreVoz];

    const cache = caches.default;
    const llave = await clave(texto, VOZ_ID);
    const guardado = await cache.match(llave);
    if (guardado) {
      const r = new Response(guardado.body, guardado);
      Object.entries(cors(origen)).forEach(([k, v]) => r.headers.set(k, v));
      r.headers.set("X-Voz-Cache", "servido");
      r.headers.set("X-Voz", nombreVoz);
      return r;
    }

    const r = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" + VOZ_ID +
      "?output_format=" + FORMATO,
      {
        method: "POST",
        headers: {
          "xi-api-key": entorno.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: texto,
          model_id: MODELO,
          language_code: "es",
          /* Estabilidad alta y estilo bajo: va a decir cifras ante un consejo
             academico, no a actuar. Similitud alta para que no derive. */
          voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.10, use_speaker_boost: true }
        })
      }
    );

    if (!r.ok) {
      return json({ error: "elevenlabs " + r.status, detalle: (await r.text()).slice(0, 400) }, 502, origen);
    }

    const audio = new Response(r.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=2592000"
      }
    });
    contexto.waitUntil(cache.put(llave, audio.clone()));
    const salida = new Response(audio.body, audio);
    Object.entries(cors(origen)).forEach(([k, v]) => salida.headers.set(k, v));
    salida.headers.set("X-Voz-Cache", "generado");
    salida.headers.set("X-Voz", nombreVoz);
    return salida;
  }
};
