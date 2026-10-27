// La web de carmina.circulodeestudiosliterarios.com, en Cloudflare Workers.
//
// Lo que es un archivo (legal/…html) lo sirve Cloudflare tal cual, sin pasar
// por aquí. Lo que no, llega a `fetch`:
//
//   /<carpeta>/  su index.html.
//
//   /         la portada (F8), con `?c=campaña` de los anuncios.
//
//   /a/<código>, /a/?c=<código>   la invitación de Amigos (F5): «Te invito a
//             Carmina», con el nombre y la foto de quien invita sólo si es
//             adulto (lo decide la función invitacion_publica de Supabase, que
//             ni los da de un menor). Con un código que ya cambió, que no vale,
//             sin datos de nadie. Si Supabase no contesta, la invitación sin
//             nombre: el código sirve igual en la app.
//
//   /t/<id>   la página de una traducción compartida (F1e, «Cambios del 9 de
//             octubre»): el latín, la traducción, el sello, «Traducido con
//             Carmina» y «Denunciar». Con las etiquetas Open Graph que leen
//             Facebook y WhatsApp para la vista previa (F1d), que por eso se
//             escriben aquí y no con JavaScript en el navegador. Nunca el
//             nombre ni el @usuario de quien la compartió: el servidor no lo
//             da (`leer_pagina_publica`).
//             Sin fila: 404. Retirada: 410, «Esta página ya no existe.».
//   POST /t/<id>   la denuncia, sin cuenta (`denunciar_pagina`).
//
//   /palabras, /p/<slug>   la palabra del día (27-oct-2026): la portada de
//             las palabras y la página de cada una, con la imagen de
//             Instagram. Ver «La palabra del día», abajo.
//   POST /boletin, /boletin/gracias   la suscripción de la ventana del
//             boletín, a la función `boletin_web`, y adonde lleva el enlace
//             de confirmación. Ver «La ventana del boletín».
//
//   /.well-known/apple-app-site-association   los enlaces universales: un
//             enlace a /t/, /h/ o /a/ abre la app si está instalada (la otra
//             mitad, en `app/ios/Runner/Runner.entitlements`).
//   /.well-known/assetlinks.json   lo mismo en Android, sólo con la huella
//             del certificado de Play en ANDROID_SHA256 (todavía no).
//
// Con `noindex`, en la etiqueta y en la cabecera: fuera de Google. Todas
// menos la portada.
// El aviso de cookies y el Píxel de Meta, sólo con PIXEL_ID (todavía no):
// ver «El aviso de cookies y el Píxel de Meta», abajo.
//
// Las pruebas: `node --test web/worker.test.mjs`.

const ID = /^\/t\/([2-9a-z]{12})\/?$/;
const INVITACION = /^\/a(?:\/([A-Za-z0-9]{8}))?\/?$/;
const CODIGO = /^[A-Za-z0-9]{8}$/;

// El equipo de Apple y el identificador de la app (`DEVELOPMENT_TEAM` y
// `PRODUCT_BUNDLE_IDENTIFIER` del proyecto de Xcode), y el de Android.
const APP_IOS = '2727BML9RF.com.circuloestudiosliterarios.carminaApp';
const APP_ANDROID = 'com.circuloestudiosliterarios.carmina_app';

// «Abrir en Carmina»: el esquema de la app, porque desde la misma web iOS no
// abre el enlace universal (lo lee `app/lib/data/enlaces.dart`).
const ESQUEMA = 'com.circuloestudiosliterarios.carmina://';

const ASOCIACION = JSON.stringify({
  applinks: {
    details: [
      {
        appIDs: [APP_IOS],
        components: [{ '/': '/t/*' }, { '/': '/h/*' }, { '/': '/a/*' }, { '/': '/abrir' }],
      },
    ],
  },
});

