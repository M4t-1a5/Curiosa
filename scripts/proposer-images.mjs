// Propose une image libre de droits pour chaque fiche qui n'en a pas encore.
//
//   npm run proposer-images              (toutes les fiches sans image)
//   npm run proposer-images -- <fichier> (une seule fiche, ou un brouillon)
//
// Méthode, sans rien inventer : pour chaque page Wikipédia citée dans « sources »,
// on lit l'image principale de l'article (et l'image « P18 » de Wikidata), puis on
// demande à Wikimedia Commons sa licence, son auteur et sa taille. Seules les images
// dans le domaine public ou en CC0 sont proposées.
// Le script n'écrit rien : il affiche un bloc « image: » à relire, à compléter
// (texte alternatif) et à coller dans la fiche.
import { DOSSIER_FICHES, lireFiche, listerFiches } from './lib/catalogue.mjs';
import { USER_AGENT } from './lib/http.mjs';

const LARGEUR = 3000; // largeur demandée à Commons : de quoi servir des écrans très denses

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimédia limite le nombre de requêtes : on espace les appels et on réessaie après un refus (429).
async function json(url) {
  for (let essai = 1; ; essai++) {
    await pause(400);
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
    if (r.ok) return r.json();
    if (r.status !== 429 || essai === 5) throw new Error(`statut ${r.status} pour ${url}`);
    await pause(5000 * essai);
  }
}

// Traduit la licence affichée par Commons en l'une des deux valeurs acceptées par le schéma.
export function licenceDe(meta) {
  const nom = (meta.LicenseShortName?.value ?? '').toLowerCase();
  if (/public domain|domaine public|^pd|no restrictions/.test(nom)) return 'domaine public';
  if (/^cc0/.test(nom)) return 'CC0';
  return undefined; // autre licence (CC BY, CC BY-SA…) ou inconnue : image écartée
}

const texte = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Fichiers Commons candidats pour une page Wikipédia : image de l'article, puis P18 de Wikidata. */
async function fichiersPour(urlWikipedia) {
  const u = new URL(urlWikipedia);
  const titre = decodeURIComponent(u.pathname.replace('/wiki/', ''));
  const api = `${u.origin}/w/api.php?action=query&format=json&redirects=1&prop=pageimages|pageprops&piprop=original&titles=${encodeURIComponent(titre)}`;
  const page = Object.values((await json(api)).query?.pages ?? {})[0] ?? {};
  const fichiers = [];
  const original = page.original?.source;
  if (original) fichiers.push(decodeURIComponent(original.split('/').pop()));
  const qid = page.pageprops?.wikibase_item;
  if (qid) {
    const e = (await json(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).entities[qid];
    for (const c of e?.claims?.P18 ?? []) {
      const nom = c.mainsnak?.datavalue?.value;
      if (nom) fichiers.push(nom.replace(/ /g, '_'));
    }
  }
  return [...new Set(fichiers)];
}

/** Licence, auteur et taille d'un fichier Commons. */
async function infos(fichier) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=size|extmetadata|mime&titles=File:${encodeURIComponent(fichier)}`;
  const page = Object.values((await json(api)).query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return undefined;
  const meta = ii.extmetadata ?? {};
  return {
    fichier,
    largeur: ii.width,
    hauteur: ii.height,
    mime: ii.mime,
    licence: licenceDe(meta),
    licenceCommons: meta.LicenseShortName?.value,
    auteur: texte(meta.Artist?.value),
    description: texte(meta.ImageDescription?.value).slice(0, 200),
  };
}

const fichiers = process.argv[2] ? [process.argv[2]] : listerFiches(DOSSIER_FICHES);
for (const chemin of fichiers) {
  const { id, donnees } = lireFiche(chemin);
  if (donnees.image && !process.argv[2]) continue;
  const pages = (donnees.sources ?? []).filter((url) => /wikipedia\.org\/wiki\//.test(url));
  console.log(`\n# ${id}`);
  const vus = new Set();
  for (const page of pages) {
    let candidats = [];
    try {
      candidats = await fichiersPour(page);
    } catch (erreur) {
      console.log(`⚠ ${page} : ${erreur.message}`);
    }
    for (const fichier of candidats) {
      if (vus.has(fichier)) continue;
      vus.add(fichier);
      const i = await infos(fichier).catch(() => undefined);
      if (!i) continue;
      const ok = i.licence && /image\/(jpeg|png|webp|tiff)/.test(i.mime);
      console.log(`${ok ? '✔' : '✘'} ${i.fichier}  ${i.largeur}×${i.hauteur}  ${i.licenceCommons ?? '?'}  ${i.auteur}`);
      if (i.description) console.log(`    ${i.description}`);
    }
  }
}
