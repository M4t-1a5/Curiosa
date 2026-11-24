// Fonctions utilitaires autour du catalogue de fiches.
import { getCollection, type CollectionEntry } from 'astro:content';
import types from '../data/types.json';
import sources from '../data/sources.json';
import { lienVerifie } from './verification';

export type Fiche = CollectionEntry<'oeuvres'>;

/** Date du jour à Paris, au format AAAA-MM-JJ. CURIOSA_DATE permet de simuler un autre jour. */
export function aujourdhui(): string {
  if (process.env.CURIOSA_DATE) return process.env.CURIOSA_DATE;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

/** Date de publication de la fiche, au format AAAA-MM-JJ. */
export const jour = (fiche: Fiche) => fiche.data.date.toISOString().slice(0, 10);

/** Une fiche est publiée si sa date est passée et si le lien vers la ressource a été vérifié. */
export const estPubliee = (fiche: Fiche) => jour(fiche) <= aujourdhui() && lienVerifie(fiche.data.ressource.url);

/** Toutes les fiches, de la plus récente à la plus ancienne. */
export async function toutesLesFiches(): Promise<Fiche[]> {
  const fiches = await getCollection('oeuvres');
  return fiches.sort((a, b) => jour(b).localeCompare(jour(a)) || a.id.localeCompare(b.id));
}

export async function fichesPubliees(): Promise<Fiche[]> {
  return (await toutesLesFiches()).filter(estPubliee);
}

/** En développement, on voit aussi les fiches programmées (pour les relire). */
export async function fichesVisibles(): Promise<Fiche[]> {
  return import.meta.env.DEV ? toutesLesFiches() : fichesPubliees();
}

export function libelleType(id: string, pluriel = false): string {
  const type = types.find((t) => t.id === id);
  if (!type) return id.charAt(0).toUpperCase() + id.slice(1); // type libre, ex. « sculpture »
  return pluriel ? type.pluriel : type.label;
}

export const TYPES = types;

/** Comment nommer le créateur selon le type : « Artiste » pour un tableau, « Réalisation » pour un film… */
export function roleCreateur(id: string): string | undefined {
  return (types.find((t) => t.id === id) as { role?: string } | undefined)?.role;
}

/** Texte d'un lien de source : le titre de la page pour un wiki, sinon le nom du site. */
export function titreSource(url: string): string {
  const u = new URL(url);
  if (/wiki(pedia|source|data|media)\.org$/.test(u.hostname) && u.pathname.startsWith('/wiki/')) {
    const page = decodeURIComponent(u.pathname.slice(6)).replace(/_/g, ' ');
    return `${page} (${nomSource(url)})`;
  }
  return nomSource(url);
}

/** « mardi 24 novembre 2026 » */
export function dateLongue(fiche: Fiche): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(fiche.data.date);
}

/** « 24 nov. » */
export function dateCourte(fiche: Fiche): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(fiche.data.date);
}

/** « novembre 2026 » */
export function moisAnnee(fiche: Fiche): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fiche.data.date);
}

/** Nom lisible du site qui héberge un lien (« Wikisource », « arXiv »…). */
export function nomSource(url: string): string {
  const hote = new URL(url).hostname;
  for (const [domaine, nom] of Object.entries(sources.domaines)) {
    if (hote === domaine || hote.endsWith('.' + domaine)) return nom;
  }
  return hote;
}

/** Chemin d'une page du site, en tenant compte du sous-dossier de GitHub Pages. */
export function chemin(relatif = ''): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + relatif.replace(/^\//, '');
}
