/*  Lectura de cifras en espanol.
 *  Un asistente de prospectiva dice numeros en casi cada respuesta. Si los
 *  deletrea mal -"uno punto quinientos mil" en vez de "un millon quinientos
 *  mil"- pierde la autoridad en la primera frase. Aqui se convierten a
 *  palabras antes de mandarlos a sintetizar.
 */
const UNI = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve",
  "diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve",
  "veinte","veintiuno","veintidos","veintitres","veinticuatro","veinticinco","veintiseis",
  "veintisiete","veintiocho","veintinueve"];
const DEC = ["","","","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
const CEN = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos",
  "seiscientos","setecientos","ochocientos","novecientos"];

function menor100(n) {
  if (n < 30) return UNI[n];
  const d = Math.floor(n / 10), u = n % 10;
  return u === 0 ? DEC[d] : DEC[d] + " y " + UNI[u];
}
function menor1000(n) {
  if (n < 100) return menor100(n);
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  return CEN[c] + (r ? " " + menor100(r) : "");
}
/* "un" apocopado antes de mil y millon; "uno" cuando queda al final. */
function apocope(t) { return t.replace(/\buno$/, "un"); }

function enPalabras(n) {
  if (!isFinite(n)) return "";
  if (n < 0) return "menos " + enPalabras(-n);
  if (n < 1000) return menor1000(n);
  if (n < 1000000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const cab = m === 1 ? "mil" : apocope(menor1000(m)) + " mil";
    return cab + (r ? " " + menor1000(r) : "");
  }
  if (n < 1e12) {
    const m = Math.floor(n / 1e6), r = n % 1e6;
    const cab = m === 1 ? "un millon" : apocope(enPalabras(m)) + " millones";
    return cab + (r ? " " + enPalabras(r) : "");
  }
  const m = Math.floor(n / 1e12), r = n % 1e12;
  const cab = m === 1 ? "un billon" : apocope(enPalabras(m)) + " billones";
  return cab + (r ? " " + enPalabras(r) : "");
}
/* Un analista dice "seis coma ochenta y tres", no "seis coma ocho tres".
   Con uno o dos decimales se lee como numero; de tres en adelante, digito a
   digito, que es como se leen los codigos y las series. */
function decimales(s) {
  if (s.length <= 2) return menor100(parseInt(s, 10));
  return s.split("").map(d => UNI[Number(d)]).join(" ");
}
function cifra(entero, decimal) {
  const e = enPalabras(parseInt(entero.replace(/\./g, ""), 10));
  return decimal ? e + " coma " + decimales(decimal) : e;
}

export function leerCifras(texto) {
  let t = " " + texto + " ";

  /* 1. Dinero: $1.500.000 · $ 690.000 · COP 3.500.000 */
  t = t.replace(/(?:\$|COP\s*)\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(\s+(?:mil\s+)?(?:millones|billones|mill(?:o|\u00f3)n|bill(?:o|\u00f3)n))?/gi,
    (_, e, d, mag) => mag ? cifra(e, d) + mag + " de pesos" : cifra(e, d) + " pesos");

  /* 2. Rangos de anos: 2026-2030 · 2026–2031 */
  t = t.replace(/\b((?:19|20)\d{2})\s?[-–—]\s?((?:19|20)\d{2})\b/g,
    (_, a, b) => "de " + enPalabras(+a) + " a " + enPalabras(+b));

  /* 3. Porcentajes, con o sin decimales y con el signo pegado o separado */
  t = t.replace(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s?%/g,
    (_, e, d) => cifra(e, d) + " por ciento");

  /* 4. Numeros con separador de miles: 433.678 */
  t = t.replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g, m => {
    const p = m.split(",");
    return cifra(p[0], p[1]);
  });

  /* 5. Decimales sueltos: 4,8 */
  t = t.replace(/\b(\d+),(\d+)\b/g, (_, e, d) => cifra(e, d));

  /* 6. Enteros sueltos. Los de cuatro cifras que parecen ano se dicen igual
        -"dos mil treinta"-, que es como se leen en espanol. */
  t = t.replace(/\b\d+\b/g, m => (m.length > 15 ? m : enPalabras(parseInt(m, 10))));

  /* 7. Simbolos que quedan sueltos */
  t = t.replace(/\s%/g, " por ciento").replace(/\s\$/g, " pesos ");

  /* "cuarenta y un procesos", no "cuarenta y uno procesos": delante de un
     sustantivo el numero se apocopa. Pero no delante de una preposicion o un
     verbo -"treinta y uno con", "veintiuno menos"-, asi que esas se excluyen. */
  const NO_APOCOPA = "con|de|del|y|o|u|a|al|en|por|para|que|mas|menos|sobre|entre|hasta|" +
    "desde|segun|sin|ante|tras|coma|es|son|fue|fueron|era|eran|sera|seran|frente|" +
    "durante|contra|como|cuando|donde|si|no|ya|tambien|pero";
  const corte = new RegExp("\\b(veinti)?uno\\b(?=\\s+(?!(?:" + NO_APOCOPA + ")\\b)[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])", "gi");
  t = t.replace(corte, (m, v) => (v ? "veintiun" : "un"));

  return t.trim().replace(/\s{2,}/g, " ");
}
