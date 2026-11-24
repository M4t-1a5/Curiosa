// Flux RSS des fiches publiées (pour être prévenu sans créer de compte).
import type { APIContext } from 'astro';
import { fichesPubliees, libelleType } from '../lib/catalogue';

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(context: APIContext) {
  const base = new URL(import.meta.env.BASE_URL, context.site);
  const fiches = (await fichesPubliees()).slice(0, 30);
  const items = fiches
    .map((f) => {
      const url = new URL(`oeuvre/${f.id}/`, base).href;
      const titre = `${libelleType(f.data.type)} : ${f.data.titre}${f.data.createur ? `, ${f.data.createur}` : ''}`;
      return `<item><title>${echapper(titre)}</title><link>${url}</link><guid>${url}</guid><pubDate>${f.data.date.toUTCString()}</pubDate><description>${echapper(f.data.accroche)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Curiosa</title><link>${base.href}</link><description>Une œuvre par jour pour s’enrichir l’esprit.</description><language>fr</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
