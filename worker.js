// La web de carmina.circulodeestudiosliterarios.com, en Cloudflare Workers.
//
// Lo que es un archivo (legal/…html) lo sirve Cloudflare tal cual, sin pasar
// por aquí. Lo que no, llega a `fetch`:
//
//   /<carpeta>/  su index.html (`/a/?c=…`, la invitación de Amigos).
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
// Siempre con `noindex`, en la etiqueta y en la cabecera: fuera de Google.
// El aviso de cookies y el Píxel de Meta, sólo con PIXEL_ID (todavía no).
//
// Las pruebas: `node --test web/worker.test.mjs`.

const ID = /^\/t\/([2-9a-z]{12})\/?$/;

// Cuando la app esté publicada, sus direcciones; con ?ct=compartir_t (F1e).
const TIENDAS = { appStore: null, googlePlay: null };

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const TEXTOS = {
  es: {
    sello: 'Latín verificado',
    traducido: 'Traducido con Carmina',
    titulo: 'Traducido con Carmina',
    pronto: 'Muy pronto en la App Store y en Google Play.',
    descargar: 'Descargar en App Store',
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
  },
  it: {
    sello: 'Latino verificato',
    traducido: 'Tradotto con Carmina',
    titulo: 'Tradotto con Carmina',
    pronto: 'Presto su App Store e Google Play.',
    descargar: 'Scarica su App Store',
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
  details { margin-top:22px; color:var(--suave); font-size:.92rem; }
  summary { cursor:pointer; }
  form { display:grid; gap:10px; margin-top:12px; }
  select, textarea, button { font:inherit; padding:10px 12px; border-radius:10px; border:1px solid var(--filete);
    background:var(--papel); color:var(--tinta); }
  button { background:var(--carmin); color:#fff; border:0; font-weight:600; min-height:44px; }
  .aviso { text-align:center; color:var(--suave); }`;

function pagina({ lang, titulo, cabeza = '', cuerpo }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titulo)}</title>
${cabeza}
<style>${ESTILO}</style>
</head>
<body>
<main>
<p class="marca">Carmina</p>
${cuerpo}
</main>
</body>
</html>`;
}

function respuesta(html, estado) {
  return new Response(html, {
    status: estado,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      // Una página retirada no puede quedarse en una caché: dejaría de
      // responder 410.
      'cache-control': 'public, max-age=60',
    },
  });
}

function tiendas(t) {
  const enlaces = [];
  if (TIENDAS.appStore) {
    enlaces.push(`<a href="${esc(TIENDAS.appStore)}?ct=compartir_t">${t.descargar}</a>`);
  }
  if (TIENDAS.googlePlay) {
    enlaces.push(`<a href="${esc(TIENDAS.googlePlay)}&utm_campaign=compartir_t">Google Play</a>`);
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
  <p>${tiendas(t)}</p>
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
  return respuesta(pagina({ lang, titulo, cabeza, cuerpo }), 200);
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
    const m = url.pathname.match(ID);
    if (m) {
      if (request.method === 'POST') return denunciar(m[1], request, env);
      if (request.method === 'GET' || request.method === 'HEAD') {
        return paginaDeTraduccion(m[1], request, env);
      }
      return new Response('', { status: 405 });
    }
    // **Una carpeta, su index.html** (`/a/?c=…`, la invitación de Amigos):
    // con `html_handling: none` Cloudflare no lo hace solo.
    if (url.pathname.endsWith('/')) {
      const indice = new URL(request.url);
      indice.pathname += 'index.html';
      const r = await env.ASSETS.fetch(new Request(indice, request));
      if (r.status !== 404) return r;
    }
    return env.ASSETS.fetch(request);
  },
};
