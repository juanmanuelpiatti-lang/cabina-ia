'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_NEWS_SOURCES = [
  { name: 'Infobae', rss: 'https://www.infobae.com/arc/outboundfeeds/rss/' },
  { name: 'La Nacion', rss: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/' }
  ];

const DEFAULT_CITIES = [
  { name: 'Mar del Plata', lat: -38.0055, lon: -57.5426 },
  { name: 'Pinamar', lat: -37.1074, lon: -56.8611 },
  { name: 'Villa Gesell', lat: -37.2632, lon: -56.9738 },
  { name: 'Necochea', lat: -38.5545, lon: -58.7392 },
  { name: 'Miramar', lat: -38.2696, lon: -57.8397 }
  ];

function defaultData() {
    return {
          activeStationId: 'demo',
          stations: [
            {
                      id: 'demo',
                      name: 'Radio Demo',
                      city: DEFAULT_CITIES[0],
                      newsSources: DEFAULT_NEWS_SOURCES,
                      breakingKeywords: ['ultimo momento', 'urgente', 'de ultimo momento', 'alerta'],
                      musicSource: {
                                  type: 'manual',
                                  filePath: '',
                                  sql: { host: '', port: '', database: '', user: '', password: '', driver: 'sqlserver' }
                      },
                      panoramaFrequencyMinutes: 60,
                      llm: { provider: 'none', apiKey: '' }
            }
                ],
          knownCities: DEFAULT_CITIES
    };
}

class ConfigStore {
    constructor(filePath) {
          this.filePath = filePath;
          this._ensure();
    }

  _ensure() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(this.filePath)) {
                fs.writeFileSync(this.filePath, JSON.stringify(defaultData(), null, 2));
        }
  }

  read() {
        this._ensure();
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
  }

  write(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        return data;
  }

  getActiveStation() {
        const data = this.read();
        return data.stations.find((s) => s.id === data.activeStationId) || data.stations[0];
  }

  setActiveStation(id) {
        const data = this.read();
        if (!data.stations.some((s) => s.id === id)) throw new Error('Estacion no encontrada: ' + id);
        data.activeStationId = id;
        return this.write(data);
  }

  upsertStation(station) {
        const data = this.read();
        const idx = data.stations.findIndex((s) => s.id === station.id);
        if (idx >= 0) data.stations[idx] = station;
        else data.stations.push(station);
        return this.write(data);
  }

  removeStation(id) {
        const data = this.read();
        data.stations = data.stations.filter((s) => s.id !== id);
        if (data.activeStationId === id && data.stations.length) data.activeStationId = data.stations[0].id;
        return this.write(data);
  }
}

module.exports = { ConfigStore: ConfigStore, DEFAULT_NEWS_SOURCES: DEFAULT_NEWS_SOURCES, DEFAULT_CITIES: DEFAULT_CITIES, defaultData: defaultData };
