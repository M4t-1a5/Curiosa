# Curiosa : consignes pour Claude

Site personnel, en français, qui présente une œuvre par jour (livre, tableau, papier de recherche, podcast, auteur, idée, musique, film). Astro 7, site statique, GitHub Pages. Lire le README pour les commandes et le format d'une fiche.

## Règles non négociables

- **Aucun lien inventé.** Toute URL doit venir d'une source réelle (API, résultat de recherche, `npm run chercher`) et répondre 200. Ne jamais reconstruire une URL de mémoire.
- **Sources gratuites, légales et fiables uniquement** : domaines de `src/data/sources.json`. Pour une œuvre sous droits : extrait légal, conférence ou présentation officielle, jamais de copie pirate.
- **Une information non vérifiable n'apparaît pas sur la fiche.** Pas de date, chiffre, citation ou anecdote sans source.
- L'IA ne publie rien seule : `npm run generate` écrit un brouillon dans `drafts/`, que l'utilisateur relit avant `npm run publier`.

## Commandes

- `npm run dev` : site local (fiches programmées visibles).
- `npm run build` : construction ; `npm run verify` : structure, domaines et liens (HTTP 200) ; `--sans-reseau` pour la structure seule.
- `npm run generate -- "Titre" type`, `npm run publier -- drafts/x.md`, `npm run chercher -- wikipedia "requête"`.

## Conventions

- Tout le texte visible est en français. Écriture inclusive sans point médian (il est quasi invisible avec Instrument Sans) : préférer des tournures neutres.
- Fichiers de fiche : `src/content/oeuvres/AAAA-MM-JJ-slug.md`, le `date` du YAML égal au préfixe du nom. Une seule fiche par jour.
- YAML : mettre entre guillemets toute valeur contenant « : » suivi d'une espace.
- Corps d'une fiche : exactement les quatre sections `## En quoi ça consiste`, `## Ce que ça apporte`, `## Ce que ça a changé`, `## Par où commencer` (350 à 500 mots en tout, environ trois minutes de lecture).
- `plus_loin` : 1 à 3 œuvres, au moins une dans un autre domaine.
- Images : le plus possible, pour tous les types (tableau, portrait, page de titre, image de film…), mais dans le domaine public ou en CC0 seulement. `npm run proposer-images` les cherche sur Wikipédia, Wikidata et Commons ; on regarde chaque image avant d'écrire son texte alternatif. Téléchargées en 3840 px par `npm run images` dans `src/assets/oeuvres/` (non versionné), avec leur couleur d'ambiance (`couleurs.json`).
- Code simple et commenté en français : l'utilisateur veut pouvoir le lire et le modifier.

## Design

Minimaliste et vivant : l'œuvre d'abord. Une fiche illustrée s'ouvre sur une « salle » plein écran dont le fond est la couleur de l'image, très assombrie ; l'œuvre y est entière, jamais recadrée (vignettes comprises). Puis une colonne de lecture, beaucoup d'air. Titres en Newsreader, texte en Instrument Sans. Une seule couleur vive par page : la teinte du type de l'œuvre, réservée au bloc « Une question à garder en tête » (et aux vignettes sans image). Pas de libellés en capitales, pas de cartes ombrées, pas de flèches décoratives.

Mouvement : CSS uniquement, aucun JavaScript, lent et lié au défilement de préférence (l'utilisateur aime ces effets). Transitions entre pages (l'image passe de la vignette à la salle), révélation de l'œuvre du jour sur l'accueil, « mise au point » au défilement (l'œuvre recule et se floute, le titre devient net), fil de lecture, rideau de la question, dérive des œuvres dans les vignettes, ouverture de « Voir en grand ». Pas d'apparitions en cascade sur chaque bloc. Tout s'arrête avec `prefers-reduced-motion`. Accessibilité : contrastes AA, focus visible, lien d'évitement, navigation clavier.

## Environnement cloud

Dans les sessions Claude Code sur le web, le réseau bloque par défaut les sites sources (Wikisource, musées, arXiv…). Les liens sont alors vérifiés par la CI GitHub (`.github/workflows/publier.yml`), qui masque tout lien mort avant publication. Pour vérifier en local, il faut autoriser ces domaines dans les réglages réseau de l'environnement.
