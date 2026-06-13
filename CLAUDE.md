# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Mes mots d'anglais** — une appli web de cartes mémoire (flashcards) pour apprendre les
3000 mots anglais les plus utiles, du plus fréquent au plus rare. Révision espacée
(système de Leitner), tout côté client, aucune connexion ni compte. La progression vit
dans le `localStorage` du navigateur de l'utilisateur.

Page unique, statique, déployable telle quelle sur **GitHub Pages**. Aucune étape de build :
`index.html` `fetch()` ses données depuis `data/`.

## Source de vérité unique : `data/`

- `data/words.json` — **les 3000 mots.** Liste figée, ordonnée du plus fréquent au plus
  rare. Chaque entrée : `{ en, fr, pos, src, lvl }`.
  - `en` — le mot anglais (sert aussi d'`id` unique).
  - `fr` — la ou les traductions, séparées par ` · `.
  - `pos` — nature (`verbe`, `nom`, `préposition`, `article`, `pronom`, `adjectif`…).
  - `src` — `main` = vérifié à la main ; `auto` = généré (affiche un petit badge en carte).
  - `lvl` — palier **1 à 6** : 500 mots par palier (1 = les 500 premiers, …, 6 = 2501→3000).
- `data/verbs.json` — **le deck bonus** des verbes irréguliers au passé. Chaque entrée :
  `{ en, fr }` où `fr` est la forme passée + glose, ex. `"went — aller (passé)"`.

Tout le reste (`index.html`) ne fait que **lire** ces deux fichiers. Pour ajouter ou corriger
des mots, on édite ces JSON — jamais le HTML.

## Modèle de cartes & paliers

`index.html` construit les decks au démarrage (`buildDecks()`) :
- 6 **paliers** = `words.json` filtré par `lvl` (1→6), 500 mots chacun.
- 1 deck **Verbes au passé** = `verbs.json`.

Les `id` sont les mots eux-mêmes (`w.en`), préfixés `verb_` pour les verbes. Le scoring de
mémorisation se fait **par `id`** dans le `localStorage`.

## Révision espacée (SRS)

Système de Leitner, 6 boîtes. État stocké sous la clé `localStorage` **`mesmots.srs.v2`** :
`{ <id>: { box, due } }`.
- Carte « connue » → `box` +1 (max 6), prochaine échéance `due = now + INT[box]` jours.
- Carte « à revoir » → retour `box=1`, réinjectée dans la file du jour.
- Intervalles `INT` (jours) : `{1:1, 2:2, 3:4, 4:8, 5:16, 6:32}`. `NEW=8` nouvelles cartes
  par session de deck. Un mot est « ancré » dès `box>=3`.

Toute évolution des règles SRS se fait dans `index.html` (un seul endroit, côté client).
**Ne pas changer la clé `localStorage`** sans migration : ça effacerait la progression des
utilisateurs.

## Commandes

Aucune étape de build. Le `fetch()` exige un serveur HTTP (pas `file://`) :

```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Vérifier l'intégrité des données :

```bash
python3 -c "import json; d=json.load(open('data/words.json')); \
print(len(d),'mots ;', sorted({w['lvl'] for w in d}),'paliers')"
```

## Déploiement

`index.html` + `data/` à la racine → **GitHub Pages** (servir depuis la racine de la branche).
Mettre à jour le contenu = éditer `data/*.json` puis commit : la page se rafraîchit sans
rebuild. Le `localStorage` des utilisateurs survit aux déploiements tant que la clé
`mesmots.srs.v2` ne change pas.

## Source des mots

`anglais-3000-mots.pdf` (dans le dossier d'origine) est la liste de référence ayant servi à
construire `data/words.json`. En cas de doute sur un mot ou son rang de fréquence, il fait foi.
Les 1500 premiers mots sont vérifiés à la main (`src: "main"`).
