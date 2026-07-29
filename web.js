'use strict';

const path = require('path');
const { createServer } = require('./main/server');

const PORT = process.env.PORT || 4173;
const configPath = path.join(__dirname, 'data', 'stations.json');
const rendererDir = path.join(__dirname, 'renderer');

createServer({ configPath, rendererDir, port: PORT })
  .then(() => {
        console.log('Cabina IA (modo web) escuchando en el puerto ' + PORT);
  })
  .catch((err) => {
        console.error('No se pudo iniciar el servidor:', err);
        process.exit(1);
  });
