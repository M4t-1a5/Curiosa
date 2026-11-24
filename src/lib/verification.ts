// Lit le résultat de la dernière vérification des liens (« npm run verify -- --ecrire »).
// En production, un lien qui n'a pas répondu 200 n'est pas affiché, et une fiche
// dont la ressource principale ne répond pas n'est pas publiée.
import fs from 'node:fs';

export const FICHIER_VERIFICATION = 'cache/liens-verifies.json';

type Resultat = { ok: boolean; statut?: number; erreur?: string };
type Donnees = { verifie_le: string; liens: Record<string, Resultat> };

let donnees: Donnees | null | undefined;

function charger(): Donnees | null {
  if (donnees !== undefined) return donnees;
  try {
    donnees = JSON.parse(fs.readFileSync(FICHIER_VERIFICATION, 'utf8'));
  } catch {
    if (process.env.CURIOSA_EXIGER_VERIFICATION) {
      throw new Error(`${FICHIER_VERIFICATION} est introuvable : lancez « npm run verify -- --ecrire » avant la construction.`);
    }
    donnees = null; // travail local sans vérification : tous les liens sont affichés
  }
  return donnees ?? null;
}

/** Le lien a-t-il répondu 200 lors de la dernière vérification ? */
export function lienVerifie(url: string): boolean {
  const d = charger();
  if (!d) return true;
  return d.liens[url]?.ok === true;
}

/** En développement on affiche tout (avec une alerte) ; en production seulement les liens vérifiés. */
export function lienAffichable(url: string): boolean {
  return import.meta.env.DEV || lienVerifie(url);
}
