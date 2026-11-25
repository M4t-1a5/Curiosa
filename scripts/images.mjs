// Télécharge l'image de chaque fiche qui en déclare une (champ « image.url ») dans
// src/assets/oeuvres/<identifiant>.jpg, pour que le site serve ses propres images
// (aucun chargement depuis un site tiers chez le visiteur).
//
//   npm run images
//
// Lancé automatiquement avant « npm run dev » et « npm run build ». Sans réseau,
// il se contente d'avertir : la fiche s'affiche alors sans image.
//
// Pour chaque image, il calcule aussi sa couleur dominante, rangée dans
// src/assets/oeuvres/couleurs.json : la page de l'œuvre prend cette teinte.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DOSSIER_FICHES, domaineAutorise, lireFiche, listerFiches } from './lib/catalogue.mjs';
import { USER_AGENT } from './lib/http.mjs';

const DOSSIER_IMAGES = 'src/assets/oeuvres';
const FICHIER_COULEURS = path.join(DOSSIER_IMAGES, 'couleurs.json');
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Wikimedia Commons sert des vignettes jusqu'à 3840 px de large : on demande toujours
// la plus grande, quel que soit le « ?width= » écrit dans la fiche.
function urlHauteDefinition(url) {
  const u = new URL(url);
  if (u.hostname === 'commons.wikimedia.org' && u.pathname.startsWith('/wiki/Special:FilePath/')) {
    u.searchParams.set('width', '3840');
  }
  return u.toString();
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimédia refuse parfois les requêtes trop rapprochées (statut 429) : on attend puis on réessaie.
async function telecharger(url) {
  for (let essai = 1; ; essai++) {
    const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
    if ((reponse.status !== 429 && reponse.status < 500) || essai === 4) return reponse;
    await reponse.body?.cancel();
    console.log(`… ${reponse.status}, nouvel essai dans ${10 * essai} s`);
    await pause(10000 * essai);
  }
}

// Un seul format pour les originaux : JPEG de haute qualité, 3600 px au plus de large
// (la plus grande taille servie par le site, voir Fiche.astro).
// (Les scans bruts peuvent peser plus de 10 Mo, et le PNG est inutilement lourd pour une photo.)
async function normaliser(contenu) {
  return sharp(contenu)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 3600, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// Couleur d'ambiance d'une image : moyenne des pixels, en laissant de côté les tons presque
// noirs ou presque blancs (fonds, marges) et en donnant plus de poids aux couleurs vives.
async function couleurAmbiance(fichier) {
  const { data } = await sharp(fichier).flatten({ background: '#ffffff' }).resize(48, 48, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let r = 0, v = 0, b = 0, total = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [pr, pv, pb] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(pr, pv, pb), min = Math.min(pr, pv, pb);
    const clarte = (max + min) / 510;
    if (clarte < 0.08 || clarte > 0.94) continue;
    const poids = 0.15 + (max - min) / 255; // saturation approximative
    r += pr * poids; v += pv * poids; b += pb * poids; total += poids;
  }
  if (!total) return 'rgb(128 128 128)';
  return `rgb(${Math.round(r / total)} ${Math.round(v / total)} ${Math.round(b / total)})`;
}

fs.mkdirSync(DOSSIER_IMAGES, { recursive: true });
const presentes = () =>
  new Map(
    fs
      .readdirSync(DOSSIER_IMAGES)
      .filter((nom) => /\.(jpe?g|png|webp)$/.test(nom))
      .map((nom) => [nom.replace(/\.\w+$/, ''), nom]),
  );
const existantes = presentes();

// Adresse d'origine de chaque image déjà téléchargée. Si la fiche change d'image (ou si
// l'image date d'avant ce suivi), l'ancien fichier est remplacé, y compris dans le cache de la CI.
const FICHIER_ORIGINES = path.join(DOSSIER_IMAGES, 'origines.json');
let origines = {};
try {
  origines = JSON.parse(fs.readFileSync(FICHIER_ORIGINES, 'utf8'));
} catch {}
let couleurs = {};
try {
  couleurs = JSON.parse(fs.readFileSync(FICHIER_COULEURS, 'utf8'));
} catch {}

let telechargees = 0;
for (const fichier of listerFiches(DOSSIER_FICHES)) {
  const { id, donnees } = lireFiche(fichier);
  const url = donnees.image?.url;
  if (!url) continue;
  if (existantes.has(id)) {
    if (origines[id] === url) continue;
    fs.rmSync(path.join(DOSSIER_IMAGES, existantes.get(id))); // image périmée
    delete couleurs[id];
  }
  if (!domaineAutorise(url)) {
    console.warn(`⚠ ${id} : image ignorée, domaine non autorisé (${url})`);
    continue;
  }
  try {
    const reponse = await telecharger(urlHauteDefinition(url));
    const type = (reponse.headers.get('content-type') ?? '').split(';')[0];
    if (reponse.status !== 200 || !EXTENSIONS[type]) throw new Error(`statut ${reponse.status}, type « ${type} »`);
    const contenu = await normaliser(Buffer.from(await reponse.arrayBuffer()));
    fs.writeFileSync(path.join(DOSSIER_IMAGES, id + '.jpg'), contenu);
    origines[id] = url;
    fs.writeFileSync(FICHIER_ORIGINES, JSON.stringify(origines, null, 2) + '\n');
    delete couleurs[id];
    console.log(`✔ ${id} (${Math.round(contenu.length / 1024)} Ko)`);
    telechargees++;
    await pause(2000); // ménager les serveurs de Wikimédia
  } catch (erreur) {
    console.warn(`⚠ ${id} : image non téléchargée (${erreur.message}). La fiche s'affichera sans image.`);
  }
}
if (telechargees) console.log(`${telechargees} image(s) téléchargée(s).`);

// Couleur d'ambiance de chaque image (calculée une seule fois).
for (const [id, nom] of presentes()) {
  if (couleurs[id]) continue;
  try {
    couleurs[id] = await couleurAmbiance(path.join(DOSSIER_IMAGES, nom));
  } catch (erreur) {
    console.warn(`⚠ ${id} : couleur non calculée (${erreur.message})`);
  }
}
fs.writeFileSync(FICHIER_COULEURS, JSON.stringify(couleurs, null, 2) + '\n');
