'use strict';
/**
 * Música.
 *
 * 1) Búsqueda/metadata de temas: iTunes Search API (gratis, sin API key)
 *    -> título, artista, álbum, año, portada, preview de 30s.
 *
 * 2) Enriquecimiento del tema (para el conductor): un párrafo armado con
 *    los datos más útiles para comentar al aire (álbum, año, género) más
 *    una bajada corta del artista sacada de Wikipedia (gratis, sin key).
 *
 * 3) "Qué está sonando / qué sigue": ver notas del modo manual/archivo/SQL
 *    más abajo.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const chokidar = require('chokidar');

async function searchTrack(query) {
  const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=music&limit=8&country=AR';
  const res = await fetch(url);
  if (!res.ok) throw new Error('iTunes Search error ' + res.status);
  const json = await res.json();
  return json.results.map((r) => ({
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    year: r.releaseDate ? r.releaseDate.slice(0, 4) : null,
    artworkUrl: r.artworkUrl100,
    previewUrl: r.previewUrl,
    genre: r.primaryGenreName
  }));
}

/** Párrafo de datos del tema, listo para leer al aire. Nunca falla. */
function buildTrackBlurb(track) {
  if (!track || !track.title) return '';
  const parts = [];
  parts.push('"' + track.title + '" de ' + (track.artist || 'artista desconocido'));
  if (track.album) parts.push('del álbum "' + track.album + '"');
  if (track.year) parts.push('(' + track.year + ')');
  let text = parts.join(' ');
  if (track.genre) text += ' — género ' + track.genre + '.';
  else text += '.';
  return text;
}

/** Bajada corta del artista (Wikipedia, gratis). Devuelve null si no encuentra. */
async function getArtistBio(artistName) {
  if (!artistName) return null;
  const tryLang = async (lang) => {
    try {
      const url = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(artistName);
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.type === 'disambiguation') return null;
      return json.extract || null;
    } catch (err) {
      return null;
    }
  };
  const es = await tryLang('es');
  if (es) return es;
  return await tryLang('en');
}

/** Arma el track "enriquecido" (blurb + bio) para mostrar en el panel Al aire. */
async function enrichTrack(track) {
  if (!track) return track;
  const copy = Object.assign({}, track);
  copy.blurb = buildTrackBlurb(copy);
  copy.bio = await getArtistBio(copy.artist);
  return copy;
}

// ---- Modo manual --------------------------------------------------------

class ManualNowPlaying {
  constructor() {
    this.state = { current: null, next: null, updatedAt: null };
  }
  setCurrent(track) {
    this.state.current = track;
    this.state.updatedAt = new Date().toISOString();
    return this.state;
  }
  setNext(track) {
    this.state.next = track;
    this.state.updatedAt = new Date().toISOString();
    return this.state;
  }
  get() {
    return this.state;
  }
}

// ---- Modo archivo (AudiCom u otro playout que exporte a .txt) ----------

class FileNowPlaying {
  constructor(filePath, parseFn) {
    this.filePath = filePath;
    this.parseFn = parseFn || FileNowPlaying.defaultParser;
    this.state = { current: null, next: null, updatedAt: null };
    this.watcher = null;
  }

  static defaultParser(raw) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parseLine = (line) => {
      const parts = line.split(' - ');
      const artist = parts[0];
      const title = parts[1];
      return { artist: artist || null, title: title || line };
    };
    const current = lines[0] ? parseLine(lines[0].replace(/^SIGUIENTE:\s*/i, '')) : null;
    const nextLine = lines.find((l) => /^SIGUIENTE:/i.test(l));
    const next = nextLine ? parseLine(nextLine.replace(/^SIGUIENTE:\s*/i, '')) : null;
    return { current: current, next: next };
  }

  start(onUpdate) {
    const self = this;
    const readAndParse = async function () {
      if (!fs.existsSync(self.filePath)) return;
      try {
        const raw = fs.readFileSync(self.filePath, 'utf8');
        const parsed = self.parseFn(raw);
        const current = await enrichTrack(parsed.current);
        const next = await enrichTrack(parsed.next);
        self.state = { current: current, next: next, updatedAt: new Date().toISOString() };
        if (onUpdate) onUpdate(self.state);
      } catch (err) {
        self.state.parseError = err.message;
      }
    };
    readAndParse();
    this.watcher = chokidar.watch(this.filePath, { ignoreInitial: true });
    this.watcher.on('change', readAndParse);
    this.watcher.on('add', readAndParse);
    return this;
  }

  stop() {
    if (this.watcher) this.watcher.close();
  }

  get() {
    return this.state;
  }
}

// ---- Modo SQL directo a AudiCom (adaptador a completar por radio) ------

class AudicomSqlNowPlaying {
  constructor(connectionConfig) {
    this.connectionConfig = connectionConfig;
    this.customQuery = null;
  }

  setCustomQuery(sql) {
    this.customQuery = sql;
  }

  async get() {
    if (!this.customQuery) {
      throw new Error(
        'AudicomSqlNowPlaying: falta configurar la consulta SQL (setCustomQuery). ' +
        'Hay que pedirla al soporte tecnico de AudiCom de cada radio, o usar el modo "audicom-file" / "manual" mientras tanto.'
      );
    }
    throw new Error('Conexion SQL a AudiCom todavia no implementada: falta elegir driver (mssql/firebird/mysql) e instalarlo.');
  }
}

module.exports = {
  searchTrack,
  buildTrackBlurb,
  getArtistBio,
  enrichTrack,
  ManualNowPlaying,
  FileNowPlaying,
  AudicomSqlNowPlaying
};
