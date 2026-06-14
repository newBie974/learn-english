# Design — Catégoriser l'interface & exercices multiples

**Date :** 2026-06-14
**Projet :** learn-english (Mes mots d'anglais)

## Objectif

Passer l'accueil d'une **liste plate de decks** à des **rubriques catégorisées**, et faire
évoluer l'app d'un exercice unique (QCM flashcards) vers du **multi-exercices** :
- réorganiser l'accueil en sections thématiques ;
- ajouter 2 decks QCM (phrasal verbs, expressions) ;
- ajouter un nouvel exercice « compléter une phrase » (cloze, tap-to-place).

Le tout reste **statique, zéro build, déployable sur GitHub Pages**, et **préserve la
progression** des utilisateurs (clé `localStorage` inchangée).

## Contexte de départ

L'accueil affiche aujourd'hui : un CTA « Réviser mes mots » (global) + une liste plate de
7 decks (Palier 1→6 par fréquence + Verbes irréguliers). Un seul type d'exercice : le QCM
3 choix (`index.html`, moteur `next()/choose()/grade()`). SRS Leitner 6 boîtes, clé
`mesmots.srs.v2`. Données dans `data/words.json` (3000 mots) et `data/verbs.json` (173 verbes).

## Décisions de design

### 1 · Accueil — catégorisation (sections empilées)

L'accueil devient **une seule page qui défile**, organisée en **3 rubriques** avec titres :

| Rubrique | Decks |
|----------|-------|
| **VOCABULAIRE** | Palier 1 → Palier 6 |
| **GRAMMAIRE** | Verbes irréguliers · Phrasal verbs · Expressions |
| **S'ENTRAÎNER** | Compléter des phrases |

- « Réviser mes mots » reste **en haut**, **global** : il révise les items dus de **toutes**
  les rubriques et **tous** les types d'exercice.
- Chaque deck garde sa carte actuelle (emoji, nom, sous-titre, `x/total découverts`, barre
  de progression, %).
- Choix retenu : **sections empilées** (pas d'onglets) — ~10 decks, tout visible d'un coup,
  fidèle au ressenti « une page qui scrolle ».

### 2 · Modèle de données — decks pilotés par config

Les decks ne sont plus codés en dur dans `buildDecks()` mais décrits par une **config**.
Chaque deck déclare au minimum : `id`, `label` (emoji), `name`, `sub`, `rubrique`, `type`,
et une source de données.

```js
// type: "qcm" (défaut) | "cloze"
const RUBRIQUES = ["Vocabulaire", "Grammaire", "S'entraîner"]; // ordre d'affichage
const DECK_CONFIG = [
  // 6 paliers générés depuis words.json par lvl -> rubrique Vocabulaire
  { id:"verbs",   src:"data/verbs.json",       label:"⏪", name:"Verbes irréguliers", rubrique:"Grammaire",   type:"qcm", prompt:"verb" },
  { id:"phrasal", src:"data/phrasal.json",     label:"🧩", name:"Phrasal verbs",      rubrique:"Grammaire",   type:"qcm" },
  { id:"expr",    src:"data/expressions.json", label:"💬", name:"Expressions",        rubrique:"Grammaire",   type:"qcm" },
  { id:"cloze",   src:"data/sentences.json",   label:"✍️", name:"Compléter des phrases", rubrique:"S'entraîner", type:"cloze" },
];
```

`buildDecks()` charge chaque source, génère les paliers depuis `words.json`, puis l'accueil
itère sur `RUBRIQUES` → titre de section + decks de la rubrique (dans l'ordre de config).

Nouveaux fichiers de données :
- `data/phrasal.json` — ~70 entrées `{ en, fr, tr? }` (ex. `{"en":"give up","fr":"abandonner"}`).
- `data/expressions.json` — ~40 entrées `{ en, fr }` (ex. `{"en":"break a leg","fr":"bonne chance"}`).
- `data/sentences.json` — l'exercice cloze (voir §4).

### 3 · Decks QCM : phrasal verbs + expressions

**Aucun nouveau code de moteur.** Même format `{ en, fr }` que les mots, même QCM 3 choix,
distracteurs tirés du même deck (pool = items du deck). Le `prompt`/tag de la carte dépend du
deck :
- mots → tag « Anglais », question « Quelle est la traduction ? »
- verbes (`prompt:"verb"`) → tag « Verbe irrégulier », indice « <sens> — prétérit · participe
  passé ? » (comportement actuel)
- phrasal / expressions → tag « Anglais » (ou « Phrasal verb » / « Expression »), question
  « Quelle est la traduction ? »

Le drapeau `w.verb` actuel est remplacé par la lecture du `type`/`prompt` du deck de l'item.

### 4 · Nouvel exercice — Compléter des phrases (cloze)

Nouvel écran d'exercice, **variante « trou à compléter » (un seul blanc)**.

**Interaction :** une phrase avec un trou + 3 étiquettes-mots. **Tap-to-place** : on tape
l'étiquette, elle vient remplir le trou (plutôt qu'un vrai drag HTML5 — bien plus fiable au
doigt sur mobile, ressenti identique). Une fois placée :
- bonne réponse → trou/étiquette **verts** + item marqué « su » (SRS box +1) ;
- mauvaise → **rouge** sur le choix, **vert** sur la bonne, item ré-empilé (Leitner box=1) ;
- bouton **Continuer** (+ raccourcis clavier 1/2/3 puis Entrée), comme le QCM.

**Réutilise** : la file de session, la logique Leitner (`grade()`), le bouton Continuer,
l'écran « done », la barre de progression.

**Donnée** (`data/sentences.json`) :
```json
{ "id": 1, "text": "She ___ up early every day.", "answer": "gets",
  "options": ["gets", "get", "got"], "tr": "se lever (tôt)" }
```
- `text` contient exactement un `___` (le trou).
- `answer` doit figurer dans `options`. `options` = 3 (la bonne + 2 distracteurs plausibles).
- `tr` optionnel : indice de sens affiché discrètement.
- `id` interne → item SRS keyé `cloze_<id>`.

**Contenu de départ : ~40 phrases curées** (temps simples, prépositions, phrasal verbs
courants). On valide l'exercice à ce volume avant d'enrichir.

Lancé depuis le deck « Compléter des phrases » (rubrique S'ENTRAÎNER).

### 5 · Architecture & SRS

**Extraction du JS.** `index.html` accueille désormais 2 moteurs d'exercice ; on sort le
script inline vers des fichiers servis en `<script>` (toujours zéro build) :
- `app.js` — cœur : store/SRS, build des decks, accueil, file de session, moteur QCM, écran
  « done », routeur d'exercice.
- `cloze.js` — l'exercice « compléter une phrase » (rendu + tap-to-place + correction).
- `index.html` — coquille : `<head>`, styles, markup des écrans, balises `<script>`.

(Servi en HTTP via GitHub Pages / `python3 -m http.server`, donc plusieurs `<script>`
fonctionnent sans souci.)

**Routeur d'exercice.** `next()` regarde le **type** de l'item courant (via son deck) et
affiche l'écran QCM ou cloze. La file « Réviser mes mots » peut donc **mélanger les types** :
chaque item est routé vers son écran. La correction (`grade()`) et la SRS sont communes.

**SRS inchangée.** Clé `mesmots.srs.v2` **préservée** (la progression existante survit).
Conventions d'`id` (uniques, jamais réutilisés) : mots = le mot lui-même (existant),
`verb_<en>` (existant), `ph_<en>` (phrasal), `ex_<en>` (expressions), `cloze_<id>` (phrases).
Le préfixe par deck évite toute collision et garde la SRS lisible.

## Hors scope (YAGNI)

- Variantes cloze « remettre dans l'ordre » et « plusieurs trous » (on garde le trou unique).
- Decks thématiques (nourriture, voyage…) et catégorisation par nature de mot.
- Navigation par onglets / barre du bas.
- Faux-amis et pluriels irréguliers (pas retenus pour ce lot).
- Génération automatique de phrases depuis les verbes.
- Comptes, synchronisation, audio.

## Tests

- **Données** : script de validation par fichier (JSON valide, champs requis, `answer` ∈
  `options`, exactement un `___` par `text`, pas de doublons d'`id`). Dans l'esprit du check
  `verbs.json` existant.
- **Manuel navigateur** : accueil avec les 3 rubriques ; chaque nouveau deck QCM jouable ;
  exercice cloze (bonne/mauvaise réponse, ré-empilement, Continuer, clavier) ; « Réviser »
  global qui enchaîne des items de types différents ; progression conservée après reload.

## Critères de succès

- L'accueil montre 3 rubriques titrées, sans onglet, tout le contenu visible au scroll.
- Phrasal verbs et Expressions jouables en QCM sans nouveau code moteur.
- L'exercice « compléter une phrase » fonctionne au tap sur mobile, corrige sans ambiguïté,
  et partage la SRS Leitner.
- Aucune régression de progression (clé `localStorage` intacte).
- Toujours zéro build, déployable tel quel sur GitHub Pages.
