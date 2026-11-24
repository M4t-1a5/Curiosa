// Lecture des fiches (fichiers Markdown avec un en-tête YAML) pour les scripts.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const DOSSIER_FICHES = 'src/content/oeuvres';
export const DOSSIER_BROUILLONS = 'drafts';
export const SECTIONS = ['En quoi ça consiste', 'Ce que ça apporte', 'Ce que ça a changé', 'Par où commencer'];

export const TYPES = JSON.parse(fs.readFileSync('src/data/types.json', 'utf8'));
export const SOURCES = JSON.parse(fs.readFileSync('src/data/sources.json', 'utf8')).domaines;

/** Lit une fiche : renvoie { fichier, id, donnees (en-tête), corps } */
export function lireFiche(fichier) {
  const texte = fs.readFileSync(fichier, 'utf8');
  const morceaux = texte.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!morceaux) throw new Error(`${fichier} : en-tête YAML introuvable (il doit commencer et finir par ---)`);
  const donnees = parse(morceaux[1], { schema: 'core' }) ?? {};
  return { fichier, id: path.basename(fichier, '.md'), donnees, corps: morceaux[2] };
}

/** Liste les fiches d'un dossier (par défaut : le catalogue publié). */
export function listerFiches(dossier = DOSSIER_FICHES) {
  if (!fs.existsSync(dossier)) return [];
  return fs
    .readdirSync(dossier)
    .filter((nom) => nom.endsWith('.md'))
    .sort()
    .map((nom) => path.join(dossier, nom));
}

/** Date d'une fiche au format AAAA-MM-JJ (le YAML peut la lire comme une date ou un texte). */
export function dateDe(donnees) {
  const d = donnees.date;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d ?? '');
}

/** Tous les liens d'une fiche, avec l'endroit où ils apparaissent. */
export function liensDe(fiche) {
  const d = fiche.donnees;
  const liens = [];
  if (d.ressource?.url) liens.push({ url: d.ressource.url, role: 'ressource' });
  for (const lien of d.plus_loin ?? []) if (lien?.url) liens.push({ url: lien.url, role: 'plus loin' });
  for (const url of d.sources ?? []) liens.push({ url, role: 'source' });
  if (d.image?.url) liens.push({ url: d.image.url, role: 'image' });
  for (const m of fiche.corps.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) liens.push({ url: m[1], role: 'texte' });
  return liens;
}

/** Le domaine du lien figure-t-il dans la liste blanche (src/data/sources.json) ? */
export function domaineAutorise(url) {
  let hote;
  try {
    hote = new URL(url).hostname;
  } catch {
    return false;
  }
  return Object.keys(SOURCES).some((domaine) => hote === domaine || hote.endsWith('.' + domaine));
}

/** « Les Méditations » → « les-meditations » */
export function slugifier(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-');
}
