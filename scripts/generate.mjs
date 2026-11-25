// Prépare un brouillon de fiche à partir d'un titre et d'un type.
//
//   npm run generate -- "Les Méditations" livre
//   npm run generate -- "La Grande Vague de Kanagawa" tableau --date 2026-12-24
//   npm run generate -- "Le Voyage dans la Lune" film --ressource https://archive.org/details/...
//   npm run generate -- "Attention Is All You Need" papier --sans-claude   (sources seulement)
//
// Étapes : 1. Wikidata et les API des sources fournissent les faits et des liens candidats ;
// 2. chaque lien est vérifié (statut 200) ; 3. Claude rédige la fiche à partir de ces seuls
// éléments, sans jamais écrire d'URL ; 4. le brouillon est écrit dans drafts/ pour relecture.
// Puis : relire, corriger, et « npm run publier -- drafts/<fichier>.md ».
//
// Nécessite une clé API Anthropic dans la variable ANTHROPIC_API_KEY (fichier .env accepté).
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  DOSSIER_BROUILLONS, DOSSIER_FICHES, TYPES, dateDe, domaineAutorise, lireFiche, listerFiches, slugifier,
} from './lib/catalogue.mjs';
import { verifierLien } from './lib/http.mjs';
import {
  RECHERCHES_PAR_TYPE, articleWikipedia, chercherWikidata, decesCreateurs, extraitWikipedia, faitsWikidata,
} from './lib/sources.mjs';

// ---------- Arguments ----------

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positionnels = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(date|ressource|wikidata)$/));
const [titreDemande, type] = positionnels;
const TYPES_VALIDES = TYPES.map((t) => t.id);

if (!titreDemande || !TYPES_VALIDES.includes(type)) {
  console.error(`Usage : npm run generate -- "Titre de l'œuvre" <type> [--date AAAA-MM-JJ] [--ressource URL] [--wikidata Q123] [--sans-claude]
Types : ${TYPES_VALIDES.join(', ')}`);
  process.exit(1);
}
const sansClaude = args.includes('--sans-claude');

if (fs.existsSync('.env')) process.loadEnvFile('.env');
if (!sansClaude && !process.env.ANTHROPIC_API_KEY) {
  console.error('Clé API manquante : ajoutez ANTHROPIC_API_KEY=... dans un fichier .env (voir README), ou utilisez --sans-claude.');
  process.exit(1);
}

const etape = (texte) => console.log(`\n▸ ${texte}`);
const essayer = async (nom, fn) => {
  try {
    return await fn();
  } catch (erreur) {
    console.warn(`  ⚠ ${nom} : ${erreur.message}`);
    return undefined;
  }
};

// ---------- 1. Faits et liens candidats ----------

etape(`Recherche de « ${titreDemande} » sur Wikidata`);
let idWikidata = option('wikidata');
if (!idWikidata) {
  const resultats = (await essayer('Wikidata', () => chercherWikidata(titreDemande))) ?? [];
  for (const r of resultats) console.log(`  ${r.id}  ${r.titre} : ${r.details}`);
  idWikidata = resultats[0]?.id;
  if (resultats.length > 1) console.log(`  → je retiens ${idWikidata}. Si ce n'est pas le bon, relancez avec --wikidata <identifiant>.`);
}

let faits = {};
let candidats = [];
if (idWikidata) {
  const r = await essayer('Wikidata', () => faitsWikidata(idWikidata));
  if (r) {
    faits = r.faits;
    candidats = r.ressources;
  }
}

etape('Recherche de ressources dans les sources ouvertes');
for (const chercher of RECHERCHES_PAR_TYPE[type]) {
  const trouves = (await essayer(chercher.name || 'recherche', () => chercher(titreDemande))) ?? [];
  candidats.push(...trouves);
}
const ressourceImposee = option('ressource');
if (ressourceImposee) candidats.unshift({ titre: 'Ressource indiquée', url: ressourceImposee, source: 'indiquée à la main' });
if (faits.wikipedia_fr) candidats.push({ titre: `Article Wikipédia`, url: faits.wikipedia_fr, source: 'Wikipédia' });

// Dédoublonnage, liste blanche, puis vérification HTTP de chaque candidat.
const vus = new Set();
candidats = candidats.filter((c) => c.url && !vus.has(c.url) && vus.add(c.url) && domaineAutorise(c.url));
etape(`Vérification de ${candidats.length} liens candidats`);
for (const c of candidats) {
  c.verification = await verifierLien(c.url);
  console.log(`  ${c.verification.ok ? '✔' : '✘'} ${c.source} : ${c.titre} ${c.details ? `(${c.details})` : ''}\n     ${c.url}`);
}
const ressourcesVerifiees = candidats.filter((c) => c.verification.ok);
if (!ressourcesVerifiees.length) {
  console.error('\nAucune ressource gratuite et vérifiée trouvée. Indiquez-en une avec --ressource <URL> (domaine autorisé dans src/data/sources.json).');
  process.exit(1);
}

