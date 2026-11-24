// Publie un brouillon relu : vérifie sa structure et ses liens, puis le range dans le catalogue.
//
//   npm run publier -- drafts/2026-12-01-les-meditations.md
//
// La fiche n'apparaîtra sur le site qu'à sa date (champ « date »).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DOSSIER_FICHES } from './lib/catalogue.mjs';

const fichier = process.argv[2];
if (!fichier || !fs.existsSync(fichier)) {
  console.error('Usage : npm run publier -- drafts/<fichier>.md');
  process.exit(1);
}
const texte = fs.readFileSync(fichier, 'utf8');
if (texte.includes('À COMPLÉTER')) {
  console.error('Le brouillon contient encore « À COMPLÉTER » : terminez la relecture avant de publier.');
  process.exit(1);
}

try {
  execFileSync(process.execPath, ['scripts/verify-links.mjs', fichier], { stdio: 'inherit' });
} catch {
  console.error('\nPublication annulée : corrigez les problèmes ci-dessus.');
  process.exit(1);
}

// On retire les commentaires de relecture (lignes « # » en tête de l'en-tête YAML).
const nettoye = texte.replace(/^---\n((?:#.*\n)+)/, '---\n');
const destination = path.join(DOSSIER_FICHES, path.basename(fichier));
if (fs.existsSync(destination)) {
  console.error(`${destination} existe déjà.`);
  process.exit(1);
}
fs.writeFileSync(destination, nettoye);
fs.unlinkSync(fichier);
console.log(`\n✔ Fiche ajoutée au catalogue : ${destination}
  Il reste à l'envoyer sur GitHub (git add, git commit, git push) : le site sera reconstruit automatiquement.`);
