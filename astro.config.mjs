import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { defineMdastPlugin } from 'satteri';
import { typoFr } from './src/lib/typo.mjs';

// Applique la typographie française au texte des fiches (voir src/lib/typo.mjs).
const typographieFrancaise = defineMdastPlugin({
  name: 'typographie-francaise',
  text(noeud, ctx) {
    const corrige = typoFr(noeud.value);
    if (corrige !== noeud.value) ctx.replaceNode(noeud, { type: 'text', value: corrige });
  },
});

// Adresse publique du site. Pour un nom de domaine personnel :
// CURIOSA_SITE=https://curiosa.fr CURIOSA_BASE=/ (voir README).
export default defineConfig({
  site: process.env.CURIOSA_SITE ?? 'https://m4t-1a5.github.io',
  base: process.env.CURIOSA_BASE ?? '/Curiosa',
  trailingSlash: 'always',
  // Barre d'outils d'Astro affichée en bas de page pendant « npm run dev » : désactivée.
  devToolbar: { enabled: false },
  markdown: {
    processor: satteri({ mdastPlugins: [typographieFrancaise] }),
  },
});