function json(cuerpo) {
  return new Response(cuerpo, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}


const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const TEXTOS = {
  es: {
    sello: 'Latín verificado',
    traducido: 'Traducido con Carmina',
    titulo: 'Traducido con Carmina',
    pronto: 'Muy pronto en la App Store y en Google Play.',
    descargar: 'Descargar en App Store',
    abrir: 'Abrir en Carmina',
    denunciar: 'Denunciar',
    motivo: 'Motivo',
    inapropiado: 'Contenido inapropiado',
    plagio: 'No es suya',
    otro: 'Otro motivo',
    detalle: 'Detalle (opcional)',
    enviar: 'Enviar la denuncia',
    gracias: 'Gracias. La revisamos en 48 horas.',
    noExiste: 'Esta página no existe.',
    yaNoExiste: 'Esta página ya no existe.',
    volver: 'Carmina es una aplicación para leer latín y griego.',
    teInvito: 'Te invito a Carmina',
    lema: 'Para leer latín y griego',
    siYaLaTienes: 'Si ya tienes Carmina, ábrela desde aquí para enviarle una solicitud de amistad.',
    invitacionTitulo: 'Tienes una invitación de Amigos',
    invitacionExplica:
      'Carmina es una aplicación para leer latín y griego. Con Amigos compartes tus traducciones con quien tú quieras.',
    tuCodigo: 'Tu código',
    copiar: 'Copiar el código',
    copiado: 'Código copiado',
    paso1: 'Abre <strong>Carmina</strong> y entra con tu cuenta.',
    paso2: 'Ve a <strong>Perfil › Amigos</strong> (si aún no lo usas, actívalo) y toca <strong>Añadir amigo</strong>.',
    paso3: 'En <strong>¿Te mandaron una invitación?</strong>, pega el código o este enlace.',
    noVale: 'Esta invitación ya no es válida.',
    noValeExplica: 'Pide a esa persona su enlace nuevo.',
    sinCodigo: 'A esta invitación le falta el código',
    sinCodigoExplica: 'Pide a quien te invitó que te mande el enlace otra vez, entero.',
    noLaTienes: '¿Aún no tienes Carmina?',
    cookiesTexto:
      'Carmina y el Círculo de Estudios Literarios usan cookies de Meta para saber qué anuncios funcionan y mostrar Carmina a personas interesadas en el latín y el griego.',
    cookiesMas: 'Más información',
    cookiesRechazar: 'Rechazar',
    cookiesAceptar: 'Aceptar',
    cookies: 'Cookies',
    portadaTitulo: 'Carmina es para leer.',
    portadaNota:
      'Latín y griego, el texto entero delante. Tocas cualquier palabra y te dice qué es, de qué viene y qué hace en la frase. Lo que traduzcas lo traduces tú.',
    portadaLinea: 'Latín y griego, el texto entero delante.',
    portadaImagen: 'La lectura en Carmina: el primer canto de la Eneida, con una palabra tocada.',
    privacidad: 'Privacidad',
    condiciones: 'Condiciones',
    soporte: 'Soporte',
    palabraDelDia: 'La palabra del día',
    palabrasLema: 'Una palabra latina o griega cada tres días, como la enseña Carmina.',
    hoy: 'Hoy',
    latin: 'Latín',
    griego: 'Griego',
    todas: 'Todas',
    anteriores: 'Anteriores',
    verPalabra: 'Ver la palabra',
    masPalabras: 'Más palabras',
    verTodas: 'Ver todas',
    sinPalabras: 'Muy pronto, la primera.',
    laProxima: 'La próxima sale el',
    noLaTienesGratis: '¿No la tienes? Descárgala gratis.',
    palabrasApp: 'Toca cualquier palabra de un texto latino o griego y mira cómo se arma.',
    cursos: 'Cursos del Círculo',
    cursosTexto: 'Los cursos del Círculo de Estudios Literarios.',
    verCursos: 'Ver cursos',
    proximaEnTuCorreo: '¿La próxima, en tu correo?',
    recibelaEnTuCorreo: 'Recíbela en tu correo, con las novedades de Carmina y los cursos del Círculo.',
    suscribirme: 'Suscribirme',
    cerrar: 'Cerrar',
    suscribeteTitulo: 'Suscríbete a Carmina',
    suscribeteTexto: 'Recibe novedades, etimologías y palabras, ofertas de cursos y más.',
    bolPalabras: 'Palabras y etimologías',
    bolNovedades: 'Novedades de Carmina',
    tuCorreo: 'Tu correo',
    // **El texto del consentimiento** (TEXTO_DEL_CONSENTIMIENTO, «web-2026-10-27»,
    // en horario-app/supabase/functions/_shared/boletin.ts): si cambia, cambia
    // allí su nombre.
    bolLetra:
      'Al suscribirte confirmas que tienes 18 años o más y aceptas recibir correos de Carmina y del Círculo de Estudios Literarios. Te das de baja con un clic.',
    politica: 'Política de privacidad',
    bolError: 'No se pudo. Revisa tu correo e inténtalo otra vez.',
    bolHechoTitulo: 'Revisa tu correo',
    bolHechoTexto: 'Te mandamos un enlace para confirmar. Sin confirmar, no te escribimos nada más.',
    graciasTitulo: 'Ya estás dentro.',
    graciasTexto: 'Te llegará la próxima palabra, con las novedades de Carmina y los cursos del Círculo.',
    verLasPalabras: 'Ver las palabras',
  },
  it: {
    sello: 'Latino verificato',
    traducido: 'Tradotto con Carmina',
    titulo: 'Tradotto con Carmina',
    pronto: 'Presto su App Store e Google Play.',
    descargar: 'Scarica su App Store',
    abrir: 'Apri in Carmina',
    denunciar: 'Segnala',
    motivo: 'Motivo',
    inapropiado: 'Contenuto inappropriato',
    plagio: 'Non è sua',
    otro: 'Altro motivo',
    detalle: 'Dettaglio (facoltativo)',
    enviar: 'Invia la segnalazione',
    gracias: 'Grazie. La esaminiamo entro 48 ore.',
    noExiste: 'Questa pagina non esiste.',
    yaNoExiste: 'Questa pagina non esiste più.',
    volver: 'Carmina è un’app per leggere il latino e il greco.',
    teInvito: 'Ti invito su Carmina',
    lema: 'Per leggere il latino e il greco',
    siYaLaTienes: 'Se hai già Carmina, aprila da qui per inviare la richiesta di amicizia.',
    invitacionTitulo: 'Hai un invito di Amici',
    invitacionExplica:
      'Carmina è un’app per leggere il latino e il greco. Con Amici condividi le tue traduzioni con chi vuoi.',
    tuCodigo: 'Il tuo codice',
    copiar: 'Copia il codice',
    copiado: 'Codice copiato',
    paso1: 'Apri <strong>Carmina</strong> ed entra con il tuo account.',
    paso2: 'Vai su <strong>Profilo › Amici</strong> (se non lo usi ancora, attivalo) e tocca <strong>Aggiungi amico</strong>.',
    paso3: 'In <strong>Ti hanno mandato un invito?</strong>, incolla il codice o questo link.',
    noVale: 'Questo invito non è più valido.',
    noValeExplica: 'Chiedi a quella persona il suo nuovo link.',
    sinCodigo: 'A questo invito manca il codice',
    sinCodigoExplica: 'Chiedi a chi ti ha invitato di mandarti di nuovo il link, intero.',
    noLaTienes: 'Non hai ancora Carmina?',
    cookiesTexto:
      'Carmina e il Círculo de Estudios Literarios usano cookie di Meta per sapere quali annunci funzionano e mostrare Carmina a persone interessate al latino e al greco.',
    cookiesMas: 'Maggiori informazioni',
    cookiesRechazar: 'Rifiuta',
    cookiesAceptar: 'Accetta',
    cookies: 'Cookie',
    portadaTitulo: 'Carmina è per leggere.',
    portadaNota:
      "Latino e greco, il testo intero davanti. Tocchi una parola qualsiasi e ti dice che cos'è, da dove viene e che cosa fa nella frase. Quello che traduci lo traduci tu.",
    portadaLinea: 'Latino e greco, il testo intero davanti.',
    portadaImagen: "La lettura in Carmina: il primo canto dell'Eneide, con una parola toccata.",
    privacidad: 'Privacy',
    condiciones: 'Condizioni',
    soporte: 'Assistenza',
    palabraDelDia: 'La parola del giorno',
    palabrasLema: 'Una parola latina o greca ogni tre giorni, come la insegna Carmina.',
    hoy: 'Oggi',
    latin: 'Latino',
    griego: 'Greco',
    todas: 'Tutte',
    anteriores: 'Precedenti',
    verPalabra: 'Vedi la parola',
    masPalabras: 'Altre parole',
    verTodas: 'Vedi tutte',
    sinPalabras: 'Presto, la prima.',
    laProxima: 'La prossima esce il',
    noLaTienesGratis: 'Non ce l’hai? Scaricala gratis.',
    palabrasApp: 'Tocca una parola qualsiasi di un testo latino o greco e guarda com’è fatta.',
    cursos: 'Corsi del Círculo',
    cursosTexto: 'I corsi del Círculo de Estudios Literarios.',
    verCursos: 'Vedi i corsi',
    proximaEnTuCorreo: 'La prossima, nella tua email?',
    recibelaEnTuCorreo: 'Ricevila nella tua email, con le novità di Carmina e i corsi del Círculo.',
    suscribirme: 'Iscrivimi',
    cerrar: 'Chiudi',
    suscribeteTitulo: 'Iscriviti a Carmina',
    suscribeteTexto: 'Ricevi novità, etimologie e parole, offerte di corsi e altro.',
    bolPalabras: 'Parole ed etimologie',
    bolNovedades: 'Novità di Carmina',
    tuCorreo: 'La tua email',
    bolLetra:
      'Iscrivendoti confermi di avere almeno 18 anni e accetti di ricevere email da Carmina e dal Círculo de Estudios Literarios. Ti cancelli con un clic.',
    politica: 'Informativa sulla privacy',
    bolError: 'Non è stato possibile. Controlla la tua email e riprova.',
    bolHechoTitulo: 'Controlla la tua email',
    bolHechoTexto: 'Ti abbiamo mandato un link per confermare. Senza conferma, non ti scriviamo altro.',
    graciasTitulo: 'Sei dentro.',
    graciasTexto: 'Ti arriverà la prossima parola, con le novità di Carmina e i corsi del Círculo.',
    verLasPalabras: 'Vedi le parole',
  },
};

function lengua(request) {
  const a = (request.headers.get('accept-language') || '').toLowerCase();
  return a.startsWith('it') ? 'it' : 'es';
}

async function rpc(env, funcion, cuerpo) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON,
      authorization: `Bearer ${env.SUPABASE_ANON}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
}

const ESTILO = `
  :root { color-scheme: light dark;
    --papel:#FCFBF8; --tinta:#1F1B19; --suave:#6B625D; --carmin:#D32B37; --filete:#E7E1D8; --tarjeta:#F4EFE8; }
  @media (prefers-color-scheme: dark) {
    :root { --papel:#16120F; --tinta:#EDE7DF; --suave:#A89E95; --carmin:#E9636E; --filete:#322C26; --tarjeta:#221C17; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--papel); color:var(--tinta); padding:32px 22px;
    font:16.5px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  main { max-width:34rem; margin:0 auto; }
  .marca { color:var(--carmin); font-size:1.6rem; font-weight:700; letter-spacing:.5px;
    font-family:Georgia,"Times New Roman",serif; margin:0 0 22px; text-align:center; }
  h1 { font-size:1.15rem; line-height:1.3; margin:0 0 16px; text-align:center; color:var(--suave); font-weight:600; }
  .imagen { width:100%; height:auto; border-radius:12px; border:1px solid var(--filete); margin:0 0 20px; display:block; }
  .latin { font-family:Georgia,"Times New Roman",serif; font-style:italic; white-space:pre-wrap;
    background:var(--tarjeta); border-radius:12px; padding:16px 18px; margin:0 0 14px; }
  .texto { white-space:pre-wrap; margin:0 0 16px; }
  .sello { display:inline-block; color:var(--carmin); border:1.5px solid var(--carmin); border-radius:999px;
    padding:4px 12px; font-size:.85rem; font-weight:600; margin:0 0 18px; }
  .pie { text-align:center; color:var(--suave); border-top:1px solid var(--filete); padding-top:18px; margin-top:8px; }
  .pie a { color:var(--carmin); font-weight:600; }
  .pie .abrir { font-size:.9rem; }
  .pie .abrir a { font-weight:400; }
  details { margin-top:22px; color:var(--suave); font-size:.92rem; }
  summary { cursor:pointer; }
  form { display:grid; gap:10px; margin-top:12px; }
  select, textarea, button { font:inherit; padding:10px 12px; border-radius:10px; border:1px solid var(--filete);
    background:var(--papel); color:var(--tinta); }
  button { background:var(--carmin); color:#fff; border:0; font-weight:600; min-height:44px; }
  .aviso { text-align:center; color:var(--suave); }`;

// ---------- El aviso de cookies y el Píxel de Meta («Lo común a todas las
// páginas web»; texto de F1e)
//
// Sólo con PIXEL_ID: sin Píxel no hay cookies de nadie y no hay nada que
// aceptar. Con él, la primera vez sale el aviso, con «Rechazar» y «Aceptar»
// iguales; el script de Meta no se pide hasta «Aceptar» —ni la imagen
// <noscript> del Píxel, que lo mandaría sin preguntar—. La elección va en
// una cookie con su versión y su fecha (`1|si|2026-10-09`), seis meses, sin
// cuenta. «Cookies», al pie, vuelve a abrir el aviso; rechazar después de
// aceptar recarga la página, que así se queda sin el Píxel.
//
// Los eventos llevan su `eventID`, para que la Conversions API web (Fase 3)
// los mande con el mismo y Meta los cuente una vez: PageView en todas;
// ViewContent con su categoría en /t/, /h/ y /a/; IrAAppStore al tocar una
// tienda ([data-tienda]); AbrirEnCarmina al tocar «Abrir en Carmina»
// ([data-abrir]).

const VERSION_DEL_AVISO = 1;

const ESTILO_AVISO = `
  .aviso-cookies { position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom, 0px));
    max-width:34rem; margin:0 auto; background:var(--tarjeta); color:var(--tinta); border:1px solid var(--filete);
    border-radius:16px; padding:16px; box-shadow:0 6px 24px rgba(0,0,0,.18); font-size:.92rem; z-index:10; }
  .aviso-cookies p { margin:0 0 12px; text-align:left; color:var(--tinta); }
  .aviso-cookies a { color:var(--carmin); }
  .aviso-botones { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .aviso-botones button { background:var(--papel); color:var(--tinta); border:1.5px solid var(--tinta);
    font-weight:600; min-height:44px; border-radius:999px; }
  .cookies { text-align:center; font-size:.85rem; margin:28px 0 0; }
  .cookies a { color:var(--suave); }
  [hidden] { display:none !important; }`;

const AVISO_JS = `(function () {
  var PIXEL = __PIXEL__, CATEGORIA = __CATEGORIA__, DATOS = __DATOS__, VERSION = ${VERSION_DEL_AVISO};
  function leer() {
    var m = document.cookie.match(/(?:^|;\\s*)carmina_cookies=([^;]*)/);
    if (!m) return null;
    var p = decodeURIComponent(m[1]).split('|');
    return p[0] === String(VERSION) ? p[1] : null;
  }
  function guardar(si) {
    var hoy = new Date().toISOString().slice(0, 10);
    document.cookie = 'carmina_cookies=' + encodeURIComponent(VERSION + '|' + (si ? 'si' : 'no') + '|' + hoy) +
      '; Max-Age=' + 182 * 24 * 3600 + '; Path=/; SameSite=Lax; Secure';
  }
  function id() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  function evento(nombre, datos, propio) {
    if (window.fbq) window.fbq(propio ? 'trackCustom' : 'track', nombre, datos || {}, { eventID: id() });
  }
  // Para la ventana del boletín, que avisa de la suscripción (Lead). Sin
  // «Aceptar» no hay fbq y no sale nada.
  window.carminaEvento = evento;
  var cargado = false;
  function cargar() {
    if (cargado) return;
    cargado = true;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    // Sin la configuración automática (22-oct-2026): con ella el Píxel manda
    // por su cuenta cada botón que se toca, con su texto, y los metadatos de
    // la página. La política promete sólo la visita, «Descargar» y «Abrir en
    // Carmina». Va antes de 'init', como pide Meta.
    window.fbq('set', 'autoConfig', false, PIXEL);
    window.fbq('init', PIXEL);
    evento('PageView');
    if (CATEGORIA) {
      var vista = { content_category: CATEGORIA };
      for (var k in DATOS) vista[k] = DATOS[k];
      evento('ViewContent', vista);
    }
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    if (a.hasAttribute('data-tienda')) evento('IrAAppStore', null, true);
    else if (a.hasAttribute('data-abrir')) evento('AbrirEnCarmina', null, true);
  });
  var aviso = document.getElementById('aviso-cookies');
  function mostrar(si) { aviso.hidden = !si; }
  document.getElementById('aviso-aceptar').onclick = function () { guardar(true); mostrar(false); cargar(); };
  document.getElementById('aviso-rechazar').onclick = function () {
    var antes = cargado; guardar(false); mostrar(false); if (antes) location.reload();
  };
  document.getElementById('aviso-reabrir').onclick = function (e) { e.preventDefault(); mostrar(true); };
  var eleccion = leer();
  if (eleccion === 'si') cargar(); else if (eleccion !== 'no') mostrar(true);
})();`;

/// El aviso, su enlace del pie y su script; nada sin PIXEL_ID. [datos] va
/// con el ViewContent: en la página de una palabra, cuál (`content_ids`).
function avisoDeCookies(env, lang, categoria = '', datos = {}) {
  if (!env.PIXEL_ID) return '';
  const t = TEXTOS[lang];
  const js = AVISO_JS.replace('__PIXEL__', JSON.stringify(String(env.PIXEL_ID)))
    .replace('__CATEGORIA__', JSON.stringify(categoria))
    .replace('__DATOS__', JSON.stringify(datos).replace(/</g, '\\u003c'));
  return `<p class="cookies"><a href="#" id="aviso-reabrir">${t.cookies}</a></p>
<div id="aviso-cookies" class="aviso-cookies" role="dialog" aria-live="polite" hidden>
  <p>${t.cookiesTexto} <a href="/legal/privacidad.html#cookies">${t.cookiesMas}</a></p>
  <div class="aviso-botones"><button type="button" id="aviso-rechazar">${t.cookiesRechazar}</button><button type="button" id="aviso-aceptar">${t.cookiesAceptar}</button></div>
</div>
<style>${ESTILO_AVISO}</style>
<script>${js}</script>`;
}

// **El anuncio de Safari** (Smart App Banner, «Lo común a todas las páginas
// web»): la etiqueta `apple-itunes-app` con el id de Carmina en la App Store
// (APP_STORE_ID). Safari sólo lo enseña si la app está en la tienda; con la
// app instalada dice «Abrir» y le pasa a la app [argumento], la dirección de
// la página, que la app abre (`app/lib/data/enlaces.dart`).
function anuncioDeSafari(env, argumento) {
  if (!env.APP_STORE_ID) return '';
  const extra = argumento ? `, app-argument=${esc(argumento)}` : '';
  return `<meta name="apple-itunes-app" content="app-id=${esc(env.APP_STORE_ID)}${extra}">`;
}

function pagina({ lang, titulo, cabeza = '', cuerpo, aviso = '', indexable = false }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${indexable ? '' : '<meta name="robots" content="noindex">\n'}<title>${esc(titulo)}</title>
${cabeza}
<style>${ESTILO}</style>
</head>
<body>
<main>
<p class="marca">Carmina</p>
${cuerpo}
${aviso}
</main>
</body>
</html>`;
}

function respuesta(html, estado, { indexable = false } = {}) {
  return new Response(html, {
    status: estado,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(indexable ? {} : { 'x-robots-tag': 'noindex' }),
      // Una página retirada no puede quedarse en una caché: dejaría de
      // responder 410.
      'cache-control': 'public, max-age=60',
    },
  });
}

// Las tiendas, cuando la app esté publicada: APP_STORE y GOOGLE_PLAY en las
// variables de `wrangler.jsonc` (la de Google Play, con su `?id=`). Mientras,
// «Muy pronto». Con el enlace de campaña de cada página (`ct=compartir_t`,
// `ct=invitacion_a`): App Analytics cuenta las descargas por origen.
function tiendas(t, env, campana) {
  const enlaces = [];
  if (env.APP_STORE) {
    enlaces.push(`<a data-tienda href="${esc(env.APP_STORE)}?ct=${campana}">${t.descargar}</a>`);
  }
  if (env.GOOGLE_PLAY) {
    enlaces.push(`<a data-tienda href="${esc(env.GOOGLE_PLAY)}&utm_campaign=${campana}">Google Play</a>`);
  }
  return enlaces.length ? enlaces.join(' · ') : t.pronto;
}

function sinPagina(lang, estado) {
  const t = TEXTOS[lang];
  const dice = estado === 410 ? t.yaNoExiste : t.noExiste;
  return respuesta(
    pagina({
      lang,
      titulo: `${dice} — Carmina`,
      cuerpo: `<h1>${dice}</h1>\n<p class="aviso">${t.volver}</p>`,
    }),
    estado,
  );
}

async function paginaDeTraduccion(id, request, env, { aviso } = {}) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  const r = await rpc(env, 'leer_pagina_publica', { p_id: id });
  if (!r.ok) return new Response('', { status: 502 });
  const filas = await r.json();
  const p = Array.isArray(filas) ? filas[0] : null;
  if (!p) return sinPagina(lang, 404);
  if (p.retirada) return sinPagina(lang, 410);

  const url = new URL(request.url);
  const enlace = `${url.origin}/t/${id}`;
  const titulo = p.titulo ? `${p.titulo} · ${t.titulo}` : t.titulo;
  const imagen = p.imagen
    ? `${env.SUPABASE_URL}/storage/v1/object/public/paginas/${p.imagen
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
    : null;
  const cabeza = [
    anuncioDeSafari(env, enlace),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Carmina">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:url" content="${esc(enlace)}">`,
    ...(imagen
      ? [
          `<meta property="og:image" content="${esc(imagen)}">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta name="twitter:card" content="summary_large_image">`,
        ]
      : []),
  ].join('\n');
  const cuerpo = `
<h1>${esc(p.titulo || '')}</h1>
${imagen ? `<img class="imagen" src="${esc(imagen)}" width="1200" height="630" alt="">` : ''}
<p class="latin">${esc(p.latin || '')}</p>
<p class="texto">${esc(p.texto || '')}</p>
<p><span class="sello">✓ ${t.sello}</span></p>
<div class="pie">
  <p>${t.traducido}</p>
  <p>${tiendas(t, env, 'compartir_t')}</p>
  <p class="abrir"><a data-abrir href="${ESQUEMA}t/${id}">${t.abrir}</a></p>
</div>
${
  aviso
    ? `<p class="aviso">${aviso}</p>`
    : `<details>
  <summary>${t.denunciar}</summary>
  <form method="post" action="/t/${id}">
    <label>${t.motivo}
      <select name="motivo">
        <option value="inapropiado">${t.inapropiado}</option>
        <option value="plagio">${t.plagio}</option>
        <option value="otro">${t.otro}</option>
      </select>
    </label>
    <label>${t.detalle}
      <textarea name="detalle" rows="3" maxlength="500"></textarea>
    </label>
    <button type="submit">${t.enviar}</button>
  </form>
