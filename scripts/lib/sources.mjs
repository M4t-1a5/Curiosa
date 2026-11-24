// Interrogation des sources ouvertes (Wikidata, Wikipédia, Wikisource, Gutenberg, musées, arXiv…).
// Chaque fonction renvoie des « candidats » : { titre, url, source, details }.
// Aucune URL n'est jamais fabriquée par l'IA : elles viennent toutes d'ici, puis sont vérifiées.
import { USER_AGENT } from './http.mjs';

async function json(url) {
  const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${url}`);
  return reponse.json();
}

async function texte(url) {
  const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30000) });
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${url}`);
  return reponse.text();
}

const q = encodeURIComponent;
const wiki = (hote, titre) => `https://${hote}/wiki/${titre.replace(/ /g, '_')}`;

// ---------- Wikidata : le pivot qui relie une œuvre à ses ressources libres ----------

/** Identifiants externes Wikidata → adresse de la ressource. */
const IDENTIFIANTS = {
  P2034: { source: 'Project Gutenberg', url: (v) => `https://www.gutenberg.org/ebooks/${v}` },
  P724: { source: 'Internet Archive', url: (v) => `https://archive.org/details/${v}` },
  P839: { source: 'IMSLP', url: (v) => `https://imslp.org/wiki/${v.replace(/ /g, '_')}` },
  P3123: { source: 'Stanford Encyclopedia of Philosophy', url: (v) => `https://plato.stanford.edu/entries/${v}/` },
  P4610: { source: 'Art Institute of Chicago', url: (v) => `https://www.artic.edu/artworks/${v}` },
  P3634: { source: 'Metropolitan Museum of Art', url: (v) => `https://www.metmuseum.org/art/collection/search/${v}` },
  P818: { source: 'arXiv', url: (v) => `https://arxiv.org/abs/${v}` },
  P932: { source: 'PubMed Central', url: (v) => `https://pmc.ncbi.nlm.nih.gov/articles/PMC${v}/` },
  P4258: { source: 'Gallica (BnF)', url: (v) => `https://gallica.bnf.fr/ark:/12148/${v}` },
};

export async function chercherWikidata(recherche, limite = 5) {
  const r = await json(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q(recherche)}&language=fr&uselang=fr&type=item&limit=${limite}&format=json`);
  return (r.search ?? []).map((e) => ({ titre: e.label, url: `https://www.wikidata.org/wiki/${e.id}`, source: 'Wikidata', details: e.description ?? '', id: e.id }));
}

function valeurs(entite, propriete) {
  return (entite.claims?.[propriete] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
}

function annee(valeur) {
  // « +1902-09-01T00:00:00Z » avec une précision : 9 = année, 8 = décennie, 7 = siècle
  if (!valeur?.time) return undefined;
  const a = parseInt(valeur.time.slice(0, valeur.time.indexOf('-', 1)), 10);
  if (valeur.precision === 7) return `${Math.ceil(Math.abs(a) / 100)}ᵉ siècle${a < 0 ? ' av. J.-C.' : ''}`;
  if (valeur.precision === 8) return `années ${a}`;
  return a < 0 ? `${-a} av. J.-C.` : String(a);
}

async function libelles(ids) {
  if (!ids.length) return {};
  const r = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=fr|en&format=json`);
  return Object.fromEntries(Object.entries(r.entities ?? {}).map(([id, e]) => [id, e.labels?.fr?.value ?? e.labels?.en?.value ?? id]));
}

/** Les faits structurés d'un élément Wikidata, et les ressources libres qu'il référence. */
export async function faitsWikidata(id) {
  const r = await json(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`);
  const e = r.entities[id];
  const idsCreateurs = ['P50', 'P170', 'P86', 'P57'].flatMap((p) => valeurs(e, p).map((v) => v.id));
  const noms = await libelles(idsCreateurs);
  const faits = {
    wikidata: `https://www.wikidata.org/wiki/${id}`,
    libelle: e.labels?.fr?.value ?? e.labels?.en?.value,
    description: e.descriptions?.fr?.value ?? e.descriptions?.en?.value,
    createurs: idsCreateurs.map((i) => noms[i]),
    date: annee(valeurs(e, 'P577')[0]) ?? annee(valeurs(e, 'P571')[0]),
    naissance: annee(valeurs(e, 'P569')[0]),
    deces: annee(valeurs(e, 'P570')[0]),
    wikipedia_fr: e.sitelinks?.frwiki ? wiki('fr.wikipedia.org', e.sitelinks.frwiki.title) : undefined,
    wikipedia_en: e.sitelinks?.enwiki ? wiki('en.wikipedia.org', e.sitelinks.enwiki.title) : undefined,
    image_commons: valeurs(e, 'P18')[0],
    idsCreateurs,
  };
  const ressources = [];
  if (e.sitelinks?.frwikisource) {
    ressources.push({ titre: e.sitelinks.frwikisource.title, url: wiki('fr.wikisource.org', e.sitelinks.frwikisource.title), source: 'Wikisource' });
  }
  for (const [propriete, { source, url }] of Object.entries(IDENTIFIANTS)) {
    for (const v of valeurs(e, propriete)) ressources.push({ titre: `${source} : ${v}`, url: url(String(v)), source });
  }
  return { faits, ressources };
}

