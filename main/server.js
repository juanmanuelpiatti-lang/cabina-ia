'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { ConfigStore } = require('../modules/config');
const { getWeatherForCities } = require('../modules/weather');
const { getTrafficForCities } = require('../modules/traffic');
const { fetchAllNews, detectBreaking, buildPanorama } = require('../modules/news');
const { searchTrack, ManualNowPlaying } = require('../modules/music');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

function createServer(opts) {
    const configPath = opts.configPath;
    const rendererDir = opts.rendererDir;
    const port = opts.port;
    const store = new ConfigStore(configPath);
    const nowPlayingByStation = new Map();
    const lastPanoramaByStation = new Map();
    const lastNewsByStation = new Map();

  function getManual(stationId) {
        if (!nowPlayingByStation.has(stationId)) nowPlayingByStation.set(stationId, new ManualNowPlaying());
        return nowPlayingByStation.get(stationId);
  }

  function sendJson(res, status, data) {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
        res.end(JSON.stringify(data));
  }

  function readBody(req) {
        return new Promise((resolve, reject) => {
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                          try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
                });
                req.on('error', reject);
        });
  }

  const server = http.createServer(async (req, res) => {
        try {
                const url = new URL(req.url, 'http://' + req.headers.host);
                const p = url.pathname;

          if (p === '/api/stations' && req.method === 'GET') {
                    return sendJson(res, 200, store.read());
          }

          if (p === '/api/stations' && req.method === 'POST') {
                    const body = await readBody(req);
                    store.upsertStation(body);
                    return sendJson(res, 200, store.read());
          }

          if (p === '/api/stations/active' && req.method === 'POST') {
                    const body = await readBody(req);
                    store.setActiveStation(body.id);
                    return sendJson(res, 200, store.read());
          }

          if (p.match(/^\/api\/stations\/[^/]+$/) && req.method === 'DELETE') {
                    const id = decodeURIComponent(p.split('/').pop());
                    store.removeStation(id);
                    return sendJson(res, 200, store.read());
          }

          if (p === '/api/dashboard' && req.method === 'GET') {
                    const station = store.getActiveStation();
                    const sources = (station.newsSources && station.newsSources.length) ? station.newsSources : store.read().stations[0].newsSources;
                    const results = await Promise.all([
                                getWeatherForCities([station.city]),
                                getTrafficForCities([station.city]),
                                fetchAllNews(sources)
                              ]);
                    const weather = results[0];
                    const traffic = results[1];
                    const news = results[2];
                    lastNewsByStation.set(station.id, news);
                    const breaking = detectBreaking(news, station.breakingKeywords || [], 45);
                    return sendJson(res, 200, {
                                station: station,
                                weather: weather[0],
                                traffic: traffic[0],
                                news: news.slice(0, 20),
                                breaking: breaking,
                                nowPlaying: getManual(station.id).get(),
                                lastPanorama: lastPanoramaByStation.get(station.id) || null
                    });
          }

          if (p === '/api/panorama' && req.method === 'POST') {
                    const station = store.getActiveStation();
                    const news = lastNewsByStation.get(station.id) || await fetchAllNews(station.newsSources);
                    const panorama = await buildPanorama(news, station.name, station.llm);
                    panorama.generatedAt = new Date().toISOString();
                    lastPanoramaByStation.set(station.id, panorama);
                    return sendJson(res, 200, panorama);
          }

          if (p === '/api/music/search' && req.method === 'GET') {
                    const q = url.searchParams.get('q') || '';
                    const results = await searchTrack(q);
                    return sendJson(res, 200, results);
          }

          if (p === '/api/nowplaying' && req.method === 'POST') {
                    const station = store.getActiveStation();
                    const body = await readBody(req);
                    const manual = getManual(station.id);
                    if (body.current) manual.setCurrent(body.current);
                    if (body.next) manual.setNext(body.next);
                    return sendJson(res, 200, manual.get());
          }

          let filePath = p === '/' ? '/index.html' : p;
                filePath = path.join(rendererDir, filePath);
                if (!filePath.startsWith(rendererDir)) { res.writeHead(403); return res.end('Forbidden'); }
                if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
                const ext = path.extname(filePath);
                res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
        } catch (err) {
                sendJson(res, 500, { error: err.message });
        }
  });

  return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

module.exports = { createServer };