</details>`
}`;
  return respuesta(
    pagina({ lang, titulo, cabeza, cuerpo, aviso: avisoDeCookies(env, lang, 'traduccion') }),
    200,
  );
}

// ---------- La invitación de Amigos (F5)

const ESTILO_INVITACION = `
  .invita { text-align:center; }
  .invita h1 { color:var(--tinta); font-size:1.5rem; margin:0 0 6px; text-wrap:balance; }
  .invita .lema { color:var(--suave); margin:0 0 22px; }
  .quien { display:flex; flex-direction:column; align-items:center; gap:10px; margin:0 0 20px; }
  .quien img, .quien .iniciales { width:96px; height:96px; border-radius:50%; object-fit:cover;
    border:1px solid var(--filete); }
  .quien .iniciales { display:flex; align-items:center; justify-content:center; background:var(--tarjeta);
    color:var(--carmin); font:600 2rem/1 Georgia,"Times New Roman",serif; }
  .quien strong { font-size:1.15rem; }
  .boton { display:flex; align-items:center; justify-content:center; min-height:48px; border-radius:999px;
    font-weight:600; text-decoration:none; margin:0 0 12px; }
  .boton.principal { background:var(--carmin); color:#fff; }
  .nota { color:var(--suave); font-size:.92rem; margin:4px 0 24px; }
  .codigo { background:var(--tarjeta); border:1px solid var(--filete); border-radius:14px; padding:16px 18px; margin:0 0 18px; }
  .codigo small { display:block; color:var(--suave); font-size:.8rem; letter-spacing:.06em; text-transform:uppercase; }
  .codigo code { display:block; font:600 1.7rem/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.18em;
    user-select:all; -webkit-user-select:all; margin:4px 0 10px; }
  .codigo button { background:transparent; color:var(--carmin); border:1.5px solid var(--carmin); border-radius:999px; }
  ol { text-align:left; color:var(--suave); padding-left:1.3rem; margin:0 0 24px; }
  ol li { margin-bottom:6px; }
  ol strong { color:var(--tinta); }`;

