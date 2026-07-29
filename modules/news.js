'use strict';

const Parser = require('rss-parser');
const fetch = require('node-fetch');

const parser = new Parser({ requestOptions: { timeout: 10000 } });

async function fetchSource(source) {
    try {
          const feed = await parser.parseURL(source.rss);
          return (feed.items || []).slice(0, 15).map((item) => ({
                  source: source.name,
                  title: item.title,
                  link: item.link,
                  pubDate: item.pubDate ? new Date(item.pubDate) : null,
                  contentSnippet: (item.contentSnippet || '').slice(0, 280)
          }));
    } catch (err) {
          return [{ source: source.name, error: err.message }];
    }
}

async function fetchAllNews(sources) {
    const perSource = await Promise.all(sources.map(fetchSource));
    const items = perSource.flat().filter((i) => !i.error);
    items.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    return items;
}

function detectBreaking(items, keywords, maxAgeMinutes) {
    maxAgeMinutes = maxAgeMinutes || 30;
    const now = Date.now();
    const kws = keywords.map((k) => k.toLowerCase());
    return items.filter((item) => {
          const isFresh = item.pubDate && (now - item.pubDate.getTime()) / 60000 <= maxAgeMinutes;
          const title = (item.title || '').toLowerCase();
          const matchesKeyword = kws.some((k) => title.includes(k));
          return isFresh && matchesKeyword;
    });
}

function templatePanorama(items, stationName) {
    const top = items.slice(0, 8);
    const now = new Date();
    const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const lines = [];
    lines.push('Panorama de noticias - ' + hora + ' hs (' + stationName + ')');
    lines.push('');
    top.forEach((item, i) => {
          lines.push((i + 1) + '. ' + item.title + ' (' + item.source + ')');
    });
    lines.push('');
    lines.push('Guion sugerido para leer al aire:');
    lines.push(
          '"Repasamos lo mas importante de esta hora. ' +
          top.slice(0, 5).map((i) => i.title).join('. Ademas, ') +
          '. Seguimos informando."'
        );
    return lines.join('\n');
}

async function llmPanorama(cfg, items, stationName) {
    const provider = cfg.provider;
    const apiKey = cfg.apiKey;
    const top = items.slice(0, 10);
    const headlines = top.map((i) => '- (' + i.source + ') ' + i.title).join('\n');
    const prompt = 'Sos el productor de una radio (' + stationName + '). Con estos titulares de la ultima hora, ' +
          'escribi un panorama de noticias de 120-180 palabras, en espanol rioplatense, listo para que un locutor ' +
          'lo lea al aire. Tono claro y neutral, sin opiniones. Empeza directamente con el texto, sin encabezados.\n\n' + headlines;

  if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                          'content-type': 'application/json',
                          'x-api-key': apiKey,
                          'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                          model: 'claude-sonnet-4-5-20250929',
                          max_tokens: 400,
                          messages: [{ role: 'user', content: prompt }]
                })
        });
        if (!res.ok) throw new Error('Anthropic error ' + res.status);
        const json = await res.json();
        return json.content && json.content[0] && json.content[0].text;
  }

  if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
                body: JSON.stringify({
                          model: 'gpt-4o-mini',
                          messages: [{ role: 'user', content: prompt }],
                          max_tokens: 400
                })
        });
        if (!res.ok) throw new Error('OpenAI error ' + res.status);
        const json = await res.json();
        return json.choices && json.choices[0] && json.choices[0].message.content;
  }

  throw new Error('Proveedor LLM desconocido: ' + provider);
}

async function buildPanorama(items, stationName, llmConfig) {
    if (llmConfig && llmConfig.provider && llmConfig.provider !== 'none' && llmConfig.apiKey) {
          try {
                  const text = await llmPanorama(llmConfig, items, stationName);
                  return { text: text, generatedBy: llmConfig.provider };
          } catch (err) {
                  return { text: templatePanorama(items, stationName), generatedBy: 'plantilla (fallback: ' + err.message + ')' };
          }
    }
    return { text: templatePanorama(items, stationName), generatedBy: 'plantilla' };
}

module.exports = { fetchAllNews: fetchAllNews, detectBreaking: detectBreaking, buildPanorama: buildPanorama, templatePanorama: templatePanorama };
