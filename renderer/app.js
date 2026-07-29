'use strict';

const $ = (sel) => document.querySelector(sel);

let stationsData = null;
let editingStationId = null;

function fmtTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(() => { $('#clock').textContent = fmtTime(); }, 1000);

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------
// Estaciones
// ---------------------------------------------------------------------

async function loadStations() {
  stationsData = await api('/api/stations');
  const sel = $('#stationSelect');
  sel.innerHTML = '';
  stationsData.stations.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.city && s.city.name ? s.city.name : 'sin ciudad'})`;
    if (s.id === stationsData.activeStationId) opt.selected = true;
    sel.appendChild(opt);
  });
  renderStationDialogList();
}

function renderStationDialogList() {
  const ul = $('#stationListInDialog');
  ul.innerHTML = '';
  stationsData.stations.forEach((s) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${s.name} — ${s.city && s.city.name ? s.city.name : 'sin ciudad'}`;
    li.appendChild(span);

    const actions = document.createElement('span');

    const edit = document.createElement('button');
    edit.className = 'btn ghost';
    edit.textContent = 'Editar';
    edit.style.marginRight = '6px';
    edit.onclick = () => fillStationForm(s);
    actions.appendChild(edit);

    const del = document.createElement('button');
    del.className = 'btn ghost';
    del.textContent = 'Borrar';
    del.onclick = async () => {
      await api(`/api/stations/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      await loadStations();
      await refreshDashboard();
    };
    actions.appendChild(del);

    li.appendChild(actions);
    ul.appendChild(li);
  });
}

function clearStationForm() {
  editingStationId = null;
  $('#fStationName').value = '';
  $('#fCityName').value = '';
  $('#fCityLat').value = '';
  $('#fCityLon').value = '';
  $('#fKeywords').value = 'último momento, urgente, de último momento, alerta, ahora';
  $('#fNews1Name').value = 'Infobae';
  $('#fNews1Url').value = 'https://www.infobae.com/arc/outboundfeeds/rss/';
  $('#fNews2Name').value = 'La Nación';
  $('#fNews2Url').value = 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/';
  $('#fLlmProvider').value = 'none';
  $('#fLlmKey').value = '';
  setStationFormError('');
}

function fillStationForm(s) {
  editingStationId = s.id;
  $('#fStationName').value = s.name || '';
  $('#fCityName').value = (s.city && s.city.name) || '';
  $('#fCityLat').value = (s.city && typeof s.city.lat === 'number') ? s.city.lat : '';
  $('#fCityLon').value = (s.city && typeof s.city.lon === 'number') ? s.city.lon : '';
  $('#fKeywords').value = (s.breakingKeywords || []).join(', ');
  const n1 = (s.newsSources && s.newsSources[0]) || {};
  const n2 = (s.newsSources && s.newsSources[1]) || {};
  $('#fNews1Name').value = n1.name || '';
  $('#fNews1Url').value = n1.rss || '';
  $('#fNews2Name').value = n2.name || '';
  $('#fNews2Url').value = n2.rss || '';
  $('#fLlmProvider').value = (s.llm && s.llm.provider) || 'none';
  $('#fLlmKey').value = (s.llm && s.llm.apiKey) || '';
  setStationFormError('');
  $('#stationDialog').showModal();
}

function setStationFormError(msg) {
  let el = $('#stationFormError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stationFormError';
    el.className = 'form-error';
    $('#stationForm').insertBefore(el, $('#stationForm').firstChild);
  }
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function openStationDialog() {
  clearStationForm();
  $('#stationDialog').showModal();
}

async function saveStation() {
  const name = $('#fStationName').value.trim();
  const cityName = $('#fCityName').value.trim();
  const lat = parseFloat($('#fCityLat').value);
  const lon = parseFloat($('#fCityLon').value);

  if (!name) return setStationFormError('Falta el nombre de la estación.');
  if (!cityName) return setStationFormError('Falta el nombre de la ciudad.');
  if (Number.isNaN(lat) || Number.isNaN(lon)) return setStationFormError('Latitud/longitud inválidas — completá los dos campos con números.');

  const id = editingStationId || (name.toLowerCase().replace(/\s+/g, '-') || ('estacion-' + Date.now()));
  const station = {
    id,
    name,
    city: { name: cityName, lat, lon },
    newsSources: [
      { name: $('#fNews1Name').value.trim() || 'Fuente 1', rss: $('#fNews1Url').value.trim() },
      { name: $('#fNews2Name').value.trim() || 'Fuente 2', rss: $('#fNews2Url').value.trim() }
    ].filter((s) => s.rss),
    breakingKeywords: $('#fKeywords').value.split(',').map((k) => k.trim()).filter(Boolean),
    musicSource: { type: 'manual' },
    panoramaFrequencyMinutes: 60,
    llm: { provider: $('#fLlmProvider').value, apiKey: $('#fLlmKey').value.trim() }
  };
  await api('/api/stations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(station) });
  await api('/api/stations/active', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  await loadStations();
  await refreshDashboard();
  await loadPnt();
  $('#stationDialog').close();
}

// ---------------------------------------------------------------------
// Dashboard (clima / tránsito / noticias / al aire)
// ---------------------------------------------------------------------

function weatherIcon(cond) {
  const c = (cond || '').toLowerCase();
  if (c.includes('tormenta')) return '⛈️';
  if (c.includes('nev')) return '❄️';
  if (c.includes('lluvia') || c.includes('llovizna') || c.includes('chubasco')) return '🌧️';
  if (c.includes('niebla')) return '🌫️';
  if (c.includes('nublado')) return '☁️';
  if (c.includes('despejado')) return '☀️';
  return '⛅';
}

function renderTrackInfo(elId, track) {
  const el = $(elId);
  if (!track) { el.textContent = ''; return; }
  const bits = [];
  if (track.blurb) bits.push(track.blurb);
  if (track.bio) bits.push(track.bio);
  el.textContent = bits.join(' ');
}

async function refreshDashboard() {
  const data = await api('/api/dashboard');

  // Breaking
  const breakingCard = $('#breakingCard');
  const list = $('#breakingList');
  if (data.breaking && data.breaking.length) {
    breakingCard.style.borderColor = 'var(--danger)';
    list.innerHTML = data.breaking.map((b) => `<div class="breaking-item">⚠ [${b.source}] ${b.title}</div>`).join('');
  } else {
    list.innerHTML = 'Sin novedades urgentes por ahora.';
  }

  // Now playing
  const np = data.nowPlaying || {};
  $('#npCurrent').textContent = np.current ? `${np.current.artist || ''} — ${np.current.title || ''}` : '— sin cargar —';
  $('#npNext').textContent = np.next ? `${np.next.artist || ''} — ${np.next.title || ''}` : '— sin cargar —';
  renderTrackInfo('#npCurrentInfo', np.current);
  renderTrackInfo('#npNextInfo', np.next);

  // Weather
  $('#weatherCity').textContent = data.weather.city;
  if (data.weather.error) {
    $('#weatherNow').textContent = 'Error: ' + data.weather.error;
    $('#weatherForecast').innerHTML = '';
  } else {
    const c = data.weather.current;
    $('#weatherNow').innerHTML = `${weatherIcon(c.condition)} ${Math.round(c.tempC)}°C <span class="cond">${c.condition} · sensación ${Math.round(c.feelsLikeC)}°C · viento ${Math.round(c.windKmh)}km/h</span>`;
    $('#weatherForecast').innerHTML = data.weather.forecast.map((d) => {
      const day = new Date(d.date).toLocaleDateString('es-AR', { weekday: 'short' });
      return `<div class="day">${day}<br>${weatherIcon(d.condition)}<br>${Math.round(d.minC)}°/${Math.round(d.maxC)}°</div>`;
    }).join('');
  }

  // Traffic
  $('#trafficCity').textContent = data.traffic.city;
  $('#trafficLink').href = data.traffic.mapsUrl;

  // Headlines
  $('#headlinesList').innerHTML = (data.news || []).slice(0, 12).map((n) =>
    `<li><span class="src">${n.source}</span>${n.title}</li>`
  ).join('');

  // Panorama (last generated, if any)
  if (data.lastPanorama) {
    $('#panoramaText').textContent = data.lastPanorama.text;
    $('#panoramaMeta').textContent = `Generado por: ${data.lastPanorama.generatedBy} · ${new Date(data.lastPanorama.generatedAt).toLocaleTimeString('es-AR')}`;
  }
}

async function generatePanorama() {
  $('#panoramaText').textContent = 'Generando...';
  const panorama = await api('/api/panorama', { method: 'POST' });
  $('#panoramaText').textContent = panorama.text;
  $('#panoramaMeta').textContent = `Generado por: ${panorama.generatedBy} · ${new Date(panorama.generatedAt).toLocaleTimeString('es-AR')}`;
}

async function searchMusic() {
  const q = $('#musicSearchInput').value.trim();
  if (!q) return;
  const results = await api('/api/music/search?q=' + encodeURIComponent(q));
  $('#musicResults').innerHTML = results.map((r, i) => `
    <div class="music-result">
      <span>${r.artist} — ${r.title} ${r.year ? '(' + r.year + ')' : ''}</span>
      <span>
        <button data-i="${i}" data-role="current">Sonando</button>
        <button data-i="${i}" data-role="next">Sigue</button>
      </span>
    </div>
  `).join('');
  $('#musicResults').dataset.results = JSON.stringify(results);
}

async function setNowPlayingFromResult(i, role) {
  const results = JSON.parse($('#musicResults').dataset.results || '[]');
  const r = results[i];
  if (!r) return;
  const track = { artist: r.artist, title: r.title, album: r.album, year: r.year, genre: r.genre };
  const body = role === 'current' ? { current: track } : { next: track };
  await api('/api/nowplaying', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await refreshDashboard();
}

// ---------------------------------------------------------------------
// PNT (publicidad no tradicional)
// ---------------------------------------------------------------------

function isOverdue(item) {
  if (item.status === 'done' || !item.time) return false;
  const now = new Date();
  const nowStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return item.time < nowStr;
}

async function loadPnt() {
  const items = await api('/api/pnt');
  renderPntList(items);
}

function renderPntList(items) {
  const ul = $('#pntList');
  if (!items.length) {
    ul.innerHTML = 'Sin PNT cargados.';
    return;
  }
  ul.innerHTML = items.map((i) => {
    const overdue = isOverdue(i);
    const cls = 'pnt-item' + (i.status === 'done' ? ' done' : '') + (overdue ? ' overdue' : '');
    const doneLabel = i.status === 'done'
      ? `Leído ${new Date(i.completedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `
      <li class="${cls}" data-id="${i.id}">
        <div>
          <span class="pnt-time">${i.time || '--:--'}</span>
          <span class="pnt-turno">${i.turno}</span>
          <div class="pnt-client">${i.client || '(sin cliente)'}</div>
          <div class="pnt-text">${i.text || ''}</div>
        </div>
        <div class="pnt-actions">
          ${i.status === 'done'
            ? `<span class="muted">${doneLabel}</span><button class="btn ghost" data-action="pending">Deshacer</button>`
            : `<button class="btn" data-action="done">OK, leído</button>`}
          <button class="btn ghost" data-action="delete">Borrar</button>
        </div>
      </li>`;
  }).join('');
}

function openPntDialog() {
  $('#fPntTime').value = '';
  $('#fPntTurno').value = '';
  $('#fPntClient').value = '';
  $('#fPntText').value = '';
  $('#pntDialog').showModal();
}

async function savePnt() {
  const time = $('#fPntTime').value;
  const turno = $('#fPntTurno').value.trim() || 'General';
  const client = $('#fPntClient').value.trim();
  const text = $('#fPntText').value.trim();
  if (!time || !text) { alert('Completá al menos la hora y el texto a leer.'); return; }
  await api('/api/pnt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ time, turno, client, text }) });
  await loadPnt();
  $('#pntDialog').close();
}

async function togglePntReport() {
  const box = $('#pntReport');
  if (box.style.display !== 'none') { box.style.display = 'none'; return; }
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const report = await api('/api/pnt/report?date=' + dateStr);
  if (!report.total) {
    box.textContent = `Todavía no se marcó ningún PNT como leído hoy (${dateStr}).`;
  } else {
    const lines = [`Reporte del ${dateStr} — ${report.total} PNT emitidos:`];
    Object.keys(report.byTurno).forEach((turno) => {
      lines.push(`\n${turno}:`);
      report.byTurno[turno].forEach((i) => {
        const hora = new Date(i.completedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        lines.push(`  • ${i.time} — ${i.client || '(sin cliente)'} (leído ${hora})`);
      });
    });
    box.textContent = lines.join('\n');
  }
  box.style.display = 'block';
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------

function wireEvents() {
  $('#stationSelect').addEventListener('change', async (e) => {
    await api('/api/stations/active', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.target.value }) });
    await refreshDashboard();
    await loadPnt();
  });
  $('#manageStationsBtn').addEventListener('click', openStationDialog);
  $('#closeDialogBtn').addEventListener('click', () => $('#stationDialog').close());
  $('#saveStationBtn').addEventListener('click', saveStation);
  $('#regenPanoramaBtn').addEventListener('click', generatePanorama);
  $('#musicSearchBtn').addEventListener('click', searchMusic);
  $('#musicSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchMusic(); });
  $('#musicResults').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    setNowPlayingFromResult(parseInt(btn.dataset.i, 10), btn.dataset.role);
  });

  $('#addPntBtn').addEventListener('click', openPntDialog);
  $('#closePntDialogBtn').addEventListener('click', () => $('#pntDialog').close());
  $('#savePntBtn').addEventListener('click', savePnt);
  $('#pntReportBtn').addEventListener('click', togglePntReport);
  $('#pntList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const li = btn.closest('li[data-id]');
    const id = li.dataset.id;
    if (btn.dataset.action === 'done') await api(`/api/pnt/${encodeURIComponent(id)}/done`, { method: 'POST' });
    if (btn.dataset.action === 'pending') await api(`/api/pnt/${encodeURIComponent(id)}/pending`, { method: 'POST' });
    if (btn.dataset.action === 'delete') await api(`/api/pnt/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadPnt();
  });
}

async function boot() {
  wireEvents();
  await loadStations();
  await refreshDashboard();
  await loadPnt();
  // refresco automático: clima/tránsito/noticias cada 3 min, PNT cada 1 min, panorama automático cada 1 hora
  setInterval(refreshDashboard, 3 * 60 * 1000);
  setInterval(loadPnt, 60 * 1000);
  setInterval(generatePanorama, 60 * 60 * 1000);
}

boot();
