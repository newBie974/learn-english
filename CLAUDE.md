# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Mes mots d'anglais** — une appli web de cartes mémoire (flashcards) pour apprendre les
3000 mots anglais les plus utiles, du plus fréquent au plus rare. Révision espacée
(système de Leitner), tout côté client, aucune connexion ni compte. La progression vit
dans le `localStorage` du navigateur de l'utilisateur.

Page unique, statique, déployable telle quelle sur **GitHub Pages**. Aucune étape de build :
`app.js` `fetch()` ses données depuis `data/`.

## Source de vérité unique : `data/`

- `data/words.json` — **les 3000 mots.** Liste figée, ordonnée du plus fréquent au plus
  rare. Chaque entrée : `{ en, fr, pos, src, lvl }`.
  - `en` — le mot anglais (sert aussi d'`id` unique).
  - `fr` — la ou les traductions, séparées par ` · `.
  - `pos` — nature (`verbe`, `nom`, `préposition`, `article`, `pronom`, `adjectif`…).
  - `src` — `main` = vérifié à la main ; `auto` = généré (affiche un petit badge en carte).
  - `lvl` — palier **1 à 6** : 500 mots par palier (1 = les 500 premiers, …, 6 = 2501→3000).
- `data/verbs.json` — **le deck des verbes irréguliers** (~170). Chaque entrée :
  `{ en, fr, tr }` où `en` est l'infinitif, `fr` = `"prétérit · participe passé"`,
  `tr` = le sens français (indice).
- `data/phrasal.json` — **phrasal verbs** `{ en, fr }`. Deck QCM, rubrique Grammaire.
- `data/expressions.json` — **expressions courantes** `{ en, fr }`. Deck QCM, rubrique Grammaire.
- `data/sentences.json` — **phrases à trou** `{ id, text (un seul ___), answer, options (3, dont answer), tr? }`.
  Exercice cloze, rubrique S'entraîner.

Tout le reste ne fait que **lire** ces fichiers. Pour ajouter ou corriger du contenu,
on édite ces JSON — jamais le HTML ou le JS.

## Modèle de decks & rubriques

L'accueil est rangé en **3 rubriques** : `Vocabulaire`, `Grammaire`, `S'entraîner`.

Les decks sont déclarés dans `DECK_DEFS` (`app.js`) avec les champs :
`{ id, data, label, name, rubrique, type, kind, tag?, sub }`.
- `type` vaut `qcm` ou `cloze`.
- `kind` vaut `word | verb | phrasal | expr | cloze`.
- Les 6 **paliers** (rubrique Vocabulaire) sont générés depuis `words.json` filtrés par `lvl` —
  ils ne sont pas dans `DECK_DEFS` mais construits directement dans `buildDecks()`.

## Architecture JS

- `index.html` = coquille : `<head>`, `<style>`, markup des écrans, balises `<script>`.
- `app.js` = cœur : store/SRS, chargement des données, construction des decks, accueil par
  rubriques, file de session, moteur QCM, routeur `next()` qui aiguille selon le `type`
  de l'item (qcm → écran `#study`, cloze → `window.clozeShow()`), et `window.App` qui
  expose la logique partagée (`show`, `shuffle`, `grade`, `next`, `save`, `home`,
  `setProgress`, `answered`, `setAnswered`).
- `cloze.js` = exercice « compléter une phrase » (tap-to-place les options ; consomme
  `window.App`). Définit `window.clozeShow`.

**Zéro build** : les `<script>` sont chargés dans l'ordre `app.js` puis `cloze.js`.

## Révision espacée (SRS)

Système de Leitner, 6 boîtes. État stocké sous la clé `localStorage` **`mesmots.srs.v2`** :
`{ <id>: { box, due } }`.
- Carte « connue » → `box` +1 (max 6), prochaine échéance `due = now + INT[box]` jours.
- Carte « à revoir » → retour `box=1`, réinjectée dans la file du jour.
- Intervalles `INT` (jours) : `{1:1, 2:2, 3:4, 4:8, 5:16, 6:32}`. `NEW=8` nouvelles cartes
  par session de deck. Un mot est « ancré » dès `box>=3`.

**Conventions d'`id`** : mot = `w.en` (le mot lui-même), `verb_*` (verbes irréguliers),
`ph_*` (phrasal verbs), `ex_*` (expressions), `cloze_*` (phrases à trou).

La file « Réviser mes mots » mélange tous les types d'items et route chacun vers son écran
(QCM ou cloze) selon le `type` du deck correspondant.

**Ne pas changer la clé `localStorage`** sans migration : ça effacerait la progression des
utilisateurs.

## Commandes

Aucune étape de build. Le `fetch()` exige un serveur HTTP (pas `file://`) :

```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Valider l'intégrité de tous les `data/*.json` :

```bash
node tools/validate-data.mjs
```

## Déploiement

`index.html` + `app.js` + `cloze.js` + `data/` à la racine → **GitHub Pages** (servir depuis
la racine de la branche). Mettre à jour le contenu = éditer `data/*.json` puis commit :
la page se rafraîchit sans rebuild. Le `localStorage` des utilisateurs survit aux déploiements
tant que la clé `mesmots.srs.v2` ne change pas.

## Source des mots

`anglais-3000-mots.pdf` (dans le dossier d'origine) est la liste de référence ayant servi à
construire `data/words.json`. En cas de doute sur un mot ou son rang de fréquence, il fait foi.
Les 1500 premiers mots sont vérifiés à la main (`src: "main"`).