// Image : seulement pour un tableau, et seulement si elle est dans le domaine public.
let image;
if (type === 'tableau') {
  const avecImage = candidats.find((c) => c.verification.ok && c.image);
  if (avecImage) {
    image = { url: avecImage.image, credit: avecImage.source, licence: avecImage.source === 'Art Institute of Chicago' ? 'CC0' : 'domaine public' };
  } else if (faits.image_commons) {
    const deces = (await essayer('dates de décès', () => decesCreateurs(faits.idsCreateurs))) ?? [];
    if (deces.length && Math.max(...deces) < new Date().getFullYear() - 70) {
      image = { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(faits.image_commons)}?width=1600`, credit: 'Wikimedia Commons', licence: 'domaine public' };
    }
  }
}

const contexte = faits.wikipedia_fr ? (await essayer('extrait Wikipédia', () => extraitWikipedia(faits.wikipedia_fr))) ?? '' : '';

// ---------- Date de publication ----------

function dateLibre() {
  if (option('date')) return option('date');
  const dates = [...listerFiches(DOSSIER_FICHES), ...listerFiches(DOSSIER_BROUILLONS)]
    .map((f) => dateDe(lireFiche(f).donnees))
    .sort();
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const derniere = dates.at(-1);
  if (!derniere || derniere < aujourdhui) return aujourdhui;
  const lendemain = new Date(derniere + 'T00:00:00Z');
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  return lendemain.toISOString().slice(0, 10);
}
const date = dateLibre();

// ---------- 2. Rédaction par Claude ----------

const Brouillon = z.object({
  titre: z.string().describe('Titre français usuel de l’œuvre (ou nom de la personne, ou nom de l’idée)'),
  titre_original: z.string().nullable().describe('Titre dans la langue d’origine s’il diffère, sinon null'),
  createur: z.string().nullable().describe('Auteur, artiste, réalisatrice… ; null pour une personne ou une idée sans auteur unique'),
  epoque: z.string().describe('Année ou période, ex. « 1865 » ou « vers 170-180 » ; pour une personne, ses dates de vie'),
  accroche: z.string().describe('Une phrase de 25 mots au plus qui donne envie de lire la fiche'),
  question: z.string().describe('Une question ouverte et courte à garder en tête pendant la découverte'),
  ressource_numero: z.number().int().describe('Numéro de la ressource choisie dans la liste fournie'),
  ressource_libelle: z.string().describe('Texte du lien, ex. « Lire le texte intégral sur Wikisource »'),
  ressource_note: z.string().nullable().describe('Précision utile : traduction, langue, durée, extrait…'),
  en_quoi_ca_consiste: z.string().describe('Markdown, 1 à 2 paragraphes'),
  ce_que_ca_apporte: z.string().describe('Markdown, 1 à 2 paragraphes'),
  ce_que_ca_a_change: z.string().describe('Markdown, 1 à 2 paragraphes'),
  par_ou_commencer: z.string().describe('Markdown, 1 paragraphe : une porte d’entrée concrète (chapitre, extrait, détail à regarder)'),
  plus_loin: z.array(z.object({
    titre: z.string(),
    type: z.string().describe(`Un de : ${TYPES_VALIDES.join(', ')}, ou un autre mot simple (sculpture, lieu…)`),
    createur: z.string().nullable(),
    pourquoi: z.string().describe('Une à deux phrases : le lien avec l’œuvre du jour'),
    article_wikipedia: z.string().describe('Titre exact de l’article de Wikipédia en français consacré à cette œuvre'),
  })).describe('1 à 3 œuvres liées, dont au moins une dans un autre domaine'),
  a_verifier: z.array(z.string()).describe('Affirmations de la fiche que la personne qui relit doit contrôler en priorité'),
});

const SYSTEME = `Tu rédiges des fiches pour Curiosa, un site personnel qui présente une œuvre par jour pour s'enrichir l'esprit.

Lecteur : un adulte curieux et cultivé, pas spécialiste. Temps de lecture : environ trois minutes (350 à 500 mots pour les quatre sections).
Style : français clair et précis, sans jargon (ou en l'expliquant), phrases courtes, aucune emphase publicitaire, aucun superlatif creux.

Règles absolues :
- N'utilise que les faits présents dans les documents fournis (données Wikidata, extrait de Wikipédia, métadonnées des sources). Si une information n'y figure pas, ne l'écris pas. N'invente ni date, ni chiffre, ni citation, ni anecdote.
- N'écris jamais d'URL. Pour la ressource, choisis un numéro dans la liste fournie ; pour les œuvres liées, donne le titre exact de leur article de Wikipédia en français.
- Pour une œuvre encore protégée par le droit d'auteur, la ressource doit être un extrait légal, une conférence ou une présentation officielle.
- Range dans « a_verifier » toute affirmation dont tu n'es pas certain qu'elle figure dans les documents.

Contenu des sections :
- En quoi ça consiste : ce qu'est l'œuvre, concrètement.
- Ce que ça apporte : pourquoi elle est précieuse aujourd'hui, pour le lecteur.
- Ce que ça a changé : son influence sur son domaine ou sur le monde.
- Par où commencer : une version accessible et précise (un chapitre, un extrait, un ordre de lecture, un détail à regarder).`;

let redaction;
if (!sansClaude) {
  etape('Rédaction du brouillon par Claude');
  const liste = ressourcesVerifiees.map((c, i) => `${i + 1}. [${c.source}] ${c.titre}${c.details ? ` (${c.details})` : ''}`).join('\n');
  const client = new Anthropic();
  const reponse = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // si le modèle refuse, l'API réessaie avec le modèle de secours recommandé
    output_config: { effort: 'high', format: betaZodOutputFormat(Brouillon) },
    system: SYSTEME,
    messages: [{
      role: 'user',
      content: `Œuvre demandée : « ${titreDemande} » (type : ${type}).

Données Wikidata :
${JSON.stringify({ ...faits, idsCreateurs: undefined }, null, 2)}

Ressources gratuites et vérifiées (choisis-en une par son numéro) :
${liste}

Extrait de l'article de Wikipédia :
${contexte || '(aucun)'}`,
    }],
  });
  if (reponse.stop_reason === 'refusal') {
    console.error('Claude a refusé de rédiger cette fiche. Essayez avec --sans-claude et rédigez-la vous-même.');
    process.exit(1);
  }
  redaction = reponse.parsed_output;
  if (!redaction) {
    console.error(`Réponse inattendue de Claude (arrêt : ${reponse.stop_reason}).`);
    process.exit(1);
  }
}

// ---------- 3. Liens des œuvres liées : cherchés et vérifiés, jamais inventés ----------

const plusLoin = [];
for (const lien of (redaction?.plus_loin ?? []).slice(0, 3)) {
  const url = await essayer(`Wikipédia « ${lien.article_wikipedia} »`, () => articleWikipedia(lien.article_wikipedia));
  const verification = url ? await verifierLien(url) : { ok: false };
  if (!verification.ok) {
    console.warn(`  ✘ Œuvre liée écartée faute de lien vérifié : ${lien.titre}`);
    continue;
  }
  plusLoin.push({ titre: lien.titre, type: lien.type, ...(lien.createur ? { createur: lien.createur } : {}), pourquoi: lien.pourquoi, url });
}

// ---------- 4. Écriture du brouillon ----------

const choisie = ressourcesVerifiees[(redaction?.ressource_numero ?? 1) - 1] ?? ressourcesVerifiees[0];
const titre = redaction?.titre ?? faits.libelle ?? titreDemande;
const id = `${date}-${slugifier(titre)}`;
const sources = [faits.wikipedia_fr, faits.wikidata].filter(Boolean);

const entete = {
  date,
  type,
  titre,
  ...(redaction?.titre_original ? { titre_original: redaction.titre_original } : {}),
  ...((redaction?.createur ?? faits.createurs?.[0]) ? { createur: redaction?.createur ?? faits.createurs[0] } : {}),
  epoque: redaction?.epoque ?? faits.date ?? 'À COMPLÉTER',
  accroche: redaction?.accroche ?? 'À COMPLÉTER',
  question: redaction?.question ?? 'À COMPLÉTER',
  ressource: {
    libelle: redaction?.ressource_libelle ?? `Accéder à l'œuvre sur ${choisie.source}`,
    url: choisie.url,
    ...(redaction?.ressource_note ? { note: redaction.ressource_note } : {}),
  },
  plus_loin: plusLoin.length ? plusLoin : [{ titre: 'À COMPLÉTER', type: 'livre', pourquoi: 'À COMPLÉTER', url: 'https://fr.wikipedia.org/wiki/' }],
  ...(image ? { image: { url: image.url, alt: 'À COMPLÉTER : description de l’image pour les personnes aveugles', credit: image.credit, licence: image.licence } } : {}),
  sources,
};

const commentaires = [
  '# BROUILLON à relire avant publication (npm run publier -- <ce fichier>).',
  ...(redaction?.a_verifier?.length ? ['# Points à vérifier en priorité :', ...redaction.a_verifier.map((p) => `#   - ${p}`)] : []),
  '# Autres ressources vérifiées :',
  ...ressourcesVerifiees.filter((c) => c !== choisie).map((c) => `#   - ${c.source} : ${c.url}`),
];

const section = (titre, texte) => `## ${titre}\n\n${(texte ?? 'À COMPLÉTER').trim()}\n`;
const corps = [
  section('En quoi ça consiste', redaction?.en_quoi_ca_consiste),
  section('Ce que ça apporte', redaction?.ce_que_ca_apporte),
  section('Ce que ça a changé', redaction?.ce_que_ca_a_change),
  section('Par où commencer', redaction?.par_ou_commencer),
].join('\n');

fs.mkdirSync(DOSSIER_BROUILLONS, { recursive: true });
const fichier = path.join(DOSSIER_BROUILLONS, `${id}.md`);
fs.writeFileSync(fichier, `---\n${commentaires.join('\n')}\n${stringify(entete, { lineWidth: 0 })}---\n\n${corps}`);

console.log(`\n✔ Brouillon écrit : ${fichier}
  Relisez-le (surtout les points à vérifier), corrigez-le, puis :
  npm run publier -- ${fichier}`);
