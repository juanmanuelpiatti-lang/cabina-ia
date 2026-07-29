'use strict';

const fetch = require('node-fetch');

function googleMapsTrafficUrl(city) {
    return 'https://www.google.com/maps/@' + city.lat + ',' + city.lon + ',13z/data=!5m1!1e1';
}

async function getTomTomIncidents(city, apiKey) {
    if (!apiKey) return null;
    const d = 0.15;
    const bbox = (city.lon - d) + ',' + (city.lat - d) + ',' + (city.lon + d) + ',' + (city.lat + d);
    const url = 'https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=' + bbox + '&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,events{description}}}}&language=es-AR&key=' + apiKey;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TomTom error ' + res.status);
    const json = await res.json();
    return (json.incidents || []).map((i) => ({
          category: i.properties && i.properties.iconCategory,
          description: i.properties && i.properties.events && i.properties.events.map((e) => e.description).join(', ')
    }));
}

async function getTrafficForCity(city, opts) {
    opts = opts || {};
    const result = { city: city.name, mapsUrl: googleMapsTrafficUrl(city), incidents: null };
    if (opts.tomtomApiKey) {
          try {
                  result.incidents = await getTomTomIncidents(city, opts.tomtomApiKey);
          } catch (err) {
                  result.incidentsError = err.message;
          }
    }
    return result;
}

async function getTrafficForCities(cities, opts) {
    opts = opts || {};
    return Promise.all(cities.map((c) => getTrafficForCity(c, opts)));
}

module.exports = { googleMapsTrafficUrl: googleMapsTrafficUrl, getTrafficForCity: getTrafficForCity, getTrafficForCities: getTrafficForCities };
