'use strict';

const fetch = require('node-fetch');

const WEATHER_CODES = {
    0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna debil', 53: 'Llovizna', 55: 'Llovizna intensa',
    56: 'Llovizna helada debil', 57: 'Llovizna helada intensa',
    61: 'Lluvia debil', 63: 'Lluvia', 65: 'Lluvia intensa',
    66: 'Lluvia helada debil', 67: 'Lluvia helada intensa',
    71: 'Nevada debil', 73: 'Nevada', 75: 'Nevada intensa', 77: 'Granizo fino',
    80: 'Chubascos debiles', 81: 'Chubascos', 82: 'Chubascos intensos',
    85: 'Chubascos de nieve debiles', 86: 'Chubascos de nieve intensos',
    95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
};

function describe(code) {
    return WEATHER_CODES[code] || 'Sin datos';
}

async function getWeatherForCity(city) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
          '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m' +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
          '&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=4';

  const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo error ' + res.status + ' para ' + city.name);
    const json = await res.json();

  return {
        city: city.name,
        current: {
                tempC: json.current.temperature_2m,
                feelsLikeC: json.current.apparent_temperature,
                humidity: json.current.relative_humidity_2m,
                precipitationMm: json.current.precipitation,
                windKmh: json.current.wind_speed_10m,
                windGustsKmh: json.current.wind_gusts_10m,
                condition: describe(json.current.weather_code)
        },
        forecast: json.daily.time.map((date, i) => ({
                date: date,
                condition: describe(json.daily.weather_code[i]),
                maxC: json.daily.temperature_2m_max[i],
                minC: json.daily.temperature_2m_min[i],
                rainProbability: json.daily.precipitation_probability_max[i]
        }))
  };
}

async function getWeatherForCities(cities) {
    const results = await Promise.allSettled(cities.map(getWeatherForCity));
    return results.map((r, i) => (
          r.status === 'fulfilled' ? r.value : { city: cities[i].name, error: r.reason.message }
        ));
}

module.exports = { getWeatherForCity: getWeatherForCity, getWeatherForCities: getWeatherForCities };
