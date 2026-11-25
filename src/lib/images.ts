// Images des œuvres, téléchargées par « npm run images » dans src/assets/oeuvres/<identifiant>.jpg
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const fichiers = import.meta.glob<{ default: ImageMetadata }>('/src/assets/oeuvres/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

// Couleur dominante de chaque image, calculée par « npm run images ».
// (glob plutôt qu'import : le fichier n'existe pas tant que le script n'a pas tourné)
const couleurs = Object.values(
  import.meta.glob<{ default: Record<string, string> }>('/src/assets/oeuvres/couleurs.json', { eager: true }),
)[0]?.default ?? {};

export function imageDe(identifiant: string): ImageMetadata | undefined {
  for (const [chemin, module] of Object.entries(fichiers)) {
    const nom = chemin.split('/').pop()!.replace(/\.\w+$/, '');
    if (nom === identifiant) return module.default;
  }
  return undefined;
}

/** Couleur dominante de l'image d'une fiche, ex. « rgb(52 71 98) ». */
export function couleurDe(identifiant: string): string | undefined {
  return couleurs[identifiant];
}

/**
 * Couleur de la « salle » où l'œuvre est exposée : sa couleur dominante, très assombrie,
 * pour que l'image ressorte comme sous un éclairage de musée. Renvoie un code « #rrggbb ».
 */
export function sceneDe(identifiant: string): string {
  const couleur = couleurDe(identifiant)?.match(/\d+/g)?.map(Number);
  if (!couleur) return '#1d2321'; // couleur pas encore calculée : salle neutre
  const nuit = [13, 16, 15]; // presque noir, légèrement vert comme le reste du site
  const part = 0.3; // part de la couleur de l'œuvre dans le mélange
  return '#' + couleur.map((c, i) => Math.round(c * part + nuit[i] * (1 - part)).toString(16).padStart(2, '0')).join('');
}

/** Largeurs à produire pour une image : jusqu'à sa taille réelle, sans jamais l'agrandir. */
export function largeurs(image: ImageMetadata, voulues: number[]): number[] {
  const liste = voulues.filter((l) => l < image.width);
  return [...new Set([...liste, Math.min(image.width, voulues[voulues.length - 1])])];
}

/** Couleur de salle et image de partage (réseaux sociaux) d'une fiche, pour le gabarit Base. */
export async function habillage(identifiant: string, avecImage: boolean) {
  const image = avecImage ? imageDe(identifiant) : undefined;
  if (!image) return {};
  const partage = await getImage({ src: image, width: Math.min(image.width, 1200), format: 'jpg', quality: 80 });
  return { scene: sceneDe(identifiant), imagePartage: partage.src };
}
