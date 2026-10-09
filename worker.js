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
        components: [{ '/': '/t/*' }, { '/': '/h/*' }, { '/': '/a/*' }],
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
  var PIXEL = __PIXEL__, CATEGORIA = __CATEGORIA__, VERSION = ${VERSION_DEL_AVISO};
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
  var cargado = false;
  function cargar() {
    if (cargado) return;
    cargado = true;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL);
    evento('PageView');
    if (CATEGORIA) evento('ViewContent', { content_category: CATEGORIA });
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

/// El aviso, su enlace del pie y su script; nada sin PIXEL_ID.
function avisoDeCookies(env, lang, categoria = '') {
  if (!env.PIXEL_ID) return '';
  const t = TEXTOS[lang];
  const js = AVISO_JS.replace('__PIXEL__', JSON.stringify(String(env.PIXEL_ID))).replace(
    '__CATEGORIA__',
    JSON.stringify(categoria),
  );
  return `<p class="cookies"><a href="#" id="aviso-reabrir">${t.cookies}</a></p>
<div id="aviso-cookies" class="aviso-cookies" role="dialog" aria-live="polite" hidden>
  <p>${t.cookiesTexto} <a href="/legal/privacidad.html#cookies">${t.cookiesMas}</a></p>
  <div class="aviso-botones"><button type="button" id="aviso-rechazar">${t.cookiesRechazar}</button><button type="button" id="aviso-aceptar">${t.cookiesAceptar}</button></div>
</div>
<style>${ESTILO_AVISO}</style>
<script>${js}</script>`;
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
  async fetch(request, env) {
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
