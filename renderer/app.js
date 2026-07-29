'use strict';

const $ = (sel) => document.querySelector(sel);

let stationsData = null;

function fmtTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(() => { $('#clock').textContent = fmtTime(); }, 1000);

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(path + ' -> ' + res.status);
  return res.json();
}

async function loadStations() {
  stationsData = await api('/api/stations');
  const sel = $('#stationSelect');
  sel.innerHTML = '';
  stationsData.stations.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name + ' (' + s.city.name + ')';
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
    li.innerHTML = '<span>' + s.name + ' - ' + s.city.name + '</span>';
    const del = document.createElement('button');
    del.className = 'btn ghost';
    del.textContent = 'Borrar';
    del.onclick = async () => {
      await api('/api/stations/' + encodeURIComponent(s.id), { method: 'DELETE' });
      await loadStations();
      await refreshDashboard();
    };
    li.appendChild(del);
    ul.appendChild(li);
  });
}

function weatherIcon(cond) {
  const c = (cond || '').toLowerCase();
  if (c.includes('tormenta')) return 'TOR';
  if (c.includes('nev')) return 'NIEVE';
  if (c.includes('lluvia') || c.includes('llovizna') || c.includes('chubasco')) return 'LLUVIA';
  if (c.includes('niebla')) return 'NIEBLA';
  if (c.includes('nublado')) return 'NUBLADO';
  if (c.includes('despejado')) return 'SOL';
  return '';
}

async function refreshDashboard() {
  const data = await api('/api/dashboard');

  const breakingCard = $('#breakingCard');
  const list = $('#breakingList');
  if (data.breaking && data.breaking.length) {
    breakingCard.style.borderColor = 'var(--danger)';
    list.innerHTML = data.breaking.map((b) => '<div class="breaking-item">[' + b.source + '] ' + b.title + '</div>').join('');
  } else {
    list.innerHTML = 'Sin novedades urgentes por ahora.';
  }

  const np = data.nowPlaying || {};
  $('#npCurrent').textContent = np.current ? ((np.current.artist || '') + ' - ' + (np.current.title || '')) : '- sin cargar -';
  $('#npNext').textContent = np.next ? ((np.next.artist || '') + ' - ' + (np.next.title || '')) : '- sin cargar -';

  $('#weatherCity').textContent = data.weather.city;
  if (data.weather.error) {
    $('#weatherNow').textContent = 'Error: ' + data.weather.error;
    $('#weatherForecast').innerHTML = '';
  } else {
    const c = data.weather.current;
    $('#weatherNow').innerHTML = Math.round(c.tempC) + 'grados C <span class="cond">' + c.condition + ' - sensacion ' + Math.round(c.feelsLikeC) + 'grados - viento ' + Math.round(c.windKmh) + 'km/h</span>';
    $('#weatherForecast').innerHTML = data.weather.forecast.map((d) => {
      const day = new Date(d.date).toLocaleDateString('es-AR', { weekday: 'short' });
      return '<div class="day">' + day + '<br>' + Math.round(d.minC) + '/' + Math.round(d.maxC) + '</div>';
    }).join('');
  }

  $('#trafficCity').textContent = data.traffic.city;
  $('#trafficLink').href = data.traffic.mapsUrl;

  $('#headlinesList').innerHTML = (data.news || []).slice(0, 12).map((n) =>
    '<li><span class="src">' + n.source + '</span>' + n.title + '</li>'
  ).join('');

  if (data.lastPanorama) {
    $('#panoramaText').textContent = data.lastPanorama.text;
    $('#panoramaMeta').textContent = 'Generado por: ' + data.lastPanorama.generatedBy + ' - ' + new Date(data.lastPanorama.generatedAt).toLocaleTimeString('es-AR');
  }
}

async function generatePanorama() {
  $('#panoramaText').textContent = 'Generando...';
  const panorama = await api('/api/panorama', { method: 'POST' });
  $('#panoramaText').textContent = panorama.text;
  $('#panoramaMeta').textContent = 'Generado por: ' + panorama.generatedBy + ' - ' + new Date(panorama.generatedAt).toLocaleTimeString('es-AR');
}

async function searchMusic() {
  const q = $('#musicSearchInput').value.trim();
  if (!q) return;
  const results = await api('/api/music/search?q=' + encodeURIComponent(q));
  $('#musicResults').innerHTML = results.map((r, i) => (
    '<div class="music-result">' +
      '<span>' + r.artist + ' - ' + r.title + ' ' + (r.year ? '(' + r.year + ')' : '') + '</span>' +
      '<span>' +
        '<button data-i="' + i + '" data-role="current">Sonando</button>' +
        '<button data-i="' + i + '" data-role="next">Sigue</button>' +
      '</span>' +
    '</div>'
  )).join('');
  $('#musicResults').dataset.results = JSON.stringify(results);
}

async function setNowPlayingFromResult(i, role) {
  const results = JSON.parse($('#musicResults').dataset.results || '[]');
  const r = results[i];
  if (!r) return;
  const track = { artist: r.artist, title: r.title };
  const body = role === 'current' ? { current: track } : { next: track };
  await api('/api/nowplaying', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await refreshDashboard();
}

function openStationDialog() {
  $('#stationDialog').showModal();
}

async function saveStation() {
  const id = ($('#fStationName').value || '').trim().toLowerCase().replace(/\s+/g, '-') || ('estacion-' + Date.now());
  const station = {
    id: id,
    name: $('#fStationName').value.trim(),
    city: {
      name: $('#fCityName').value.trim(),
      lat: parseFloat($('#fCityLat').value),
      lon: parseFloat($('#fCityLon').value)
    },
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
  await api('/api/stations/active', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id }) });
  await loadStations();
  await refreshDashboard();
  $('#stationDialog').close();
}

function wireEvents() {
  $('#stationSelect').addEventListener('change', async (e) => {
    await api('/api/stations/active', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.target.value }) });
    await refreshDashboard();
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
}

async function boot() {
  wireEvents();
  await loadStations();
  await refreshDashboard();
  setInterval(refreshDashboard, 3 * 60 * 1000);
  setInterval(generatePanorama, 60 * 60 * 1000);
}

boot();
