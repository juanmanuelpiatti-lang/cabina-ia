# Cabina IA - Productor Virtual

Dashboard unico para el locutor/productor al aire: musica, clima, transito, ultimo momento y panorama de noticias horario. Multi-estacion: cada radio (Mar del Plata, Pinamar, Villa Gesell, etc.) tiene su propia configuracion de ciudad, fuentes de noticias y musica.

## Version online (recomendada, sin instalar nada)

Este repo incluye `web.js`, un punto de entrada que corre el mismo servidor como servicio web (sin Electron), pensado para hostear gratis en Render.com. Una vez desplegado, cualquier PC (Mac o Windows) de cualquier radio abre la URL publica en el navegador y usa el dashboard, sin instalar nada.

Deploy en Render.com (gratis):
1. Crear cuenta en render.com (se puede con GitHub).
2. New + -> Web Service -> conectar este repositorio.
3. Build Command: `npm install --omit=dev`
4. Start Command: `node web.js`
5. Plan: Free.
6. Deploy. Render te da una URL publica tipo https://cabina-ia.onrender.com

Nota: el plan gratis "duerme" el servicio si nadie lo usa por un rato; la primera carga despues de estar dormido puede tardar unos segundos en despertar.

## Version de escritorio (Mac / Windows, opcional)

```
npm install
npm start
```

Para generar instalables:
```
npm run dist:mac
npm run dist:win
```

## Configurar estaciones

Dentro de la app, boton "Gestionar estaciones": nombre, ciudad (lat/lon), palabras clave de "ultimo momento", fuentes de noticias RSS, y panorama con IA opcional (Anthropic/OpenAI, se puede dejar sin configurar y usa una plantilla gratis).

Ciudades de la costa (lat/lon para copiar):

| Ciudad | Latitud | Longitud |
|---|---|---|
| Mar del Plata | -38.0055 | -57.5426 |
| Pinamar | -37.1074 | -56.8611 |
| Villa Gesell | -37.2632 | -56.9738 |
| Necochea | -38.5545 | -58.7392 |
| Miramar | -38.2696 | -57.8397 |

## Que hace cada panel

- Ultimo momento: revisa las fuentes de noticias cada 3 minutos y marca titulos recientes con palabras clave de alerta.
- Al aire (musica): buscador de temas via iTunes Search (gratis, sin cuenta). Marcas un resultado como Sonando o Sigue.
- Clima: actual + pronostico 4 dias, via Open-Meteo (gratis, sin API key).
- Transito: boton que abre la vista de transito en vivo de Google Maps para la ciudad configurada.
- Panorama de noticias: se genera automaticamente cada hora y a demanda con el boton "Generar ahora".

## Integracion con AudiCom (pendiente)

AudiCom (Solidyne) no publica un esquema de base de datos ni una API abierta documentada. `modules/music.js` ya tiene preparados dos caminos: `audicom-file` (observa un archivo de texto que AudiCom exporte con el tema al aire) y `audicom-sql` (conexion directa a la base, pendiente de la consulta SQL exacta que confirme el soporte tecnico de AudiCom en cada radio). Mientras tanto el modo `manual` deja usar la app 100% desde el dia uno.

## Estructura

```
main/         proceso Electron + servidor HTTP embebido (version de escritorio)
web.js        punto de entrada para la version online (sin Electron)
renderer/     dashboard (HTML/CSS/JS)
modules/      logica: clima, transito, noticias, musica, config de estaciones
data/         config guardada (se genera sola al primer uso)
```