/** Année de décès des créateurs (pour savoir si l'œuvre est dans le domaine public). */
export async function decesCreateurs(ids) {
  const annees = [];
  for (const id of ids.slice(0, 3)) {
    const r = await json(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`);
    const v = valeurs(r.entities[id], 'P570')[0];
    if (v?.time) annees.push(parseInt(v.time.slice(1, 5), 10));
  }
  return annees;
}

// ---------- Wikipédia et Wikisource ----------

export async function chercherWikipedia(recherche, limite = 5) {
  const r = await json(`https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q(recherche)}&srlimit=${limite}&format=json`);
  return (r.query?.search ?? []).map((p) => ({ titre: p.title, url: wiki('fr.wikipedia.org', p.title), source: 'Wikipédia', details: p.snippet.replace(/<[^>]+>/g, '') }));
}

/** Renvoie l'URL d'un article de Wikipédia s'il existe (en suivant les redirections). */
export async function articleWikipedia(titre) {
  const r = await json(`https://fr.wikipedia.org/w/api.php?action=query&titles=${q(titre)}&redirects=1&format=json`);
  const page = Object.values(r.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || page.pageid === undefined) return undefined;
  return wiki('fr.wikipedia.org', page.title);
}

/** Texte brut d'un article de Wikipédia (contexte donné à Claude). */
export async function extraitWikipedia(url, maxCaracteres = 15000) {
  const titre = decodeURIComponent(new URL(url).pathname.replace('/wiki/', ''));
  const r = await json(`https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=${q(titre)}&format=json`);
  const page = Object.values(r.query?.pages ?? {})[0];
  return (page?.extract ?? '').slice(0, maxCaracteres);
}

export async function chercherWikisource(recherche, limite = 5) {
  const r = await json(`https://fr.wikisource.org/w/api.php?action=query&list=search&srsearch=${q(recherche)}&srnamespace=0&srlimit=${limite}&format=json`);
  return (r.query?.search ?? []).map((p) => ({ titre: p.title, url: wiki('fr.wikisource.org', p.title), source: 'Wikisource', details: p.snippet.replace(/<[^>]+>/g, '') }));
}

// ---------- Livres ----------

export async function chercherGutenberg(recherche, limite = 5) {
  const r = await json(`https://gutendex.com/books/?search=${q(recherche)}`);
  return (r.results ?? []).slice(0, limite).map((l) => ({
    titre: l.title,
    url: `https://www.gutenberg.org/ebooks/${l.id}`,
    source: 'Project Gutenberg',
    details: `${l.authors.map((a) => a.name).join(', ')} (langue : ${l.languages.join(', ')})`,
  }));
}

// ---------- Tableaux ----------

export async function chercherArtInstitute(recherche, limite = 5) {
  const r = await json(`https://api.artic.edu/api/v1/artworks/search?q=${q(recherche)}&limit=${limite}&fields=id,title,artist_title,date_display,image_id,is_public_domain`);
  return (r.data ?? []).map((o) => ({
    titre: o.title,
    url: `https://www.artic.edu/artworks/${o.id}`,
    source: 'Art Institute of Chicago',
    details: `${o.artist_title ?? '?'}, ${o.date_display ?? '?'}${o.is_public_domain ? ', domaine public' : ', sous droits'}`,
    image: o.is_public_domain && o.image_id ? `https://www.artic.edu/iiif/2/${o.image_id}/full/1686,/0/default.jpg` : undefined,
  }));
}

export async function chercherMet(recherche, limite = 3) {
  const r = await json(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${q(recherche)}`);
  const candidats = [];
  for (const id of (r.objectIDs ?? []).slice(0, limite)) {
    const o = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    candidats.push({
      titre: o.title,
      url: o.objectURL,
      source: 'Metropolitan Museum of Art',
      details: `${o.artistDisplayName || '?'}, ${o.objectDate || '?'}${o.isPublicDomain ? ', domaine public' : ', sous droits'}`,
      image: o.isPublicDomain && o.primaryImageSmall ? o.primaryImageSmall : undefined,
    });
  }
  return candidats;
}

// ---------- Articles de recherche ----------

export async function chercherArxiv(recherche, limite = 5) {
  const xml = await texte(`https://export.arxiv.org/api/query?search_query=${q(`ti:"${recherche}"`)}&max_results=${limite}`);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entree]) => {
    const champ = (nom) => (entree.match(new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`))?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const auteurs = [...entree.matchAll(/<name>(.*?)<\/name>/g)].map((m) => m[1]);
    return { titre: champ('title'), url: champ('id').replace('http://', 'https://').replace(/v\d+$/, ''), source: 'arXiv', details: `${auteurs.slice(0, 4).join(', ')} (${champ('published').slice(0, 4)})` };
  });
}

export async function chercherOpenAlex(recherche, limite = 5) {
  const r = await json(`https://api.openalex.org/works?search=${q(recherche)}&per_page=${limite}`);
  return (r.results ?? []).map((t) => ({
    titre: t.title,
    url: t.open_access?.oa_url ?? t.id,
    source: 'OpenAlex',
    details: `${(t.authorships ?? []).slice(0, 4).map((a) => a.author?.display_name).join(', ')} (${t.publication_year}), ${t.cited_by_count} citations${t.open_access?.is_oa ? ', en accès libre' : ''}`,
  }));
}

// ---------- Musique et films ----------

export async function chercherInternetArchive(recherche, typeMedia, limite = 5) {
  const requete = `title:(${recherche})${typeMedia ? ` AND mediatype:${typeMedia}` : ''}`;
  const r = await json(`https://archive.org/advancedsearch.php?q=${q(requete)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=year&rows=${limite}&output=json`);
  return (r.response?.docs ?? []).map((d) => ({
    titre: d.title,
    url: `https://archive.org/details/${d.identifier}`,
    source: 'Internet Archive',
    details: `${d.year ?? ''} ${d.licenseurl ? `licence : ${d.licenseurl}` : 'licence non précisée : vérifier le statut juridique'}`.trim(),
  }));
}

/** Toutes les recherches disponibles, par nom (utilisé par « npm run chercher »). */
export const RECHERCHES = {
  wikidata: chercherWikidata,
  wikipedia: chercherWikipedia,
  wikisource: chercherWikisource,
  gutenberg: chercherGutenberg,
  aic: chercherArtInstitute,
  met: chercherMet,
  arxiv: chercherArxiv,
  openalex: chercherOpenAlex,
  archive: (r) => chercherInternetArchive(r),
};

/** Les recherches pertinentes pour chaque type de fiche. */
export const RECHERCHES_PAR_TYPE = {
  livre: [chercherWikisource, chercherGutenberg],
  tableau: [chercherArtInstitute, chercherMet],
  papier: [chercherArxiv, chercherOpenAlex],
  podcast: [],
  auteur: [],
  idee: [],
  musique: [(r) => chercherInternetArchive(r, 'audio')],
  film: [(r) => chercherInternetArchive(r, 'movies')],
};
