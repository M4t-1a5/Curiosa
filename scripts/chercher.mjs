// Cherche une ressource dans une source ouverte et vérifie chaque lien trouvé.
// Pratique pour compléter une fiche à la main (« Pour aller plus loin », autre traduction…).
//
//   npm run chercher -- wikipedia "Les Moissonneurs"
//   npm run chercher -- wikisource "Discours de la méthode"
//   npm run chercher -- aic "Nighthawks"
//
// Sources : wikidata, wikipedia, wikisource, gutenberg, aic, met, arxiv, openalex, archive
import { domaineAutorise } from './lib/catalogue.mjs';
import { verifierLien } from './lib/http.mjs';
import { RECHERCHES } from './lib/sources.mjs';

const [source, ...mots] = process.argv.slice(2);
const recherche = mots.join(' ');
if (!RECHERCHES[source] || !recherche) {
  console.error(`Usage : npm run chercher -- <source> "recherche"\nSources : ${Object.keys(RECHERCHES).join(', ')}`);
  process.exit(1);
}

const resultats = await RECHERCHES[source](recherche);
if (!resultats.length) console.log('Aucun résultat.');
for (const r of resultats) {
  const v = domaineAutorise(r.url) ? await verifierLien(r.url) : { ok: false, erreur: 'domaine non autorisé' };
  console.log(`${v.ok ? '✔' : '✘'} ${r.titre}${r.details ? ` (${r.details})` : ''}\n   ${r.url}${v.ok ? '' : `  [${v.statut ?? v.erreur}]`}`);
  if (r.image) console.log(`   image : ${r.image}`);
}
