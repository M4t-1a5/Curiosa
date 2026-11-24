// Images des œuvres, téléchargées par « npm run images » dans src/assets/oeuvres/<identifiant>.jpg
import type { ImageMetadata } from 'astro';

const fichiers = import.meta.glob<{ default: ImageMetadata }>('/src/assets/oeuvres/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

export function imageDe(identifiant: string): ImageMetadata | undefined {
  for (const [chemin, module] of Object.entries(fichiers)) {
    const nom = chemin.split('/').pop()!.replace(/\.\w+$/, '');
    if (nom === identifiant) return module.default;
  }
  return undefined;
}
