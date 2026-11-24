// Télécharge l'image de chaque fiche qui en déclare une (champ « image.url ») dans
// src/assets/oeuvres/<identifiant>.jpg, pour que le site serve ses propres images
// (aucun chargement depuis un site tiers chez le visiteur).
//
//   npm run images
//
// Lancé automatiquement avant « npm run dev » et « npm run build ». Sans réseau,
// il se contente d'avertir : la fiche s'affiche alors sans image.
import fs from 'node:fs';
import path from 'node:path';
import { DOSSIER_FICHES, domaineAutorise, lireFiche, listerFiches } from './lib/catalogue.mjs';
import { USER_AGENT } from './lib/http.mjs';

const DOSSIER_IMAGES = 'src/assets/oeuvres';
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

fs.mkdirSync(DOSSIER_IMAGES, { recursive: true });
const existantes = new Set(fs.readdirSync(DOSSIER_IMAGES).map((nom) => nom.replace(/\.\w+$/, '')));

let telechargees = 0;
for (const fichier of listerFiches(DOSSIER_FICHES)) {
  const { id, donnees } = lireFiche(fichier);
  const url = donnees.image?.url;
  if (!url || existantes.has(id)) continue;
  if (!domaineAutorise(url)) {
    console.warn(`⚠ ${id} : image ignorée, domaine non autorisé (${url})`);
    continue;
  }
  try {
    const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
    const type = (reponse.headers.get('content-type') ?? '').split(';')[0];
    if (reponse.status !== 200 || !EXTENSIONS[type]) throw new Error(`statut ${reponse.status}, type « ${type} »`);
    const contenu = Buffer.from(await reponse.arrayBuffer());
    fs.writeFileSync(path.join(DOSSIER_IMAGES, id + EXTENSIONS[type]), contenu);
    console.log(`✔ ${id} (${Math.round(contenu.length / 1024)} Ko)`);
    telechargees++;
  } catch (erreur) {
    console.warn(`⚠ ${id} : image non téléchargée (${erreur.message}). La fiche s'affichera sans image.`);
  }
}
if (telechargees) console.log(`${telechargees} image(s) téléchargée(s).`);
