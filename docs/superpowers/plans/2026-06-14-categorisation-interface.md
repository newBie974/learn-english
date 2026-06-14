# Catégorisation interface & exercices multiples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réorganiser l'accueil en 3 rubriques, ajouter 2 decks QCM (phrasal verbs, expressions) et un nouvel exercice « compléter une phrase » (cloze tap-to-place), en extrayant le JS d'`index.html`.

**Architecture:** App web statique, zéro build, servie en HTTP (GitHub Pages / `python3 -m http.server`). `index.html` = coquille (head, styles, markup, balises `<script>`). `app.js` = cœur (store/SRS Leitner, decks pilotés par config, accueil par rubriques, file de session, moteur QCM, routeur d'exercice, boot). `cloze.js` = exercice « compléter une phrase ». Données figées dans `data/*.json`. Toute la logique partagée (file, SRS, écran « done ») est exposée par `app.js` via `window.App` et consommée par `cloze.js`.

**Tech Stack:** HTML/CSS/JS vanilla (pas de framework, pas de bundler). Node (≥18, ESM) uniquement pour le script de validation des données. localStorage pour la progression (clé `mesmots.srs.v2`, **inchangée**).

---

## Contexte pour l'exécutant

- `index.html` actuel : un seul fichier, script inline lignes **119-261**. Lis-le en entier avant de commencer.
- Le moteur QCM existant : `next()` (rend une carte), `choose()` (corrige + révèle), `grade(known)` (SRS Leitner + ré-empilement), `finish()` (écran done). On va **généraliser** ce moteur, pas le réécrire.
- SRS : objet `SRS[id]={box,due}` ; `id` = identifiant unique d'un item. Conventions d'id : mot = le mot (`"the"`), verbe = `verb_<en>`, phrasal = `ph_<en>`, expression = `ex_<en>`, phrase cloze = `cloze_<n>`.
- Lancer l'app pour tester : `python3 -m http.server 8123` puis ouvrir `http://localhost:8123` (le `fetch` exige HTTP, pas `file://`).
- **Ne jamais changer la clé localStorage `mesmots.srs.v2`** (effacerait la progression).

## Structure de fichiers (cible)

| Fichier | Responsabilité |
|---------|----------------|
| `index.html` | head, `<style>`, markup des 5 écrans (home, study, cloze, done, guide), balises `<script src>` |
| `app.js` | store/SRS, `DECK_DEFS`/`buildDecks`, accueil par rubriques, file de session, moteur QCM, routeur `next()`, `window.App`, boot |
| `cloze.js` | écran « compléter une phrase » : rendu, tap-to-place, correction (via `window.App`) |
| `data/words.json` | existant — 3000 mots |
| `data/verbs.json` | existant — 173 verbes irréguliers |
| `data/phrasal.json` | **nouveau** — phrasal verbs `{en,fr}` |
| `data/expressions.json` | **nouveau** — expressions `{en,fr}` |
| `data/sentences.json` | **nouveau** — phrases cloze `{id,text,answer,options,tr}` |
| `tools/validate-data.mjs` | **nouveau** — validation Node de tous les `data/*.json` |

---

## Task 1: Script de validation des données

**Files:**
- Create: `tools/validate-data.mjs`

But : un seul check automatisé qui garantit l'intégrité de tous les jeux de données. C'est notre filet de sécurité (le test) pour chaque tâche « données » suivante.

- [ ] **Step 1: Écrire le validateur**

Create `tools/validate-data.mjs` :

```js
import { readFileSync } from "node:fs";

const errors = [];
const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const fail = (f, msg) => errors.push(`${f}: ${msg}`);

function checkPairs(file, rows, { needTr = false } = {}) {
  if (!Array.isArray(rows)) return fail(file, "doit être un tableau");
  const seen = new Set();
  rows.forEach((r, i) => {
    if (!r.en || !r.fr) fail(file, `#${i} en/fr manquant`);
    if (needTr && !r.tr) fail(file, `#${i} (${r.en}) tr manquant`);
    if (seen.has(r.en)) fail(file, `doublon en="${r.en}"`);
    seen.add(r.en);
  });
}

// words.json
const words = load("words.json");
if (words.length !== 3000) fail("words.json", `attendu 3000, reçu ${words.length}`);
words.forEach((w, i) => {
  if (!w.en || !w.fr) fail("words.json", `#${i} en/fr manquant`);
  if (!(w.lvl >= 1 && w.lvl <= 6)) fail("words.json", `#${i} (${w.en}) lvl hors 1-6`);
});

// verbs.json — fr = "prétérit · participe passé"
const verbs = load("verbs.json");
checkPairs("verbs.json", verbs, { needTr: true });
verbs.forEach((v) => { if (v.fr && !v.fr.includes(" · ")) fail("verbs.json", `(${v.en}) fr sans " · "`); });

// phrasal.json + expressions.json
checkPairs("phrasal.json", load("phrasal.json"));
checkPairs("expressions.json", load("expressions.json"));

// sentences.json
const sentences = load("sentences.json");
const ids = new Set();
sentences.forEach((s, i) => {
  if (ids.has(s.id)) fail("sentences.json", `doublon id=${s.id}`);
  ids.add(s.id);
  const blanks = (s.text.match(/___/g) || []).length;
  if (blanks !== 1) fail("sentences.json", `#${i} (id ${s.id}) ${blanks} trous au lieu de 1`);
  if (!Array.isArray(s.options) || s.options.length !== 3) fail("sentences.json", `#${i} (id ${s.id}) options ≠ 3`);
  if (!s.options.includes(s.answer)) fail("sentences.json", `#${i} (id ${s.id}) answer absent des options`);
  if (new Set(s.options).size !== s.options.length) fail("sentences.json", `#${i} (id ${s.id}) options en double`);
});

