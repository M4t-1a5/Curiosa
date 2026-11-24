// Vérifie le catalogue : structure de chaque fiche, domaines autorisés, et liens (statut HTTP 200).
//
//   npm run verify                         tout le catalogue
//   npm run verify -- drafts/ma-fiche.md   un ou plusieurs fichiers (ou dossiers)
//   npm run verify -- --sans-reseau        structure et domaines seulement, sans requête HTTP
//   npm run verify -- --ecrire             enregistre aussi le résultat dans cache/liens-verifies.json,
//                                          que la construction du site utilise pour masquer les liens morts
//
// Code de sortie 1 si une fiche a un problème : la CI GitHub le signale alors par e-mail.
import fs from 'node:fs';
import path from 'node:path';
import {
  DOSSIER_FICHES, SECTIONS, TYPES, dateDe, domaineAutorise, liensDe, lireFiche, listerFiches,
} from './lib/catalogue.mjs';
import { verifierTous } from './lib/http.mjs';

const args = process.argv.slice(2);
const sansReseau = args.includes('--sans-reseau');
const ecrire = args.includes('--ecrire');
const chemins = args.filter((a) => !a.startsWith('--'));

const fichiers = chemins.length
  ? chemins.flatMap((c) => (fs.statSync(c).isDirectory() ? listerFiches(c) : [c]))
  : listerFiches(DOSSIER_FICHES);

const TYPES_VALIDES = TYPES.map((t) => t.id);

/** Contrôles de structure : renvoie une liste de problèmes (texte). */
function controlerStructure(fiche) {
  const p = [];
  const d = fiche.donnees;
  const date = dateDe(d);
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(fiche.id)) p.push('nom de fichier attendu : AAAA-MM-JJ-titre-en-minuscules.md');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) p.push('champ « date » manquant ou mal formé (AAAA-MM-JJ)');
  else if (!fiche.id.startsWith(date)) p.push(`la date du nom de fichier ne correspond pas au champ « date » (${date})`);
  if (!TYPES_VALIDES.includes(d.type)) p.push(`type inconnu « ${d.type} » (attendu : ${TYPES_VALIDES.join(', ')})`);
  for (const champ of ['titre', 'epoque', 'accroche', 'question']) {
    if (!d[champ] || typeof d[champ] !== 'string') p.push(`champ « ${champ} » manquant`);
  }
  if (!d.ressource?.url || !d.ressource?.libelle) p.push('champ « ressource » incomplet (libelle et url obligatoires)');
  const plusLoin = d.plus_loin ?? [];
  if (plusLoin.length < 1 || plusLoin.length > 3) p.push('« plus_loin » doit contenir 1 à 3 œuvres');
  plusLoin.forEach((l, i) => {
    for (const champ of ['titre', 'type', 'pourquoi', 'url']) if (!l?.[champ]) p.push(`plus_loin n° ${i + 1} : champ « ${champ} » manquant`);
  });
  if (!Array.isArray(d.sources) || d.sources.length === 0) p.push('« sources » : au moins une page d’où viennent les faits');
  if (d.image && !['domaine public', 'CC0'].includes(d.image.licence)) p.push('image : licence « domaine public » ou « CC0 » obligatoire');
  for (const section of SECTIONS) {
    if (!fiche.corps.includes(`## ${section}`)) p.push(`section « ## ${section} » manquante`);
  }
  for (const { url, role } of liensDe(fiche)) {
    if (!domaineAutorise(url)) p.push(`${role} : domaine non autorisé (${url}). Ajoutez-le à src/data/sources.json s’il est fiable, gratuit et légal.`);
  }
  return p;
}

const fiches = [];
let problemes = 0;
for (const fichier of fichiers) {
  try {
    const fiche = lireFiche(fichier);
    fiches.push({ fiche, structure: controlerStructure(fiche) });
  } catch (erreur) {
    fiches.push({ fiche: { id: path.basename(fichier), fichier, donnees: {}, corps: '' }, structure: [erreur.message] });
  }
}

// Deux fiches à la même date : seule l'une d'elles serait l'œuvre du jour.
const parDate = new Map();
for (const { fiche } of fiches) {
  const date = dateDe(fiche.donnees);
  if (date && path.dirname(fiche.fichier) === DOSSIER_FICHES) parDate.set(date, [...(parDate.get(date) ?? []), fiche.id]);
}
for (const [date, ids] of parDate) if (ids.length > 1) console.warn(`⚠ ${ids.length} fiches le ${date} : ${ids.join(', ')}`);

let resultats = {};
if (!sansReseau) {
  const urls = fiches.flatMap(({ fiche }) => liensDe(fiche).map((l) => l.url)).filter(domaineAutorise);
  console.log(`Vérification de ${new Set(urls).size} liens…`);
  resultats = await verifierTous(urls);
}

const lignesRapport = [];
for (const { fiche, structure } of fiches) {
  const liensEnEchec = sansReseau ? [] : liensDe(fiche).filter((l) => domaineAutorise(l.url) && !resultats[l.url]?.ok);
  const ok = structure.length === 0 && liensEnEchec.length === 0;
  console.log(`${ok ? '✔' : '✘'} ${fiche.id}`);
  for (const p of structure) console.log(`    ✘ ${p}`);
  for (const { url, role } of liensEnEchec) {
    const r = resultats[url];
    const raison = [r?.statut, r?.erreur].filter(Boolean).join(' ');
    console.log(`    ✘ ${role} : ${raison} ${url}`);
    lignesRapport.push(`| ${fiche.id} | ${role} | ${raison} | ${url} |`);
  }
  for (const p of structure) lignesRapport.push(`| ${fiche.id} | structure | ${p.replace(/\|/g, '/')} | |`);
  if (!ok) problemes++;
}

if (ecrire) {
  fs.mkdirSync('cache', { recursive: true });
  const donnees = { verifie_le: new Date().toISOString(), liens: resultats };
  fs.writeFileSync('cache/liens-verifies.json', JSON.stringify(donnees, null, 2));
  console.log('Résultat enregistré dans cache/liens-verifies.json');
}

// Résumé lisible dans l'interface de GitHub Actions.
if (process.env.GITHUB_STEP_SUMMARY) {
  const resume = problemes
    ? `## Vérification des liens : ${problemes} fiche(s) à corriger\n\nCes liens sont masqués sur le site (et une fiche dont la ressource ne répond pas n’est pas publiée) jusqu’à leur correction.\n\n| Fiche | Où | Problème | Lien |\n|---|---|---|---|\n${lignesRapport.join('\n')}\n`
    : `## Vérification des liens : tout est en ordre (${fiches.length} fiches)\n`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resume);
}

console.log(problemes ? `\n${problemes} fiche(s) à corriger sur ${fiches.length}.` : `\nTout est en ordre : ${fiches.length} fiche(s).`);
process.exit(problemes ? 1 : 0);