async function quienInvita(codigo, env) {
  // { valida, nombre?, foto? }, o null si Supabase no contesta.
  try {
    const r = await fetch(`${env.SUPABASE_URL}/functions/v1/invitacion_publica`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON,
        authorization: `Bearer ${env.SUPABASE_ANON}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ codigo }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j.valida === 'boolean' ? j : null;
  } catch {
    return null;
  }
}

function iniciales(nombre) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

async function paginaDeInvitacion(codigo, request, env) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  const url = new URL(request.url);
  if (!codigo || !CODIGO.test(codigo)) {
    return respuesta(
      pagina({
        lang,
        titulo: `${t.sinCodigo} — Carmina`,
        cuerpo: `<div class="invita"><h1>${t.sinCodigo}</h1>\n<p class="lema">${t.sinCodigoExplica}</p></div>
<style>${ESTILO_INVITACION}</style>`,
      }),
      404,
    );
  }
  codigo = codigo.toUpperCase();
  const quien = await quienInvita(codigo, env);
  if (quien && !quien.valida) {
    return respuesta(
      pagina({
        lang,
        titulo: `${t.noVale} — Carmina`,
        cuerpo: `<div class="invita"><h1>${t.noVale}</h1>\n<p class="lema">${t.noValeExplica}</p></div>
<style>${ESTILO_INVITACION}</style>`,
      }),
      410,
    );
  }
  const nombre = quien?.nombre || null;
  const enlace = `${url.origin}/a/${codigo}`;
  const cabeza = [
    anuncioDeSafari(env, enlace),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Carmina">`,
    `<meta property="og:title" content="${esc(t.teInvito)}">`,
    `<meta property="og:description" content="${esc(t.lema)}">`,
    `<meta property="og:url" content="${esc(enlace)}">`,
    `<meta property="og:image" content="${url.origin}/a/invitacion.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n');
  // Un adulto: su foto (o sus iniciales) y su nombre. Un menor o una cuenta
  // sin edad: nada suyo.
  const arriba = nombre
    ? `<div class="quien">${
        quien.foto
          ? `<img src="${esc(quien.foto)}" alt="" width="96" height="96">`
          : `<span class="iniciales" aria-hidden="true">${esc(iniciales(nombre))}</span>`
      }<strong>${esc(nombre)}</strong></div>
<h1>${t.teInvito}</h1>
<p class="lema">${t.lema}</p>`
    : `<h1>${t.invitacionTitulo}</h1>
<p class="lema">${t.invitacionExplica}</p>`;
  const cuerpo = `<div class="invita">
${arriba}
<a class="boton principal" data-abrir href="${ESQUEMA}amigo?c=${codigo}">${t.abrir}</a>
<p class="nota">${t.siYaLaTienes}</p>
<div class="codigo">
  <small>${t.tuCodigo}</small>
  <code id="codigo">${codigo}</code>
  <button type="button" id="copiar">${t.copiar}</button>
</div>
<ol>
  <li>${t.paso1}</li>
  <li>${t.paso2}</li>
  <li>${t.paso3}</li>
</ol>
<div class="pie">
  <p>${t.noLaTienes}</p>
  <p>${tiendas(t, env, 'invitacion_a')}</p>
</div>
</div>
<style>${ESTILO_INVITACION}</style>
<script>
  document.getElementById('copiar').addEventListener('click', (e) => {
    const b = e.currentTarget;
    const seleccionar = () => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('codigo'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(${JSON.stringify(codigo)}).then(() => { b.textContent = ${JSON.stringify(t.copiado)}; }, seleccionar);
    } else {
      seleccionar();
    }
  });
</script>`;
  return respuesta(
    pagina({
      lang,
      titulo: `${nombre ? t.teInvito : t.invitacionTitulo} — Carmina`,
      cabeza,
      cuerpo,
      aviso: avisoDeCookies(env, lang, 'invitacion'),
    }),
    200,
  );
}

// ---------- La portada (F8)
//
// El destino de los anuncios: qué es Carmina en dos líneas —el título y el
// párrafo de A1 del alta—, la lectura (un dibujo con Eneida I, 1–11, de
// `tool/imagenes_de_la_web_test.dart`), la tienda y el aviso de cookies. Cada
// anuncio la enlaza con su campaña, `/?c=verano`, y la tienda la recibe como
// `ct=anuncio_verano`; sin campaña, `ct=portada`. Ésta sí, en Google.

const CAMPANA = /^[a-z0-9_-]{1,30}$/;

const ESTILO_PORTADA = `
  .portada { text-align:center; }
  .portada h1 { color:var(--tinta); font:400 2.1rem/1.15 Georgia,"Times New Roman",serif; margin:4px 0 14px; text-wrap:balance; }
  .portada .nota { color:var(--suave); margin:0 auto 22px; max-width:30rem; }
  .portada img { width:min(78%, 320px); height:auto; display:block; margin:0 auto 22px; }
  .portada .tienda a { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 26px;
    border-radius:999px; background:var(--carmin); color:#fff; font-weight:600; text-decoration:none; margin:4px; }
  .portada .tienda { margin:0 0 8px; }
  .legales { font-size:.85rem; color:var(--suave); margin-top:26px; }
  .legales a { color:var(--suave); }`;

function portada(request, env) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  const url = new URL(request.url);
  const c = (url.searchParams.get('c') || '').toLowerCase();
  const campana = CAMPANA.test(c) ? `anuncio_${c}` : 'portada';
  const cabeza = [
    anuncioDeSafari(env),
    `<meta name="description" content="${esc(t.portadaNota)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Carmina">`,
    `<meta property="og:title" content="${esc(t.portadaTitulo)}">`,
    `<meta property="og:description" content="${esc(t.portadaLinea)}">`,
    `<meta property="og:url" content="${url.origin}/">`,
    `<meta property="og:image" content="${url.origin}/portada.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="canonical" href="${url.origin}/">`,
  ].join('\n');
  const tiendasHtml = env.APP_STORE || env.GOOGLE_PLAY
    ? `<p class="tienda">${tiendas(t, env, campana).split(' · ').join('')}</p>`
    : `<p class="nota">${t.pronto}</p>`;
  const cuerpo = `<div class="portada">
<h1>${t.portadaTitulo}</h1>
<p class="nota">${t.portadaNota}</p>
<img src="/portada/lectura.png" width="720" height="1100" alt="${esc(t.portadaImagen)}">
${tiendasHtml}
<p class="legales"><a href="/legal/privacidad.html">${t.privacidad}</a> · <a href="/legal/condiciones.html">${t.condiciones}</a> · <a href="/legal/soporte.html">${t.soporte}</a><br>Círculo de Estudios Literarios</p>
</div>
<style>${ESTILO_PORTADA}</style>`;
  return respuesta(
    pagina({
      lang,
      titulo: `Carmina — ${t.portadaTitulo}`,
      cabeza,
      cuerpo,
      aviso: avisoDeCookies(env, lang),
      indexable: true,
    }),
    200,
    { indexable: true },
  );
}

// ---------- La palabra del día (27-oct-2026)
//
// Cada tres días, una palabra en Instagram con su imagen —la pantalla de la
// app con la palabra tocada, que dibuja `tool/palabra_del_dia_test.dart`— y,
// en la bio, un enlace fijo a /palabras?c=ig. Sin página intermedia de nadie
// (David preguntó por la de Sprout): el Píxel, las cuentas y Google son de
// aquí.
//
//   /palabras   la más nueva en grande y las anteriores, con su filtro
//               (`?lengua=latin|griego`).
//   /p/<slug>   una palabra: su imagen y una línea con lo mismo en texto
//               —Google no lee imágenes; nada que no esté en la base—, y
//               «Abrir en Carmina».
//
// Los datos son archivos de la web que deja el generador: `palabras/
// indice.json` y, por palabra, `palabras/<slug>.png` (1080 × 1350, la de
// Instagram) y `palabras/<slug>-m.png` (la miniatura). Una palabra con
// `fecha` futura todavía no existe: se suben en lote y cada una sale el día
// que le toca. Las dos páginas, en Google.

const PALABRA = /^\/p\/([a-z0-9-]{1,40})\/?$/;
const LENGUAS = ['latin', 'griego'];

/// Las palabras ya publicadas, la más nueva primero, y la próxima por salir
/// (o null). Sin índice, ninguna.
async function lasPalabras(request, env) {
  const url = new URL(request.url);
  url.pathname = '/palabras/indice.json';
  url.search = '';
  let todas = [];
  try {
    const r = await env.ASSETS.fetch(new Request(url));
    if (r.ok) {
      const j = await r.json();
      todas = (Array.isArray(j?.palabras) ? j.palabras : []).filter(
        (p) =>
          p &&
          /^[a-z0-9-]{1,40}$/.test(p.slug) &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) &&
          LENGUAS.includes(p.lengua),
      );
    }
  } catch {
    todas = [];
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const publicadas = todas
    .filter((p) => p.fecha <= hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const proxima = todas.filter((p) => p.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  return { publicadas, proxima: proxima || null, hoy };
}

/// El campo [campo] de la palabra en la lengua de la página: el italiano, si
/// lo trae (`it`), y si no el castellano.
function dePalabra(p, campo, lang) {
  return (lang === 'it' && p.it && p.it[campo]) || p[campo] || '';
}

function fechaLarga(iso, lang) {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

/// **«Abrir en Carmina», para descargarla** (David: «un botón "Abrir en
/// Carmina" para que puedan descargar la aplicación desde ahí»). En el iPhone
/// lleva a la App Store, que dice «Abrir» si ya la tiene. En Android, a la
/// app por su esquema y, si no está, a Google Play (`intent:` con
/// `browser_fallback_url`): un esquema que nadie atiende deja en Safari un
/// error a la vista, y en Android no. En el ordenador, las dos tiendas. Sin
/// tiendas todavía, «Muy pronto».
function botonAbrir(t, env, campana, ruta, ua) {
  if (/iPhone|iPad|iPod/.test(ua) && env.APP_STORE) {
    return `<a class="boton principal" data-tienda href="${esc(env.APP_STORE)}?ct=${campana}">${t.abrir}</a>`;
  }
  if (/Android/.test(ua) && env.GOOGLE_PLAY) {
    const play = `${env.GOOGLE_PLAY}&utm_campaign=${campana}`;
    const esquema = ESQUEMA.replace('://', '');
    const intent = `intent://${ruta}#Intent;scheme=${esquema};package=${APP_ANDROID};S.browser_fallback_url=${encodeURIComponent(play)};end`;
    return `<a class="boton principal" data-tienda href="${esc(intent)}">${t.abrir}</a>`;
  }
  if (env.APP_STORE || env.GOOGLE_PLAY) return `<p class="tienda">${tiendas(t, env, campana)}</p>`;
  return `<p class="nota">${t.pronto}</p>`;
}

/// **Las visitas, sin cookies** (`contar_visita_web`, en Supabase): por día,
/// página y origen (`?c=`), sin la IP ni nada de quien entra. Es la cuenta
/// que vale aunque nadie acepte el aviso. Los robots, y las vistas previas de
/// Facebook y WhatsApp, no cuentan.
const ROBOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview/i;

function contarVisita(request, env, ctx, ruta, origen) {
  if (request.method !== 'GET' || !ctx || typeof ctx.waitUntil !== 'function') return;
  if (ROBOT.test(request.headers.get('user-agent') || '')) return;
  ctx.waitUntil(
    rpc(env, 'contar_visita_web', { p_ruta: ruta, p_origen: origen || null }).catch(() => null),
  );
}

const ESTILO_PALABRAS = `
  .palabras { text-align:left; }
  .palabras h1 { color:var(--tinta); font:400 1.7rem/1.2 Georgia,"Times New Roman",serif; text-align:left; margin:2px 0 20px; text-wrap:balance; }
  .rotulo { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--carmin); margin:0 0 6px; }
  .rotulo.suave { color:var(--suave); }
  .hoy { display:block; background:var(--tarjeta); border-radius:22px; overflow:hidden; color:var(--tinta); text-decoration:none; margin:0 0 28px;
    box-shadow:0 10px 30px rgba(0,0,0,.08); }
  .hoy img, .lamina { width:100%; height:auto; display:block; }
  .lamina { border-radius:18px; margin:0 0 14px; }
  .hoy .pie-hoy { padding:14px 18px 18px; }
  .lema { font:700 1.55rem/1.2 Georgia,"Times New Roman",serif; margin:2px 0; }
  .corto { font-family:Georgia,"Times New Roman",serif; color:var(--suave); margin:0; }
  .cita { font-size:.85rem; color:var(--suave); }
  .ver { font-size:.9rem; font-weight:600; color:var(--carmin); }
  .fila { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin:8px 0 0; }
  .filtro { display:flex; gap:6px; }
  .filtro a { min-height:34px; padding:0 14px; display:inline-flex; align-items:center; border-radius:999px; border:1.5px solid var(--filete);
    color:var(--tinta); text-decoration:none; font-size:.85rem; font-weight:600; }
  .filtro a[aria-current] { background:var(--tinta); color:var(--papel); border-color:var(--tinta); }
  .rejilla { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin:14px 0 28px; }
  .rejilla.tres { grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
  .rejilla a { color:var(--tinta); text-decoration:none; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .rejilla img { width:100%; height:auto; border-radius:14px; display:block; }
  .rejilla .lema { font-size:1.1rem; }
  .rejilla .corto { font-size:.9rem; }
  .rejilla .todas { border:1.5px solid var(--filete); border-radius:14px; align-items:center; justify-content:center; aspect-ratio:4 / 5;
    font-family:Georgia,"Times New Roman",serif; }
  .lengua { font-size:.68rem; letter-spacing:.1em; text-transform:uppercase; font-weight:600; color:var(--suave); }
  .linea { font-family:Georgia,"Times New Roman",serif; margin:0 0 18px; }
  .boton { display:flex; align-items:center; justify-content:center; min-height:52px; border-radius:999px; font-weight:600;
    text-decoration:none; margin:0 0 8px; }
  .boton.principal { background:var(--carmin); color:#fff; }
  .abrir-palabra { text-align:center; margin:0 0 26px; }
  .abrir-palabra .nota { color:var(--suave); font-size:.88rem; margin:0; }
  .tienda a { color:var(--carmin); font-weight:600; }
  .proxima { border:1.5px dashed var(--filete); border-radius:20px; padding:18px; text-align:center; margin:0 0 16px; }
  .proxima p { margin:0; }
  .proxima .cuando { font:italic 1.25rem/1.3 Georgia,"Times New Roman",serif; margin:0 0 4px; }
  .app { display:flex; gap:14px; align-items:center; background:var(--tarjeta); border-radius:20px; padding:16px; margin:0 0 16px; }
  .app .icono { width:56px; height:56px; flex-shrink:0; border-radius:14px; background:var(--carmin); color:#fff; display:flex;
    align-items:center; justify-content:center; font:700 1.9rem/1 Georgia,"Times New Roman",serif; }
  .app p { margin:0 0 4px; font-size:.95rem; }
  .app .boton { min-height:44px; margin:6px 0 0; }
  .cursos { background:var(--tinta); color:var(--papel); border-radius:20px; padding:18px; margin:0 0 8px; }
  .cursos p { margin:0 0 4px; }
  .cursos .rotulo { color:inherit; opacity:.8; }
  .cursos .que { font:1.2rem/1.3 Georgia,"Times New Roman",serif; }
  .cursos a { color:var(--papel); font-weight:600; }
  .legales { font-size:.85rem; color:var(--suave); margin-top:26px; text-align:center; }
  .legales a { color:var(--suave); }`;

// ---------- La ventana del boletín (27-oct-2026)
//
// «Suscríbete a Carmina» (la maqueta, 4b): arriba, «La palabra del día», la
// palabra y su significado; el correo y «Suscribirme», sin casilla —el
// formulario sólo sirve para suscribirse— y debajo el texto del
// consentimiento. Sale sola **una vez y cuando ya leyó** —pasada la imagen o a
// los 20 segundos—, nunca al llegar (en el móvil, Google baja a la página que
// se tapa nada más entrar) ni con el aviso de cookies a la vista. Si se
// cierra, no vuelve sola en 30 días: lo recuerda el navegador
// (`localStorage`), sin cookie y sin mandarlo a nadie. «Suscribirme» en la
// página la abre cuando se quiera.
//
// Manda a POST /boletin, que lo pasa a la función `boletin_web`: ésta apunta
// el consentimiento y pide a Brevo el correo de confirmación.

const ICONOS_BOLETIN = [
  '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7"/><path d="M8 11h5"/>',
  '<path d="M12 3l2.4 5.6L20 9.2l-4.3 3.9 1.2 5.9L12 16.1 7.1 19l1.2-5.9L4 9.2l5.6-.6z"/>',
  '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
];

const ESTILO_BOLETIN = `
  .boletin { position:fixed; inset:0; background:rgba(20,16,14,.6); display:flex; align-items:center; justify-content:center;
    padding:20px 16px; z-index:20; }
  .boletin .ventana { background:var(--papel); color:var(--tinta); border-radius:24px; overflow:hidden; width:100%; max-width:24rem;
    max-height:100%; overflow-y:auto; box-shadow:0 18px 48px rgba(0,0,0,.32); }
  .boletin .banda { position:relative; background:var(--carmin); color:#fff; text-align:center; padding:24px 28px 20px; }
  .boletin .banda p { margin:0; }
  .boletin .rotulo-banda { font-size:.72rem; letter-spacing:.22em; text-transform:uppercase; font-weight:600; }
  .boletin .palabra-banda { font:italic 2.6rem/1.15 Georgia,"Times New Roman",serif; margin:4px 0 0; }
  .boletin .raya { display:block; width:56px; height:1px; background:rgba(255,255,255,.7); margin:8px auto; }
  .boletin .significado-banda { font-family:Georgia,"Times New Roman",serif; }
  .boletin .cerrar { position:absolute; right:10px; top:10px; width:40px; height:40px; min-height:0; padding:0; border-radius:50%;
    background:rgba(255,255,255,.2); color:#fff; font-size:1.3rem; line-height:40px; }
  .boletin .cuerpo-ventana { padding:20px 22px 22px; text-align:center; }
  .boletin h2 { font:700 1.6rem/1.2 Georgia,"Times New Roman",serif; margin:0 0 6px; }
  .boletin .sub { color:var(--suave); margin:0 0 14px; }
  .boletin ul { list-style:none; padding:0; margin:0 0 16px; display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
  .boletin li { background:var(--tarjeta); border-radius:12px; padding:10px 4px; font-size:.75rem; line-height:1.3; color:var(--suave);
    display:flex; flex-direction:column; align-items:center; gap:6px; }
  .boletin li svg { width:22px; height:22px; fill:none; stroke:var(--carmin); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .boletin form { margin:0; gap:10px; }
  .boletin label { display:grid; gap:4px; text-align:left; font-size:.85rem; color:var(--suave); }
  .boletin input { font:inherit; font-size:1rem; padding:12px 14px; border-radius:12px; border:1px solid var(--filete);
    background:var(--papel); color:var(--tinta); min-height:48px; }
  .boletin button[type=submit] { border-radius:999px; min-height:50px; font-size:1.05rem; }
  .boletin .letra { font-size:.75rem; color:var(--suave); margin:12px 0 0; }
  .boletin .letra a { color:var(--suave); }
  .boletin .error { color:var(--carmin); font-size:.85rem; margin:0; }
  .suscribirse { display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--tarjeta);
    border-radius:16px; padding:14px 16px; margin:0 0 26px; }
  .suscribirse span { font-family:Georgia,"Times New Roman",serif; font-size:1.1rem; }
  .suscribirse a, .proxima a { color:var(--carmin); font-weight:600; white-space:nowrap; text-decoration:none; }
  .proxima a { display:inline-flex; align-items:center; min-height:44px; padding:0 26px; margin-top:10px; border-radius:999px;
    background:var(--carmin); color:#fff; }`;

const BOLETIN_JS = `(function () {
  var v = document.getElementById('boletin');
  if (!v) return;
  var CLAVE = 'carmina_boletin', TREINTA = 30 * 864e5;
  function cerradaHacePoco() {
    try { var t = +localStorage.getItem(CLAVE); return !!t && Date.now() - t < TREINTA; } catch (e) { return false; }
  }
  function apuntar() { try { localStorage.setItem(CLAVE, String(Date.now())); } catch (e) {} }
  function abrir() { v.hidden = false; var i = v.querySelector('input[type=email]'); if (i) i.focus(); }
  function cerrar() { v.hidden = true; apuntar(); }
  var abridores = document.querySelectorAll('[data-boletin]');
  for (var i = 0; i < abridores.length; i++) {
    abridores[i].addEventListener('click', function (e) { e.preventDefault(); abrir(); });
  }
  v.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  v.addEventListener('click', function (e) { if (e.target === v) cerrar(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !v.hidden) cerrar(); });
  var salio = false;
  function quizas() {
    if (salio || cerradaHacePoco()) return;
    var aviso = document.getElementById('aviso-cookies');
    if (aviso && !aviso.hidden) { setTimeout(quizas, 10000); return; }
    salio = true;
    abrir();
  }
  var leido = document.querySelector('[data-leido]');
  if (leido && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (vistas, o) {
      for (var j = 0; j < vistas.length; j++) {
        if (!vistas[j].isIntersecting && vistas[j].boundingClientRect.top < 0) { o.disconnect(); quizas(); }
      }
    }).observe(leido);
  }
  setTimeout(quizas, 20000);
  var form = v.querySelector('form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var boton = form.querySelector('button[type=submit]');
    var error = v.querySelector('[data-error]');
    boton.disabled = true;
    error.hidden = true;
    function mal() { error.hidden = false; boton.disabled = false; }
    fetch('/boletin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        correo: form.elements.correo.value,
        palabra: form.getAttribute('data-palabra') || null,
        origen: form.getAttribute('data-origen') || null,
        lengua: document.documentElement.lang,
      }),
    }).then(function (r) {
      return r.json().then(function (j) { return r.ok && j && j.ok; }, function () { return false; });
    }).then(function (bien) {
      if (!bien) return mal();
      v.querySelector('[data-formulario]').hidden = true;
      v.querySelector('[data-hecho]').hidden = false;
      apuntar();
      if (window.carminaEvento) window.carminaEvento('Lead', { content_category: 'boletin' });
    }, mal);
  });
})();`;

/// La ventana, cerrada; [p] es la palabra de la página (o la más nueva, en
/// /palabras), y [origen] el `?c=` con que se llegó.
function ventanaDelBoletin(t, lang, p, origen) {
  const banda = p
    ? `<p class="palabra-banda">${esc(dePalabra(p, 'palabra', lang) || dePalabra(p, 'lema', lang))}</p><span class="raya"></span><p class="significado-banda">${esc(dePalabra(p, 'corto', lang))}</p>`
    : '';
  const tres = [t.bolPalabras, t.bolNovedades, t.cursos]
    .map((n, i) => `<li><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS_BOLETIN[i]}</svg>${n}</li>`)
    .join('');
  return `<div id="boletin" class="boletin" role="dialog" aria-modal="true" aria-labelledby="boletin-titulo" hidden>
<div class="ventana">
<div class="banda"><button type="button" class="cerrar" data-cerrar aria-label="${t.cerrar}">×</button>
<p class="rotulo-banda">${t.palabraDelDia}</p>${banda}</div>
<div class="cuerpo-ventana" data-formulario>
<h2 id="boletin-titulo">${t.suscribeteTitulo}</h2>
<p class="sub">${t.suscribeteTexto}</p>
<ul>${tres}</ul>
<form data-palabra="${p ? esc(p.slug) : ''}" data-origen="${esc(origen || '')}">
<label>${t.tuCorreo}<input type="email" name="correo" required maxlength="254" autocomplete="email" placeholder="nombre@ejemplo.com"></label>
<button type="submit">${t.suscribirme}</button>
<p class="error" data-error hidden>${t.bolError}</p>
</form>
<p class="letra">${t.bolLetra} <a href="/legal/privacidad.html#boletin">${t.politica}</a></p>
</div>
<div class="cuerpo-ventana" data-hecho hidden><h2>${t.bolHechoTitulo}</h2><p class="sub">${t.bolHechoTexto}</p></div>
</div></div>
<style>${ESTILO_BOLETIN}</style>
<script>${BOLETIN_JS}</script>`;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonNoGuardar(cuerpo, estado) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/// POST /boletin: el correo de la ventana, a la función `boletin_web`. Un
/// correo que no puede serlo no sale de aquí.
async function suscribir(request, env) {
  let c = null;
  try {
    c = await request.json();
  } catch {
    c = null;
  }
  const correo = String(c?.correo ?? '').trim();
  if (correo.length > 254 || !CORREO.test(correo)) return jsonNoGuardar({ ok: false, error: 'correo' }, 400);
  const palabra = typeof c?.palabra === 'string' && /^[a-z0-9-]{1,40}$/.test(c.palabra) ? c.palabra : null;
  const origen = typeof c?.origen === 'string' && CAMPANA.test(c.origen) ? c.origen : null;
  const r = await fetch(`${env.SUPABASE_URL}/functions/v1/boletin_web`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON,
      authorization: `Bearer ${env.SUPABASE_ANON}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ correo, palabra, origen, lengua: c?.lengua === 'it' ? 'it' : 'es' }),
  }).catch(() => null);
  if (!r || !r.ok) return jsonNoGuardar({ ok: false }, 502);
  return jsonNoGuardar({ ok: true }, 200);
}

/// Adonde lleva el enlace del correo de confirmación (BOLETIN_GRACIAS).
function graciasDelBoletin(request) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  return respuesta(
    pagina({
      lang,
      titulo: `${t.graciasTitulo} — Carmina`,
      cuerpo: `<div class="palabras" style="text-align:center"><h1 style="text-align:center">${t.graciasTitulo}</h1>
<p class="aviso">${t.graciasTexto}</p>
<p><a class="boton principal" href="/palabras">${t.verLasPalabras}</a></p></div>
<style>${ESTILO_PALABRAS}</style>`,
    }),
    200,
  );
}

function bloqueDeLaApp(t, env, campana, ua) {
  return `<div class="app"><div class="icono" aria-hidden="true">C</div><div>
<p>${t.palabrasApp}</p>
${botonAbrir(t, env, campana, '', ua)}
</div></div>`;
}

function bloqueDeCursos(t) {
  return `<div class="cursos"><p class="rotulo">${t.cursos}</p>
<p class="que">${t.cursosTexto}</p>
<p><a href="https://circulodeestudiosliterarios.com">${t.verCursos} ›</a></p></div>`;
}

function piePalabras(t) {
  return `<p class="legales"><a href="/legal/privacidad.html">${t.privacidad}</a> · <a href="/legal/condiciones.html">${t.condiciones}</a> · <a href="/legal/soporte.html">${t.soporte}</a><br>Círculo de Estudios Literarios</p>`;
}

function textoAlternativo(p, lang) {
  return `${dePalabra(p, 'lema', lang)}: ${dePalabra(p, 'significado', lang)}. ${dePalabra(p, 'cita', lang)}.`;
}

async function portadaDePalabras(request, env, ctx) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  const url = new URL(request.url);
  const c = (url.searchParams.get('c') || '').toLowerCase();
  const origen = CAMPANA.test(c) ? c : '';
  const campana = origen ? `palabras_${origen}` : 'palabras';
  const pedida = url.searchParams.get('lengua');
  const filtro = LENGUAS.includes(pedida) ? pedida : '';
  const ua = request.headers.get('user-agent') || '';
  const { publicadas, proxima, hoy } = await lasPalabras(request, env);
  const lista = filtro ? publicadas.filter((p) => p.lengua === filtro) : publicadas;
  contarVisita(request, env, ctx, '/palabras', origen);

  const [primera, ...resto] = lista;
  const nombreDe = (p) => (p.lengua === 'griego' ? t.griego : t.latin);
  const cuando = (p) => (p.fecha === hoy ? t.hoy : fechaLarga(p.fecha, lang));
  const grande = primera
    ? `<a class="hoy" data-leido href="/p/${primera.slug}">
<img src="/palabras/${primera.slug}.png" width="1080" height="1350" alt="${esc(textoAlternativo(primera, lang))}">
<div class="pie-hoy"><p class="rotulo">${cuando(primera)} · ${nombreDe(primera)}</p>
<p class="lema">${esc(dePalabra(primera, 'lema', lang))}</p>
<p class="corto">${esc(dePalabra(primera, 'corto', lang))}</p>
<div class="fila"><span class="cita">${esc(dePalabra(primera, 'cita', lang))}</span><span class="ver">${t.verPalabra} ›</span></div></div></a>`
    : `<p class="aviso">${t.sinPalabras}</p>`;
  const filtroHtml = `<nav class="filtro" aria-label="${t.palabraDelDia}">${[
    ['', t.todas],
    ['latin', t.latin],
    ['griego', t.griego],
  ]
    .map(
      ([v, n]) =>
        `<a href="/palabras${v ? `?lengua=${v}` : ''}"${v === filtro ? ' aria-current="page"' : ''}>${n}</a>`,
    )
    .join('')}</nav>`;
  const anteriores = resto.length
    ? `<div class="rejilla">${resto
        .map(
          (p) => `<a href="/p/${p.slug}"><img src="/palabras/${p.slug}-m.png" width="360" height="450" loading="lazy" alt="${esc(textoAlternativo(p, lang))}">
<span class="lengua">${nombreDe(p)}</span><span class="lema">${esc(dePalabra(p, 'palabra', lang) || dePalabra(p, 'lema', lang))}</span><span class="corto">${esc(dePalabra(p, 'corto', lang))}</span></a>`,
        )
        .join('\n')}</div>`
    : '';
  const proximaHtml = `<div class="proxima">${
    proxima ? `<p class="cuando">${t.laProxima} ${fechaLarga(proxima.fecha, lang)}.</p>` : ''
  }<p>${t.recibelaEnTuCorreo}</p><a href="#boletin" data-boletin>${t.suscribirme}</a></div>`;
  const cabeza = [
    anuncioDeSafari(env),
    `<meta name="description" content="${esc(t.palabrasLema)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Carmina">`,
    `<meta property="og:title" content="${esc(t.palabraDelDia)} — Carmina">`,
    `<meta property="og:description" content="${esc(t.palabrasLema)}">`,
    `<meta property="og:url" content="${url.origin}/palabras">`,
    ...(primera
      ? [
          `<meta property="og:image" content="${url.origin}/palabras/${primera.slug}.png">`,
          `<meta property="og:image:width" content="1080">`,
          `<meta property="og:image:height" content="1350">`,
        ]
      : []),
    `<link rel="canonical" href="${url.origin}/palabras${filtro ? `?lengua=${filtro}` : ''}">`,
  ].join('\n');
  const cuerpo = `<div class="palabras">
<p class="rotulo">${t.palabraDelDia}</p>
<h1>${t.palabrasLema}</h1>
${grande}
${resto.length || filtro ? `<div class="fila"><p class="rotulo suave">${t.anteriores}</p>${filtroHtml}</div>` : ''}
${anteriores}
${proximaHtml}
${bloqueDeLaApp(t, env, campana, ua)}
${bloqueDeCursos(t)}
${piePalabras(t)}
</div>
${ventanaDelBoletin(t, lang, primera || null, origen)}
<style>${ESTILO_PALABRAS}</style>`;
  return respuesta(
    pagina({
      lang,
      titulo: `${t.palabraDelDia} — Carmina`,
      cabeza,
      cuerpo,
      aviso: avisoDeCookies(env, lang, 'palabras'),
      indexable: true,
    }),
    200,
    { indexable: true },
  );
}

async function paginaDePalabra(slug, request, env, ctx) {
  const lang = lengua(request);
  const t = TEXTOS[lang];
  const url = new URL(request.url);
  const { publicadas } = await lasPalabras(request, env);
  const p = publicadas.find((x) => x.slug === slug);
  if (!p) return sinPagina(lang, 404);
  const c = (url.searchParams.get('c') || '').toLowerCase();
  contarVisita(request, env, ctx, `/p/${slug}`, CAMPANA.test(c) ? c : '');
  const ua = request.headers.get('user-agent') || '';
  const campana = `palabra_${slug.replace(/-/g, '_')}`.slice(0, 40);
  const enlace = `${url.origin}/p/${slug}`;
  const imagen = `${url.origin}/palabras/${slug}.png`;
  const palabra = dePalabra(p, 'palabra', lang) || dePalabra(p, 'lema', lang);
  const titulo = `${palabra} — ${t.palabraDelDia} · Carmina`;
  const definida = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: palabra,
    alternateName: dePalabra(p, 'lema', lang),
    description: dePalabra(p, 'significado', lang),
    inLanguage: p.lengua === 'griego' ? 'grc' : 'la',
    url: enlace,
    image: imagen,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: `Carmina — ${t.palabraDelDia}`, url: `${url.origin}/palabras` },
  }).replace(/</g, '\\u003c');
  // El anuncio de Safari, sin argumento: hasta que la app sepa abrir /p/
  // (el enlace de la palabra), «Abrir» la lleva a su inicio.
  const cabeza = [
    anuncioDeSafari(env),
    `<meta name="description" content="${esc(`${dePalabra(p, 'lema', lang)}: ${dePalabra(p, 'significado', lang)}`)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Carmina">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(dePalabra(p, 'corto', lang))}">`,
    `<meta property="og:url" content="${esc(enlace)}">`,
    `<meta property="og:image" content="${esc(imagen)}">`,
    `<meta property="og:image:width" content="1080">`,
    `<meta property="og:image:height" content="1350">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="canonical" href="${esc(enlace)}">`,
    `<script type="application/ld+json">${definida}</script>`,
  ].join('\n');
  const otras = publicadas.filter((x) => x.slug !== slug).slice(0, 2);
  const mas = `<p class="rotulo suave">${t.masPalabras}</p>
<div class="rejilla tres">${otras
    .map(
      (x) =>
        `<a href="/p/${x.slug}"><img src="/palabras/${x.slug}-m.png" width="360" height="450" loading="lazy" alt="${esc(textoAlternativo(x, lang))}"></a>`,
    )
    .join('')}<a class="todas" href="/palabras">${t.verTodas} ›</a></div>`;
  const cuerpo = `<div class="palabras">
<p class="rotulo">${t.palabraDelDia} · ${p.lengua === 'griego' ? t.griego : t.latin} · ${fechaLarga(p.fecha, lang)}</p>
<img class="lamina" data-leido src="/palabras/${slug}.png" width="1080" height="1350" alt="${esc(textoAlternativo(p, lang))}">
<p class="linea"><strong>${esc(dePalabra(p, 'lema', lang))}</strong>: ${esc(dePalabra(p, 'significado', lang))}. <span class="cita">${esc(dePalabra(p, 'cita', lang))}.</span></p>
<div class="abrir-palabra">${botonAbrir(t, env, campana, `p/${slug}`, ua)}<p class="nota">${t.noLaTienesGratis}</p></div>
<div class="suscribirse"><span>${t.proximaEnTuCorreo}</span><a href="#boletin" data-boletin>${t.suscribirme} ›</a></div>
${mas}
${bloqueDeCursos(t)}
${piePalabras(t)}
</div>
${ventanaDelBoletin(t, lang, p, CAMPANA.test(c) ? c : '')}
<style>${ESTILO_PALABRAS}</style>`;
  return respuesta(
    pagina({
      lang,
      titulo,
      cabeza,
      cuerpo,
      aviso: avisoDeCookies(env, lang, 'palabra', { content_ids: [slug], content_name: palabra }),
      indexable: true,
    }),
    200,
    { indexable: true },
  );
}

async function denunciar(id, request, env) {
  const form = await request.formData().catch(() => null);
  const motivo = String(form?.get('motivo') || 'otro');
  const detalle = String(form?.get('detalle') || '').slice(0, 500);
  // El servidor descarta en silencio lo que pase de su límite y lo que no
  // existe; aquí siempre se dan las gracias.
  await rpc(env, 'denunciar_pagina', {
    p_id: id,
    p_motivo: motivo,
    p_detalle: detalle || null,
  }).catch(() => null);
  return paginaDeTraduccion(id, request, env, {
    aviso: TEXTOS[lengua(request)].gracias,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/.well-known/apple-app-site-association') {
      return json(ASOCIACION);
    }
    if (url.pathname === '/.well-known/assetlinks.json' && env.ANDROID_SHA256) {
      return json(
        JSON.stringify([
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: APP_ANDROID,
              sha256_cert_fingerprints: [env.ANDROID_SHA256],
            },
          },
        ]),
      );
    }
    const m = url.pathname.match(ID);
    if (m) {
      if (request.method === 'POST') return denunciar(m[1], request, env);
      if (request.method === 'GET' || request.method === 'HEAD') {
        return paginaDeTraduccion(m[1], request, env);
      }
      return new Response('', { status: 405 });
    }
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      return portada(request, env);
    }
    if (url.pathname === '/boletin') {
      return request.method === 'POST' ? suscribir(request, env) : new Response('', { status: 405 });
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (url.pathname === '/boletin/gracias') return graciasDelBoletin(request);
      if (url.pathname === '/palabras' || url.pathname === '/palabras/') {
        return portadaDePalabras(request, env, ctx);
      }
      const p = url.pathname.match(PALABRA);
      if (p) return paginaDePalabra(p[1], request, env, ctx);
    }
    // **«Abrir en Carmina» de los correos** (N2): un enlace universal, así que
    // con la app instalada la abre sin llegar aquí; sin ella, la portada, con
    // la búsqueda intacta (`?c=correo` llega a la tienda como campaña).
    if (url.pathname === '/abrir' && (request.method === 'GET' || request.method === 'HEAD')) {
      return new Response(null, { status: 302, headers: { location: `/${url.search}` } });
    }
    const a = url.pathname.match(INVITACION);
    if (a && (request.method === 'GET' || request.method === 'HEAD')) {
      return paginaDeInvitacion(a[1] || url.searchParams.get('c') || '', request, env);
    }
    // **Una carpeta, su index.html; una dirección sin extensión, su .html**
    // (`/h/virgilio-75`, F3b): con `html_handling: none` Cloudflare no lo
    // hace solo.
    const ultima = url.pathname.split('/').pop();
    const otra = url.pathname.endsWith('/')
      ? `${url.pathname}index.html`
      : ultima && !ultima.includes('.')
        ? `${url.pathname}.html`
        : null;
    if (otra) {
      const archivo = new URL(request.url);
      archivo.pathname = otra;
      const r = await env.ASSETS.fetch(new Request(archivo, request));
      if (r.status !== 404) return r;
    }
    return env.ASSETS.fetch(request);
  },
};
