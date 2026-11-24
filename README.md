# Curiosa

Une œuvre par jour pour s'enrichir l'esprit : un livre, un tableau, un article de recherche, un podcast, un auteur ou une autrice, une idée, une musique ou un film.

Site : <https://m4t-1a5.github.io/Curiosa/>

Une page, une œuvre. Pas de publicité, pas de compte, pas de mesure d'audience, pas de JavaScript. Chaque lien mène à une ressource **gratuite, légale et vérifiée** (statut HTTP 200).

## Démarrer

Il faut [Node.js](https://nodejs.org) 22.23 ou plus récent.

```bash
npm install
```

```bash
npm run dev
```

Le site s'ouvre sur <http://localhost:4321/Curiosa/>. En local, vous voyez aussi les fiches programmées (date future), signalées par un cadre en pointillés, pour pouvoir les relire.

## Ajouter une fiche

### Avec le générateur

1. Une fois pour toutes, créez un fichier `.env` à la racine (il n'est jamais envoyé sur GitHub) :

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Lancez le générateur avec un titre et un type :

   ```bash
   npm run generate -- "Les Méditations" livre
   ```

   Le script interroge Wikidata et les sources ouvertes (Wikisource, Gutenberg, musées, arXiv…), vérifie chaque lien trouvé, puis demande à Claude de rédiger la fiche **à partir de ces seuls éléments**. Claude n'écrit jamais d'URL : il choisit parmi les liens vérifiés. Le brouillon arrive dans `drafts/`, avec en tête la liste des points à vérifier en priorité.

   Options : `--date 2026-12-24` (sinon : premier jour libre), `--ressource <URL>` (pour imposer un lien, par exemple un podcast de France Culture), `--wikidata Q123` (si la mauvaise œuvre a été trouvée), `--sans-claude` (faits et liens seulement, vous rédigez).

3. Relisez et corrigez le brouillon, puis publiez-le :

   ```bash
   npm run publier -- drafts/2026-12-01-pensees-pour-moi-meme.md
   ```

   La fiche est revérifiée puis rangée dans `src/content/oeuvres/`.

4. Envoyez-la sur GitHub (`git add`, `git commit`, `git push`). Le site se reconstruit tout seul et la fiche apparaît à sa date.

### À la main

Copiez une fiche existante de `src/content/oeuvres/`, renommez-la `AAAA-MM-JJ-titre.md` et remplissez-la. Pour trouver un lien fiable :

```bash
npm run chercher -- wikipedia "Les Moissonneurs"
```

Sources disponibles : `wikidata`, `wikipedia`, `wikisource`, `gutenberg`, `aic` (Art Institute of Chicago), `met`, `arxiv`, `openalex`, `archive` (Internet Archive).

## Format d'une fiche

Un fichier Markdown par fiche. L'en-tête contient les faits et les liens ; le corps contient les quatre sections rédigées.

```markdown
---
date: 2026-11-24              # jour de publication
type: livre                   # livre, tableau, papier, podcast, auteur, idee, musique, film
titre: Pensées pour moi-même
titre_original: Τὰ εἰς ἑαυτόν # facultatif
createur: Marc Aurèle         # facultatif (absent pour une idée sans auteur unique)
epoque: entre 170 et 180
accroche: Une phrase qui donne envie de lire.
question: Une question à garder en tête ?
ressource:
  libelle: Lire les Pensées sur Wikisource
  url: https://fr.wikisource.org/wiki/...
  note: Traduction de 1876, domaine public.   # facultatif
plus_loin:                    # 1 à 3 œuvres liées
  - titre: Manuel d'Épictète
    type: livre               # un type ci-dessus, ou un autre mot (sculpture, lieu…)
    createur: Épictète
    pourquoi: Une ou deux phrases sur le lien avec l'œuvre du jour.
    url: https://fr.wikisource.org/wiki/...
image:                        # facultatif, tableaux dans le domaine public uniquement
  url: https://www.artic.edu/iiif/2/.../full/1686,/0/default.jpg
  alt: Description de l'image pour les personnes aveugles.
  credit: Art Institute of Chicago
  licence: CC0                # « CC0 » ou « domaine public »
sources:                      # pages d'où viennent les faits
  - https://fr.wikipedia.org/wiki/...
---

## En quoi ça consiste
## Ce que ça apporte
## Ce que ça a changé
## Par où commencer
```

Attention au YAML : une valeur qui contient « : » (deux-points suivi d'une espace) doit être mise entre guillemets droits (`"…"`).

## Règles des sources

- **Aucun lien inventé.** Chaque lien vient d'une source réelle et répond 200 avant publication.
- **Sources gratuites et fiables uniquement.** La liste blanche des domaines est dans `src/data/sources.json`. Un lien vers un autre domaine est refusé ; ajoutez le domaine à la liste seulement s'il est fiable, gratuit et légal.
- Pour une œuvre encore protégée par le droit d'auteur : un extrait légal, une conférence ou une présentation officielle, jamais une copie pirate.
- Une information qui ne peut pas être vérifiée n'apparaît pas sur la fiche.

## Vérification des liens

```bash
npm run verify
```

Vérifie tout le catalogue : structure de chaque fiche, domaines autorisés, et une vraie requête HTTP par lien (statut 200 exigé, redirections suivies). On peut aussi vérifier un fichier (`npm run verify -- drafts/ma-fiche.md`) ou seulement la structure, sans réseau (`npm run verify -- --sans-reseau`).

Sur GitHub, cette vérification tourne **avant chaque mise en ligne et chaque nuit**. Un lien qui ne répond plus est masqué ; une fiche dont la ressource principale ne répond plus est retirée jusqu'à sa correction. GitHub vous prévient alors par e-mail, et le résumé du travail liste les liens à corriger.

## Mise en ligne

Le site est publié sur GitHub Pages par `.github/workflows/publier.yml`, à chaque envoi sur `main` et chaque nuit vers minuit (heure de Paris), pour faire apparaître l'œuvre du jour.

- **Première fois** : dans le dépôt sur GitHub, *Settings → Pages → Build and deployment → Source* : choisir **GitHub Actions**.
- **Nom de domaine personnel** : définir les variables `CURIOSA_SITE` (ex. `https://curiosa.fr`) et `CURIOSA_BASE=/` dans le workflow, et configurer le domaine dans *Settings → Pages*.
- GitHub met en pause les tâches planifiées d'un dépôt public sans activité depuis 60 jours. Si l'œuvre du jour ne change plus, relancez le workflow depuis l'onglet *Actions* (ou ajoutez une fiche).

## Organisation du code

```
src/content/oeuvres/   le catalogue : une fiche par fichier
src/content.config.ts  le schéma d'une fiche (champs obligatoires)
src/data/              types d'œuvres et liste blanche des sources
src/pages/             accueil, /oeuvre/<fiche>/, /archives/<type>/, à propos, RSS
src/components/        Fiche.astro (une fiche), Archives.astro (la liste)
src/lib/               date du jour, fiches publiées, typographie française
src/styles/global.css  toute la mise en page (clair et sombre automatiques)
scripts/               verify, generate, publier, chercher, images
drafts/                brouillons à relire (jamais publiés)
```

Le site est construit avec [Astro](https://astro.build). Polices : Newsreader (titres) et Instrument Sans (texte), servies par le site lui-même.
