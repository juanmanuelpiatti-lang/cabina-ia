'use strict';

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
        const readAndParse = function () {
                if (!fs.existsSync(self.filePath)) return;
                try {
                          const raw = fs.readFileSync(self.filePath, 'utf8');
                          const parsed = self.parseFn(raw);
                          self.state = Object.assign({}, parsed, { updatedAt: new Date().toISOString() });
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
                throw new Error('AudicomSqlNowPlaying: falta configurar la consulta SQL (setCustomQuery).');
        }
        throw new Error('Conexion SQL a AudiCom todavia no implementada.');
  }
}

module.exports = { searchTrack: searchTrack, ManualNowPlaying: ManualNowPlaying, FileNowPlaying: FileNowPlaying, AudicomSqlNowPlaying: AudicomSqlNowPlaying };
