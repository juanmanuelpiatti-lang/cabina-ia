'use strict';
/**
 * PNT: Publicidad No Tradicional. Los textos que el conductor tiene que
 * leer al aire en su turno, cargados con horario y cliente, y marcados
 * como "hecho" a medida que se leen. Permite reporte de lo emitido.
 *
 * Pensado para que se pueda cargar "desde afuera": el equipo comercial
 * puede pegarlos vía la API (POST /api/pnt) además de la carga manual
 * desde el dashboard.
 */

const fs = require('fs');
const path = require('path');

function defaultData() {
  return { items: [] };
}

class PntStore {
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

  list(stationId) {
    const data = this.read();
    return data.items
      .filter((i) => i.stationId === stationId)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  add(stationId, entry) {
    const data = this.read();
    const item = {
      id: 'pnt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      stationId: stationId,
      time: (entry.time || '').trim(),
      turno: (entry.turno || 'General').trim(),
      client: (entry.client || '').trim(),
      text: (entry.text || '').trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    data.items.push(item);
    this.write(data);
    return item;
  }

  markDone(id) {
    const data = this.read();
    const item = data.items.find((i) => i.id === id);
    if (!item) throw new Error('PNT no encontrado: ' + id);
    item.status = 'done';
    item.completedAt = new Date().toISOString();
    this.write(data);
    return item;
  }

  markPending(id) {
    const data = this.read();
    const item = data.items.find((i) => i.id === id);
    if (!item) throw new Error('PNT no encontrado: ' + id);
    item.status = 'pending';
    item.completedAt = null;
    this.write(data);
    return item;
  }

  remove(id) {
    const data = this.read();
    data.items = data.items.filter((i) => i.id !== id);
    this.write(data);
  }

  /** Reporte de PNT ya emitidos, agrupados por turno. Filtra por fecha
   *  (YYYY-MM-DD, según completedAt) si se pasa opts.date. */
  report(stationId, opts) {
    opts = opts || {};
    const done = this.list(stationId).filter((i) => i.status === 'done');
    const filtered = opts.date
      ? done.filter((i) => (i.completedAt || '').slice(0, 10) === opts.date)
      : done;
    const byTurno = {};
    filtered.forEach((i) => {
      const key = i.turno || 'General';
      if (!byTurno[key]) byTurno[key] = [];
      byTurno[key].push(i);
    });
    return { date: opts.date || null, total: filtered.length, byTurno: byTurno };
  }
}

module.exports = { PntStore };
