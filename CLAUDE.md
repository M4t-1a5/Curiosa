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
- Corps d'une fiche : exactement les quatre sections `## En quoi ça consiste`, `## Ce que ça apporte`, `## Ce que ça a changé`, `## Par où commencer` (450 à 650 mots en tout).
- `plus_loin` : 1 à 3 œuvres, au moins une dans un autre domaine.
- Images : tableaux dans le domaine public ou CC0 seulement ; téléchargées par `npm run images` dans `src/assets/oeuvres/` (non versionné).
- Code simple et commenté en français : l'utilisateur veut pouvoir le lire et le modifier.

## Design

Une colonne de lecture, beaucoup d'air, mode clair et sombre automatiques, aucune animation. Titres en Newsreader, texte en Instrument Sans. Une seule couleur forte par page : la teinte du type de l'œuvre, réservée au bloc « Une question à garder en tête ». Pas de libellés en capitales, pas de cartes ombrées, pas de flèches décoratives. Accessibilité : contrastes AA, focus visible, lien d'évitement, navigation clavier.

## Environnement cloud

Dans les sessions Claude Code sur le web, le réseau bloque par défaut les sites sources (Wikisource, musées, arXiv…). Les liens sont alors vérifiés par la CI GitHub (`.github/workflows/publier.yml`), qui masque tout lien mort avant publication. Pour vérifier en local, il faut autoriser ces domaines dans les réglages réseau de l'environnement.