if (errors.length) {
  console.error(`❌ ${errors.length} erreur(s) :`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("✅ Données valides : words", words.length, "· verbs", verbs.length, "· phrasal", load("phrasal.json").length, "· expr", load("expressions.json").length, "· sentences", sentences.length);
```

- [ ] **Step 2: Créer des fichiers vides temporaires pour les 3 nouveaux jeux**

Le validateur charge les 5 fichiers ; les 3 nouveaux n'existent pas encore. Crée-les avec un tableau vide pour que le script tourne (ils seront remplis aux tâches 5/6/8) :

```bash
printf '[]\n' > data/phrasal.json
printf '[]\n' > data/expressions.json
printf '[]\n' > data/sentences.json
```

- [ ] **Step 3: Lancer le validateur**

Run: `node tools/validate-data.mjs`
Expected: `✅ Données valides : words 3000 · verbs 173 · phrasal 0 · expr 0 · sentences 0`
(words et verbs existants passent ; les 3 nouveaux sont vides mais valides.)

- [ ] **Step 4: Commit**

```bash
git add tools/validate-data.mjs data/phrasal.json data/expressions.json data/sentences.json
git commit -m "test(data): validateur Node + fichiers données vides (phrasal/expr/sentences)"
```

---

## Task 2: Extraire le JS d'index.html vers app.js (sans changement de comportement)

**Files:**
- Create: `app.js`
- Modify: `index.html` (remplacer le bloc `<script>` lignes 119-261 par une balise externe)

But : déplacer le script **tel quel**, zéro modification de logique. On vérifie que l'app marche exactement comme avant.

- [ ] **Step 1: Créer app.js avec le contenu actuel du script**

Crée `app.js` avec le **contenu exact** du bloc entre `<script>` (ligne 119) et `</script>` (ligne 261) d'`index.html` — c.-à-d. les lignes **120 à 260 incluses**, sans les balises `<script>`/`</script>`. Ne change rien au code.

- [ ] **Step 2: Remplacer le bloc inline dans index.html**

Dans `index.html`, remplace les lignes 119-261 (de `<script>` à `</script></body></html>`) par :

```html
<script src="app.js"></script>
</body></html>
```

- [ ] **Step 3: Vérifier en navigateur (test manuel)**

Run: `python3 -m http.server 8123` puis ouvrir `http://localhost:8123`.
Expected : accueil identique à avant (CTA « Réviser », liste des 6 paliers + Verbes irréguliers) ; ouvrir un palier → QCM fonctionne ; aucune erreur dans la console (DevTools).

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "refactor: extraire le JS d'index.html vers app.js (no-op)"
```

---

## Task 3: Généraliser le modèle item/deck (deckId, kind, distracteurs par deck)

**Files:**
- Modify: `app.js`

But : préparer plusieurs types de decks. Chaque item connaît son deck (`deckId`) et son genre (`kind`). Les distracteurs viennent du **deck de l'item** (plus de `w.verb?VERBS:WORDS`). Toujours seulement words + verbs à ce stade.

- [ ] **Step 1: Remplacer `buildDecks` et les globals associés**

Dans `app.js`, remplace le bloc actuel (les `let WORDS=[]; let VERBS=[];` jusqu'à la fin de `buildDecks()`, lignes 120-132 de l'original) par :

```js
let WORDS=[],VERBS=[];
let BYID={},DECKS=[],DECK_BY_ID={};

function buildDecks(){
  BYID={};DECK_BY_ID={};
  const paliers=[];
  for(let l=1;l<=6;l++){
    paliers.push({id:"p"+l,label:l,name:"Palier "+l,rubrique:"Vocabulaire",type:"qcm",kind:"word",
      sub:(l*500-499)+" → "+(l*500)+" e mot",words:WORDS.filter(w=>w.lvl===l)});
  }
  const verbsDeck={id:"verbs",label:"⏪",name:"Verbes irréguliers",rubrique:"Grammaire",type:"qcm",kind:"verb",
    sub:"les "+VERBS.length+" verbes · prétérit & participe passé",words:VERBS};
  DECKS=[...paliers,verbsDeck];
  DECKS.forEach(deck=>{
    DECK_BY_ID[deck.id]=deck;
    deck.words.forEach(w=>{
      w.id = deck.kind==="verb" ? "verb_"+w.en : w.en;
      w.deckId=deck.id; w.kind=deck.kind;
      BYID[w.id]=w;
    });
  });
}
```

(Note : on a retiré `v.pos="verbe";v.verb=true` — le comportement « verbe » est désormais porté par `kind`.)

- [ ] **Step 2: Distracteurs tirés du deck de l'item**

Remplace `distractors(w)` (lignes 180-186 de l'original) par :

```js
function distractors(w){
  const pool=DECK_BY_ID[w.deckId].words,seen=new Set([w.fr]),out=[];
  const same=shuffle(pool.filter(x=>x.id!==w.id&&x.fr&&x.pos===w.pos&&!seen.has(x.fr)));
  const any=shuffle(pool.filter(x=>x.id!==w.id&&x.fr&&!seen.has(x.fr)));
  for(const x of [...same,...any]){if(out.length>=2)break;if(seen.has(x.fr))continue;seen.add(x.fr);out.push(x.fr);}
  return out;
}
```

(`x.pos===w.pos` : pour les mots ça filtre par nature ; pour verbes/phrasal sans `pos`, `undefined===undefined` → tous éligibles. Comportement OK.)

- [ ] **Step 3: Lire `kind` au lieu de `w.verb` dans `next()`**

Dans `next()` (lignes 187-208 de l'original), remplace les 4 lignes d'en-tête de carte :

```js
  const w=BYID[queue[0]];
  $("#frontTag").textContent=w.kind==="verb"?"Verbe irrégulier":"Anglais";
  $("#frontWord").textContent=w.en;
  const posTxt=w.kind==="word"&&w.pos&&w.pos!=="autre"?w.pos:"";
  $("#frontPos").textContent=posTxt;$("#frontPos").classList.toggle("hidden",!posTxt);
  $("#frontHint").textContent=w.kind==="verb"?((w.tr?w.tr+" — ":"")+"prétérit · participe passé ?"):"Quelle est la traduction ?";
```

- [ ] **Step 4: Vérifier en navigateur**

Run: recharger `http://localhost:8123`.
Expected : paliers et Verbes irréguliers jouables exactement comme avant (carte verbe = tag « Verbe irrégulier » + indice « <sens> — prétérit · participe passé ? » ; distracteurs verbes = d'autres triplets). Progression conservée. Console sans erreur.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "refactor: items pilotés par deck (deckId/kind), distracteurs par deck"
```

---

## Task 4: Decks pilotés par config + accueil en rubriques

**Files:**
- Modify: `app.js`
- Modify: `index.html` (retirer le label de section statique)

But : déclarer les decks dans une config, et rendre l'accueil en 3 sections titrées (Vocabulaire / Grammaire / S'entraîner). À ce stade la config ne contient encore que `verbs` (les 3 autres arrivent ensuite), mais la mécanique rubriques est en place.

- [ ] **Step 1: Charger les données « extra » dans le boot**

Dans `app.js`, remplace la fonction `boot` (lignes 246-260 de l'original) par :

```js
const DATA={};
(async function boot(){
  try{
    const files=["words","verbs","phrasal","expressions","sentences"];
    const loaded=await Promise.all(files.map(f=>fetch("data/"+f+".json").then(r=>r.json())));
    files.forEach((f,i)=>DATA[f]=loaded[i]);
    WORDS=DATA.words;VERBS=DATA.verbs;
  }catch(e){
    console.error(e);
    $("#subline").textContent="Impossible de charger les mots — lance un serveur HTTP (voir CLAUDE.md), pas en file://.";
    return;
  }
  buildDecks();
  renderHome();
})();
```

- [ ] **Step 2: Introduire `RUBRIQUES` + `DECK_DEFS` et brancher `buildDecks` dessus**

Remplace le `buildDecks` de la Task 3 par cette version pilotée par config :

```js
const RUBRIQUES=["Vocabulaire","Grammaire","S'entraîner"];
// kind: word | verb | phrasal | expr | cloze ; type: qcm | cloze
const DECK_DEFS=[
  {id:"verbs", data:"verbs", label:"⏪", name:"Verbes irréguliers", rubrique:"Grammaire", type:"qcm", kind:"verb", tag:"Verbe irrégulier", sub:d=>"les "+d.words.length+" verbes · prétérit & participe passé"},
];

function deckIdFor(kind,w){
  if(kind==="verb")return "verb_"+w.en;
  if(kind==="phrasal")return "ph_"+w.en;
  if(kind==="expr")return "ex_"+w.en;
  if(kind==="cloze")return "cloze_"+w.id;
  return w.en;
}

function buildDecks(){
  BYID={};DECK_BY_ID={};
  const paliers=[];
  for(let l=1;l<=6;l++){
    paliers.push({id:"p"+l,label:l,name:"Palier "+l,rubrique:"Vocabulaire",type:"qcm",kind:"word",
      sub:(l*500-499)+" → "+(l*500)+" e mot",words:WORDS.filter(w=>w.lvl===l)});
  }
  const defDecks=DECK_DEFS.map(def=>{
    const words=(DATA[def.data]||[]).slice();
    return {...def, sub: typeof def.sub==="function"?def.sub({words}):def.sub, words};
  }).filter(d=>d.words.length);
  DECKS=[...paliers,...defDecks];
  DECKS.forEach(deck=>{
    DECK_BY_ID[deck.id]=deck;
    deck.words.forEach(w=>{
      w.id=deckIdFor(deck.kind,w); w.deckId=deck.id; w.kind=deck.kind;
      BYID[w.id]=w;
    });
  });
}
```

- [ ] **Step 3: Carte avec `tag` du deck dans `next()`**

Dans `next()`, généralise le tag (un deck QCM peut fournir son propre `tag`) :

```js
  const w=BYID[queue[0]];
  const deck=DECK_BY_ID[w.deckId];
  $("#frontTag").textContent=w.kind==="verb"?"Verbe irrégulier":(deck.tag||"Anglais");
  $("#frontWord").textContent=w.en;
  const posTxt=w.kind==="word"&&w.pos&&w.pos!=="autre"?w.pos:"";
  $("#frontPos").textContent=posTxt;$("#frontPos").classList.toggle("hidden",!posTxt);
  $("#frontHint").textContent=w.kind==="verb"?((w.tr?w.tr+" — ":"")+"prétérit · participe passé ?"):"Quelle est la traduction ?";
```

- [ ] **Step 4: Rendre l'accueil par rubriques**

Remplace le corps de `renderHome()` qui construit la liste (lignes 160-166 de l'original, du `const list=$("#deckList")` jusqu'au `});` de fin de boucle) par :

```js
  const list=$("#deckList");list.innerHTML="";
  RUBRIQUES.forEach(rub=>{
    const decks=DECKS.filter(d=>d.rubrique===rub);
    if(!decks.length)return;
    const h=document.createElement("div");h.className="section-label";h.textContent=rub;list.appendChild(h);
    decks.forEach(d=>{
      const seen=deckSeen(d),tot=d.words.length,pct=tot?Math.round(seen/tot*100):0;
      const el=document.createElement("button");el.className="deck";
      el.innerHTML=`<span class="emoji">${d.label}</span><span class="meta"><b>${d.name}</b><span>${seen}/${tot} découverts</span><span class="bar"><i style="width:${pct}%"></i></span></span><span class="ring">${pct}%</span>`;
      el.onclick=()=>startDeck(d);list.appendChild(el);
    });
  });
```

- [ ] **Step 5: Retirer le label de section statique d'index.html**

Dans `index.html`, supprime la ligne :

```html
  <div class="section-label">Apprendre de nouveaux mots</div>
```

(les titres de section sont maintenant générés par `renderHome`.)

- [ ] **Step 6: Vérifier en navigateur**

Run: recharger `http://localhost:8123`.
Expected : accueil avec **2 sections** titrées — `VOCABULAIRE` (Palier 1→6) et `GRAMMAIRE` (Verbes irréguliers). Pas encore de section « S'entraîner » (aucun deck cloze). Decks jouables, progression conservée.

- [ ] **Step 7: Commit**

```bash
git add app.js index.html
git commit -m "feat(home): decks pilotés par config + accueil en rubriques"
```

---

## Task 5: Deck QCM « Phrasal verbs »

**Files:**
- Modify: `data/phrasal.json`
- Modify: `app.js` (ajout d'une entrée dans `DECK_DEFS`)

- [ ] **Step 1: Remplir data/phrasal.json**

Écris dans `data/phrasal.json` :

```json
[
{"en":"give up","fr":"abandonner"},
{"en":"look for","fr":"chercher"},
{"en":"look after","fr":"s'occuper de"},
{"en":"look forward to","fr":"attendre avec impatience"},
{"en":"find out","fr":"découvrir"},
{"en":"give back","fr":"rendre"},
{"en":"come back","fr":"revenir"},
{"en":"go back","fr":"retourner"},
{"en":"go on","fr":"continuer"},
{"en":"go out","fr":"sortir"},
{"en":"get up","fr":"se lever"},
{"en":"get on","fr":"monter (dans)"},
{"en":"get off","fr":"descendre (de)"},
{"en":"get along","fr":"bien s'entendre"},
{"en":"wake up","fr":"se réveiller"},
{"en":"stand up","fr":"se mettre debout"},
{"en":"sit down","fr":"s'asseoir"},
{"en":"turn on","fr":"allumer"},
{"en":"turn off","fr":"éteindre"},
{"en":"turn up","fr":"monter le son"},
{"en":"turn down","fr":"refuser"},
{"en":"put on","fr":"mettre (vêtement)"},
{"en":"take off","fr":"enlever / décoller"},
{"en":"put off","fr":"reporter"},
{"en":"put away","fr":"ranger"},
{"en":"put up with","fr":"supporter"},
{"en":"pick up","fr":"aller chercher"},
{"en":"set up","fr":"installer"},
{"en":"break down","fr":"tomber en panne"},
{"en":"break up","fr":"rompre"},
{"en":"grow up","fr":"grandir"},
{"en":"carry on","fr":"poursuivre"},
{"en":"carry out","fr":"réaliser"},
{"en":"fill in","fr":"remplir (un blanc)"},
{"en":"fill out","fr":"remplir (un formulaire)"},
{"en":"work out","fr":"résoudre / s'entraîner"},
{"en":"figure out","fr":"comprendre"},
{"en":"calm down","fr":"se calmer"},
{"en":"cheer up","fr":"remonter le moral"},
{"en":"hurry up","fr":"se dépêcher"},
{"en":"hang on","fr":"patienter"},
{"en":"hang up","fr":"raccrocher"},
{"en":"call back","fr":"rappeler"},
{"en":"call off","fr":"annuler"},
{"en":"check in","fr":"s'enregistrer"},
{"en":"check out","fr":"régler (l'hôtel)"},
{"en":"come across","fr":"tomber sur"},
{"en":"come up with","fr":"trouver (une idée)"},
{"en":"count on","fr":"compter sur"},
{"en":"deal with","fr":"gérer"},
{"en":"end up","fr":"finir par"},
{"en":"get back","fr":"récupérer"},
{"en":"get over","fr":"se remettre de"},
{"en":"get rid of","fr":"se débarrasser de"},
{"en":"give in","fr":"céder"},
{"en":"keep on","fr":"continuer à"},
{"en":"let down","fr":"décevoir"},
{"en":"look up","fr":"chercher (un mot)"},
{"en":"make up","fr":"inventer"},
{"en":"move on","fr":"passer à autre chose"},
{"en":"pay back","fr":"rembourser"},
{"en":"point out","fr":"faire remarquer"},
{"en":"run out of","fr":"être à court de"},
{"en":"show up","fr":"se pointer"},
{"en":"take care of","fr":"prendre soin de"},
{"en":"throw away","fr":"jeter"},
{"en":"try on","fr":"essayer (un vêtement)"},
{"en":"wear out","fr":"user / épuiser"}
]
```

- [ ] **Step 2: Déclarer le deck dans DECK_DEFS**

Dans `app.js`, ajoute dans `DECK_DEFS` (après l'entrée `verbs`) :

```js
  {id:"phrasal", data:"phrasal", label:"🧩", name:"Phrasal verbs", rubrique:"Grammaire", type:"qcm", kind:"phrasal", tag:"Phrasal verb", sub:d=>d.words.length+" verbes à particule"},
```

- [ ] **Step 3: Valider les données**

Run: `node tools/validate-data.mjs`
Expected: ligne `✅` avec `phrasal 68`.

- [ ] **Step 4: Vérifier en navigateur**

Run: recharger `http://localhost:8123`.
Expected : sous `GRAMMAIRE`, un deck « 🧩 Phrasal verbs ». L'ouvrir → QCM : tag « Phrasal verb », question « Quelle est la traduction ? », mot ex. `give up`, 3 choix dont `abandonner` (distracteurs = d'autres traductions de phrasal). Bonne/mauvaise réponse colorées, Continuer, progression OK.

- [ ] **Step 5: Commit**

```bash
git add data/phrasal.json app.js
git commit -m "feat(deck): phrasal verbs (QCM) sous Grammaire"
```

---

## Task 6: Deck QCM « Expressions »

**Files:**
- Modify: `data/expressions.json`
- Modify: `app.js` (ajout DECK_DEFS)

- [ ] **Step 1: Remplir data/expressions.json**

Écris dans `data/expressions.json` :

```json
[
{"en":"break a leg","fr":"bonne chance"},
{"en":"piece of cake","fr":"un jeu d'enfant"},
{"en":"hit the road","fr":"prendre la route"},
{"en":"once in a while","fr":"de temps en temps"},
{"en":"on purpose","fr":"exprès"},
{"en":"by heart","fr":"par cœur"},
{"en":"out of the blue","fr":"à l'improviste"},
{"en":"make up your mind","fr":"se décider"},
{"en":"get the hang of it","fr":"prendre le coup de main"},
{"en":"keep an eye on","fr":"surveiller"},
{"en":"a rip-off","fr":"une arnaque"},
{"en":"no big deal","fr":"pas grave"},
{"en":"it's up to you","fr":"c'est toi qui vois"},
{"en":"never mind","fr":"laisse tomber"},
{"en":"take it easy","fr":"détends-toi"},
{"en":"you're welcome","fr":"de rien"},
{"en":"by the way","fr":"au fait"},
{"en":"as soon as possible","fr":"dès que possible"},
{"en":"for good","fr":"pour de bon"},
{"en":"all of a sudden","fr":"tout à coup"},
{"en":"at last","fr":"enfin"},
{"en":"in a hurry","fr":"pressé"},
{"en":"on time","fr":"à l'heure"},
{"en":"right away","fr":"tout de suite"},
{"en":"so far","fr":"jusqu'à présent"},
{"en":"better safe than sorry","fr":"mieux vaut prévenir que guérir"},
{"en":"speak of the devil","fr":"quand on parle du loup"},
{"en":"it's raining cats and dogs","fr":"il pleut des cordes"},
{"en":"cost an arm and a leg","fr":"coûter les yeux de la tête"},
{"en":"under the weather","fr":"patraque"},
{"en":"hang in there","fr":"tiens bon"},
{"en":"my bad","fr":"c'est ma faute"},
{"en":"sooner or later","fr":"tôt ou tard"},
{"en":"give it a try","fr":"tenter le coup"},
{"en":"make sense","fr":"avoir du sens"},
{"en":"just in case","fr":"au cas où"},
{"en":"fed up","fr":"en avoir marre"},
{"en":"keep in touch","fr":"rester en contact"}
]
```

- [ ] **Step 2: Déclarer le deck dans DECK_DEFS**

Dans `app.js`, ajoute dans `DECK_DEFS` (après `phrasal`) :

```js
  {id:"expr", data:"expressions", label:"💬", name:"Expressions", rubrique:"Grammaire", type:"qcm", kind:"expr", tag:"Expression", sub:d=>d.words.length+" expressions courantes"},
```

- [ ] **Step 3: Valider**

Run: `node tools/validate-data.mjs`
Expected: `expr 38`.

- [ ] **Step 4: Vérifier en navigateur**

Run: recharger.
Expected : sous `GRAMMAIRE`, deck « 💬 Expressions ». QCM jouable (ex. `break a leg` → `bonne chance`).

- [ ] **Step 5: Commit**

```bash
git add data/expressions.json app.js
git commit -m "feat(deck): expressions courantes (QCM) sous Grammaire"
```

---

## Task 7: Écran cloze + styles (markup)

**Files:**
- Modify: `index.html` (nouvel écran `#cloze`, CSS, balise `<script src="cloze.js">`)

But : poser le HTML/CSS de l'exercice « compléter une phrase ». Pas encore de logique (vient en Task 8).

- [ ] **Step 1: Ajouter le markup de l'écran cloze**

Dans `index.html`, juste **après** la fermeture de l'écran `#study` (`</div>` qui clôt `<div id="study"...>`, soit après la ligne du bouton `continueBtn`) et **avant** `<div id="done"`, insère :

```html
<div id="cloze" class="screen hidden">
  <div class="study-top"><button class="ghost-btn" id="clozeQuit">← Quitter</button><div class="progress"><i id="clozeBar" style="width:0%"></i></div><span class="remain" id="clozeRemain">0</span></div>
  <div class="stage"><div class="qcard">
    <span class="tag">Complète la phrase</span>
    <div class="sentence" id="clozeSentence">—</div>
    <div class="hint" id="clozeTr"></div>
  </div></div>
  <div class="choices" id="clozeOptions"></div>
  <button class="cta continue hidden" id="clozeContinue">Continuer<span class="count">→</span></button>
</div>
```

- [ ] **Step 2: Ajouter le CSS cloze**

Dans `index.html`, juste avant `</style>` (ligne 78), ajoute :

```css
.sentence{font-family:Fraunces,serif;font-weight:600;font-size:clamp(20px,5.5vw,26px);line-height:1.5;color:var(--ink);max-width:380px}
.blank{display:inline-block;min-width:64px;border-bottom:2px dashed var(--primary);color:var(--primary);text-align:center;padding:0 6px;margin:0 2px}
.blank.correct{border-color:var(--known);color:#13745F}
.blank.wrong{border-color:var(--again);color:#B24A36}
#clozeTr{margin-top:14px;font-style:italic}
```

- [ ] **Step 3: Charger cloze.js**

Dans `index.html`, remplace `<script src="app.js"></script>` par (ordre : app.js d'abord, il définit `window.App` ; cloze.js ensuite) :

```html
<script src="app.js"></script>
<script src="cloze.js"></script>
```

- [ ] **Step 4: Vérifier (rendu statique)**

Run: recharger `http://localhost:8123`. L'écran `#cloze` est masqué (`hidden`) — rien ne change visuellement. Console : une erreur `cloze.js 404` est **attendue** ici (le fichier n'existe pas encore) ; elle disparaîtra en Task 8. L'app reste fonctionnelle.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(cloze): markup + styles de l'écran compléter une phrase"
```

---

## Task 8: Logique cloze + données + routeur

**Files:**
- Create: `cloze.js`
- Modify: `data/sentences.json`
- Modify: `app.js` (exposer `window.App`, router `next()` par type, déclarer le deck cloze, partager `answered`)

But : rendre l'exercice jouable et l'intégrer à la file/SRS partagée. « Réviser mes mots » pourra mélanger QCM et cloze.

- [ ] **Step 1: Remplir data/sentences.json**

Écris dans `data/sentences.json` :

```json
[
{"id":1,"text":"She ___ to school yesterday.","answer":"went","options":["went","goed","go"],"tr":"aller au passé"},
{"id":2,"text":"I ___ my keys this morning.","answer":"lost","options":["lost","losed","lose"],"tr":"perdre au passé"},
{"id":3,"text":"They ___ a new car last week.","answer":"bought","options":["bought","buyed","buy"],"tr":"acheter au passé"},
{"id":4,"text":"He ___ breakfast at eight.","answer":"had","options":["had","haved","has"],"tr":"avoir au passé"},
{"id":5,"text":"We ___ a great film last night.","answer":"saw","options":["saw","seen","seed"],"tr":"voir au passé"},
{"id":6,"text":"I ___ up at seven every day.","answer":"get","options":["get","gets","got"],"tr":"présent (I)"},
{"id":7,"text":"She ___ to work by train.","answer":"goes","options":["goes","go","gone"],"tr":"3e personne (she)"},
{"id":8,"text":"Look ___ the board, please.","answer":"at","options":["at","on","in"],"tr":"préposition"},
{"id":9,"text":"I'm good ___ maths.","answer":"at","options":["at","in","of"],"tr":"good at"},
{"id":10,"text":"She's married ___ a doctor.","answer":"to","options":["to","with","of"],"tr":"married to"},
{"id":11,"text":"We arrived ___ the airport early.","answer":"at","options":["at","to","in"],"tr":"lieu précis"},
{"id":12,"text":"He lives ___ London.","answer":"in","options":["in","at","on"],"tr":"ville"},
{"id":13,"text":"The meeting is ___ Monday.","answer":"on","options":["on","in","at"],"tr":"jour"},
{"id":14,"text":"I'll call you ___ the morning.","answer":"in","options":["in","on","at"],"tr":"moment de la journée"},
{"id":15,"text":"She's afraid ___ spiders.","answer":"of","options":["of","from","for"],"tr":"afraid of"},
{"id":16,"text":"This gift is ___ you.","answer":"for","options":["for","to","at"],"tr":"destinataire"},
{"id":17,"text":"There ___ a cat on the roof.","answer":"is","options":["is","are","be"],"tr":"singulier"},
{"id":18,"text":"There ___ many people here.","answer":"are","options":["are","is","be"],"tr":"pluriel"},
{"id":19,"text":"I don't have ___ money.","answer":"any","options":["any","some","much"],"tr":"négation"},
{"id":20,"text":"Would you like ___ tea?","answer":"some","options":["some","any","a"],"tr":"offre polie"},
{"id":21,"text":"How ___ apples do you want?","answer":"many","options":["many","much","lot"],"tr":"dénombrable"},
{"id":22,"text":"There isn't ___ milk left.","answer":"much","options":["much","many","lot"],"tr":"indénombrable"},
{"id":23,"text":"He's taller ___ his brother.","answer":"than","options":["than","that","then"],"tr":"comparatif"},
{"id":24,"text":"This is the ___ day of my life.","answer":"best","options":["best","better","goodest"],"tr":"superlatif"},
{"id":25,"text":"I've lived here ___ 2010.","answer":"since","options":["since","for","from"],"tr":"point de départ"},
{"id":26,"text":"We've known each other ___ years.","answer":"for","options":["for","since","during"],"tr":"durée"},
{"id":27,"text":"She ___ finished her homework.","answer":"has","options":["has","have","is"],"tr":"present perfect (she)"},
{"id":28,"text":"They ___ already left.","answer":"have","options":["have","has","are"],"tr":"present perfect (they)"},
{"id":29,"text":"Please turn ___ the lights.","answer":"off","options":["off","of","out"],"tr":"éteindre"},
{"id":30,"text":"I need to look ___ my keys.","answer":"for","options":["for","after","at"],"tr":"chercher"},
{"id":31,"text":"Can you pick me ___ at six?","answer":"up","options":["up","on","off"],"tr":"venir chercher"},
{"id":32,"text":"He gave ___ smoking last year.","answer":"up","options":["up","in","off"],"tr":"arrêter"},
{"id":33,"text":"We get ___ very well.","answer":"along","options":["along","on","up"],"tr":"s'entendre"},
{"id":34,"text":"Hurry ___, we're late!","answer":"up","options":["up","on","off"],"tr":"se dépêcher"},
{"id":35,"text":"If it ___ tomorrow, we'll stay home.","answer":"rains","options":["rains","rain","will rain"],"tr":"1er conditionnel"},
{"id":36,"text":"I ___ help you if I could.","answer":"would","options":["would","will","did"],"tr":"conditionnel"},
{"id":37,"text":"You ___ to wear a seatbelt.","answer":"have","options":["have","must","should"],"tr":"have to (obligation)"},
{"id":38,"text":"You ___ smoke here. It's forbidden.","answer":"mustn't","options":["mustn't","needn't","shouldn't"],"tr":"interdiction"},
{"id":39,"text":"Tom isn't sure, but he ___ be at home.","answer":"might","options":["might","can","would"],"tr":"possibilité"},
{"id":40,"text":"This bridge ___ built in 1990.","answer":"was","options":["was","is","were"],"tr":"passif passé"}
]
```

- [ ] **Step 2: Exposer `window.App` dans app.js**

Dans `app.js`, juste **avant** le bloc `boot` (après `finish()` et les bindings `$("#...")`), ajoute :

```js
function setProgress(barSel,remSel){
  const done=session.total-queue.length;
  $(barSel).style.width=Math.round(done/session.total*100)+"%";
  $(remSel).textContent=queue.length+" restant"+(queue.length>1?"s":"");
}
window.App={
  show, shuffle, grade, next, save,
  home:renderHome, setProgress,
  answered:()=>answered, setAnswered:v=>{answered=v;},
};
```

- [ ] **Step 3: Router `next()` par type d'item + `begin()` neutre**

Dans `app.js`, remplace `begin()` (ligne 178 de l'original) par :

```js
function begin(){session={seen:new Set(),known:0,total:queue.length};if(!queue.length){renderHome();return;}next();}
```

Puis remplace **entièrement** la fonction `next()` par (elle route les cloze vers `clozeShow`, affiche elle-même l'écran `study`, et utilise `setProgress`) :

```js
function next(){
  if(!queue.length){finish();return;}
  const item=BYID[queue[0]];
  if(DECK_BY_ID[item.deckId].type==="cloze"){window.clozeShow(item);return;}
  show("study");
  answered=false;
  const w=item,deck=DECK_BY_ID[w.deckId];
  $("#frontTag").textContent=w.kind==="verb"?"Verbe irrégulier":(deck.tag||"Anglais");
  $("#frontWord").textContent=w.en;
  const posTxt=w.kind==="word"&&w.pos&&w.pos!=="autre"?w.pos:"";
  $("#frontPos").textContent=posTxt;$("#frontPos").classList.toggle("hidden",!posTxt);
  $("#frontHint").textContent=w.kind==="verb"?((w.tr?w.tr+" — ":"")+"prétérit · participe passé ?"):"Quelle est la traduction ?";
  const opts=shuffle([w.fr,...distractors(w)]);
  const box=$("#choices");box.innerHTML="";box.classList.remove("locked");
  opts.forEach((tr,i)=>{
    const b=document.createElement("button");b.type="button";b.className="choice";
    b.innerHTML='<span class="num">'+(i+1)+'</span><span class="lab"></span>';
    b.querySelector(".lab").textContent=tr;
    b.onclick=()=>choose(b,tr,w);box.appendChild(b);
  });
  $("#continueBtn").classList.add("hidden");
  setProgress("#progressBar","#remain");
}
```

(`begin()` ne fait plus `show("study")` : c'est `next()` qui choisit l'écran selon le type d'item.)

- [ ] **Step 4: Déclarer le deck cloze dans DECK_DEFS**

Dans `app.js`, ajoute dans `DECK_DEFS` (après `expr`) :

```js
  {id:"cloze", data:"sentences", label:"✍️", name:"Compléter des phrases", rubrique:"S'entraîner", type:"cloze", kind:"cloze", sub:d=>d.words.length+" phrases à trous"},
```

- [ ] **Step 5: Créer cloze.js**

Create `cloze.js` :

```js
(function(){
  const $=s=>document.querySelector(s);

  window.clozeShow=function(item){
    App.show("cloze");
    App.setAnswered(false);
    const [pre,post]=item.text.split("___");
    const s=$("#clozeSentence");s.textContent="";
    s.append(document.createTextNode(pre));
    const blank=document.createElement("span");blank.className="blank";blank.id="clozeBlank";blank.textContent="_____";
    s.append(blank);s.append(document.createTextNode(post));
    $("#clozeTr").textContent=item.tr||"";
    const box=$("#clozeOptions");box.innerHTML="";box.classList.remove("locked");
    App.shuffle(item.options.slice()).forEach((opt,i)=>{
      const b=document.createElement("button");b.type="button";b.className="choice";
      b.innerHTML='<span class="num">'+(i+1)+'</span><span class="lab"></span>';
      b.querySelector(".lab").textContent=opt;
      b.onclick=()=>choose(b,opt,item);box.appendChild(b);
    });
    $("#clozeContinue").classList.add("hidden");
    App.setProgress("#clozeBar","#clozeRemain");
  };

  function choose(btn,opt,item){
    if(App.answered())return;App.setAnswered(true);
    const ok=opt===item.answer,box=$("#clozeOptions");box.classList.add("locked");
    const blank=$("#clozeBlank");blank.textContent=opt;blank.classList.add(ok?"correct":"wrong");
    [...box.children].forEach(b=>{
      const lab=b.querySelector(".lab").textContent;
      if(lab===item.answer)b.classList.add("correct");
      else if(b===btn)b.classList.add("wrong");
      else b.classList.add("dim");
    });
    App.grade(ok);
    const cb=$("#clozeContinue");cb.classList.remove("hidden");cb.focus();
  }

  $("#clozeContinue").onclick=()=>App.next();
  $("#clozeQuit").onclick=()=>{App.save();App.home();};
  document.addEventListener("keydown",e=>{
    if($("#cloze").classList.contains("hidden"))return;
    if(!App.answered()){const n=parseInt(e.key,10);if(n>=1&&n<=3){e.preventDefault();const b=$("#clozeOptions").children[n-1];if(b)b.click();}return;}
    if(e.code==="Enter"||e.code==="Space"){e.preventDefault();App.next();}
  });
})();
```

- [ ] **Step 6: Ajouter `cloze` à la map des écrans**

Dans `app.js`, à la définition `const screens={...}` (ligne 149 de l'original), ajoute la clé `cloze` :

```js
const screens={home:$("#home"),study:$("#study"),cloze:$("#cloze"),done:$("#done"),guide:$("#guide")};
```

- [ ] **Step 7: Valider les données**

Run: `node tools/validate-data.mjs`
Expected: `sentences 40`, aucune erreur (chaque phrase : 1 trou, answer ∈ options, 3 options distinctes).

- [ ] **Step 8: Vérifier en navigateur**

Run: recharger `http://localhost:8123`.
Expected :
- 3e section `S'ENTRAÎNER` avec « ✍️ Compléter des phrases ».
- L'ouvrir → une phrase à trou (ex. « She ___ to school yesterday. ») + 3 étiquettes. Taper une étiquette la place dans le trou : bonne → trou + étiquette verts ; mauvaise → rouge + bonne en vert, phrase ré-empilée. « Continuer » enchaîne. Raccourcis 1/2/3 puis Entrée OK.
- Faire une session, revenir à l'accueil, attendre l'échéance (ou forcer) : « Réviser mes mots » global doit pouvoir enchaîner un item cloze **et** un item QCM dans la même file (chaque item s'affiche sur son bon écran). Console sans erreur.
- Recharger : progression conservée (clé `mesmots.srs.v2`).

- [ ] **Step 9: Commit**

```bash
git add app.js cloze.js data/sentences.json
git commit -m "feat(cloze): exercice compléter une phrase (tap-to-place) + routeur d'exercice"
```

---

## Task 9: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Mettre à jour CLAUDE.md**

Dans `CLAUDE.md` :
1. Section « Source de vérité unique : `data/` » — ajoute les 3 nouveaux fichiers :
   - `data/phrasal.json` — phrasal verbs `{en, fr}` (deck QCM, rubrique Grammaire).
   - `data/expressions.json` — expressions `{en, fr}` (deck QCM, rubrique Grammaire).
   - `data/sentences.json` — phrases à trou `{id, text (un seul ___), answer, options (3, dont answer), tr?}` (exercice cloze, rubrique S'entraîner).
2. Section « Modèle de cartes & paliers » — remplace par : l'accueil est rangé en **3 rubriques** (`Vocabulaire`, `Grammaire`, `S'entraîner`). Les decks sont déclarés dans `DECK_DEFS` (`app.js`) : `{id, data, label, name, rubrique, type, kind, tag?, sub}`. `type` vaut `qcm` ou `cloze`.
3. Nouvelle sous-section « Architecture JS » : `index.html` = coquille (head/style/markup/`<script>`). `app.js` = cœur (SRS, decks, accueil, file, QCM, routeur `next()`, `window.App`). `cloze.js` = exercice compléter une phrase (consomme `window.App`). Zéro build : balises `<script>` chargées dans l'ordre `app.js` puis `cloze.js`.
4. Section « Commandes » — ajoute : `node tools/validate-data.mjs` (valide tous les `data/*.json`).
5. Section SRS — précise les conventions d'id : mot, `verb_*`, `ph_*`, `ex_*`, `cloze_*` ; clé `mesmots.srs.v2` inchangée ; la file « Réviser » mélange les types et route chaque item vers son écran.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rubriques, nouveaux decks, exercice cloze, archi JS"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `node tools/validate-data.mjs` → ✅ (words 3000 · verbs 173 · phrasal 68 · expr 38 · sentences 40).
- [ ] Accueil : 3 sections `VOCABULAIRE` / `GRAMMAIRE` / `S'ENTRAÎNER` ; tous les decks visibles.
- [ ] Chaque deck QCM (paliers, verbes, phrasal, expressions) jouable.
- [ ] Exercice cloze jouable au tap (bonne/mauvaise, ré-empilement, Continuer, clavier).
- [ ] « Réviser mes mots » global enchaîne des items de types différents sur les bons écrans.
- [ ] Progression conservée après reload (clé `mesmots.srs.v2` intacte).
- [ ] Toujours zéro build ; `python3 -m http.server` suffit ; déployable sur GitHub Pages.
```
