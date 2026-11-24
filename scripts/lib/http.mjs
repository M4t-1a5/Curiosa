// Vérification d'un lien : requête HTTP réelle, redirections suivies, statut 200 exigé.
import { domaineAutorise } from './catalogue.mjs';

// Certains sites (Wikimédia notamment) demandent un User-Agent explicite.
// Vous pouvez y ajouter un moyen de contact : CURIOSA_USER_AGENT="Curiosa/1.0 (vous@exemple.fr)"
export const USER_AGENT = process.env.CURIOSA_USER_AGENT ?? 'Mozilla/5.0 (compatible; verificateur-de-liens/1.0)';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Renvoie { ok, statut?, url_finale?, erreur? } */
export async function verifierLien(url, { essais = 3, delai = 20000 } = {}) {
  if (!domaineAutorise(url)) return { ok: false, erreur: 'domaine absent de la liste blanche' };
  let dernier = { ok: false, erreur: 'aucune réponse' };
  for (let essai = 1; essai <= essais; essai++) {
    try {
      const reponse = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(delai),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr,en;q=0.8',
        },
      });
      await reponse.body?.cancel(); // inutile de télécharger tout le contenu
      if (reponse.status === 200) {
        if (!domaineAutorise(reponse.url)) {
          return { ok: false, statut: 200, url_finale: reponse.url, erreur: 'redirige hors de la liste blanche' };
        }
        return { ok: true, statut: 200, url_finale: reponse.url };
      }
      dernier = { ok: false, statut: reponse.status };
      if (reponse.status !== 429 && reponse.status < 500) return dernier; // 404, 403… : inutile de réessayer
    } catch (erreur) {
      dernier = { ok: false, erreur: erreur.name === 'TimeoutError' ? 'délai dépassé' : erreur.message };
    }
    if (essai < essais) await pause(2000 * essai);
  }
  return dernier;
}

/**
 * Vérifie une liste d'URL sans surcharger les sites :
 * plusieurs sites en parallèle, mais une seule requête à la fois par site.
 */
export async function verifierTous(urls, { parallele = 6, surProgression } = {}) {
  const parHote = new Map();
  for (const url of new Set(urls)) {
    let hote = 'invalide';
    try { hote = new URL(url).hostname; } catch {}
    parHote.set(hote, [...(parHote.get(hote) ?? []), url]);
  }
  const resultats = {};
  const files = [...parHote.values()];
  async function travailleur() {
    while (files.length) {
      const file = files.shift();
      for (const url of file) {
        resultats[url] = await verifierLien(url);
        surProgression?.(url, resultats[url]);
        await pause(300);
      }
    }
  }
  await Promise.all(Array.from({ length: parallele }, travailleur));
  return resultats;
}
