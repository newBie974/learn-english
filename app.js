let WORDS=[],VERBS=[];
let BYID={},DECKS=[],DECK_BY_ID={};

const RUBRIQUES=["Vocabulaire","Grammaire","S'entraîner"];
// kind: word | verb | phrasal | expr | cloze ; type: qcm | cloze
const DECK_DEFS=[
  {id:"verbs", data:"verbs", label:"⏪", name:"Verbes irréguliers", rubrique:"Grammaire", type:"qcm", kind:"verb", tag:"Verbe irrégulier", sub:d=>"les "+d.words.length+" verbes · prétérit & participe passé"},
  {id:"phrasal", data:"phrasal", label:"🧩", name:"Phrasal verbs", rubrique:"Grammaire", type:"qcm", kind:"phrasal", tag:"Phrasal verb", sub:d=>d.words.length+" verbes à particule"},
  {id:"expr", data:"expressions", label:"💬", name:"Expressions", rubrique:"Grammaire", type:"qcm", kind:"expr", tag:"Expression", sub:d=>d.words.length+" expressions courantes"},
  {id:"cloze", data:"sentences", label:"✍️", name:"Compléter des phrases", rubrique:"S'entraîner", type:"cloze", kind:"cloze", sub:d=>d.words.length+" phrases à trous"},
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

const store=(()=>{let mem={},ok=true;try{localStorage.setItem("__t","1");localStorage.removeItem("__t");}catch(e){ok=false;}
return{get(k){try{return ok?localStorage.getItem(k):(mem[k]??null);}catch(e){return mem[k]??null;}},
set(k,v){try{ok?localStorage.setItem(k,v):(mem[k]=v);}catch(e){mem[k]=v;}}};})();
const KEY="mesmots.srs.v2";
let SRS=JSON.parse(store.get(KEY)||"{}");
const save=()=>store.set(KEY,JSON.stringify(SRS));
const DAY=86400000,INT={1:1,2:2,3:4,4:8,5:16,6:32},NEW=8;
const isDue=id=>{const r=SRS[id];return r&&r.due<=Date.now();};
const isSeen=id=>!!SRS[id];
const totalLearned=()=>Object.values(SRS).filter(r=>r.box>=3).length;
const dueCount=()=>Object.keys(SRS).filter(isDue).length;
const deckSeen=d=>d.words.filter(w=>isSeen(w.id)).length;

let queue=[],session={};let answered=false;
const $=s=>document.querySelector(s);
const screens={home:$("#home"),study:$("#study"),cloze:$("#cloze"),done:$("#done"),guide:$("#guide"),browse:$("#browse")};
const show=n=>Object.entries(screens).forEach(([k,el])=>el.classList.toggle("hidden",k!==n));

function renderHome(){
  const h=new Date().getHours();
  $("#greet").textContent=h<6?"Bonne nuit 🌙":h<12?"Bonjour ☀️":h<18?"Bon après-midi 👋":"Bonne soirée 🌆";
  const due=dueCount(),btn=$("#reviewBtn");
  if(due>0){$("#reviewLabel").textContent="Réviser mes mots";$("#dueCount").textContent=due;btn.disabled=false;}
  else{$("#reviewLabel").textContent="Rien à réviser pour l'instant 🎉";$("#dueCount").textContent="0";btn.disabled=true;}
  const learned=totalLearned();
  $("#subline").textContent=learned>0?`${learned} mot${learned>1?'s':''} bien ancré${learned>1?'s':''}. On continue ?`:"Les 3000 mots les plus utiles, du plus simple au plus rare. Commence par le palier 1.";
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
  $("#homeFooter").innerHTML="3000 mots · les 1500 premiers vérifiés à la main · progression sur cet appareil<br>Fait avec ❤️";
  show("home");
}
function startReview(){queue=Object.keys(SRS).filter(isDue).sort((a,b)=>SRS[a].due-SRS[b].due);begin();}
function startDeck(d){
  const dueD=d.words.filter(w=>isDue(w.id)).map(w=>w.id);
  const fresh=d.words.filter(w=>!isSeen(w.id)).slice(0,NEW).map(w=>w.id);
  queue=[...dueD,...fresh];
  if(!queue.length)queue=d.words.slice(0,NEW).map(w=>w.id);
  begin();
}
function begin(){session={seen:new Set(),known:0,total:queue.length};if(!queue.length){renderHome();return;}next();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function distractors(w){
  const pool=DECK_BY_ID[w.deckId].words,seen=new Set([w.fr]),out=[];
  const same=shuffle(pool.filter(x=>x.id!==w.id&&x.fr&&x.pos===w.pos&&!seen.has(x.fr)));
  const any=shuffle(pool.filter(x=>x.id!==w.id&&x.fr&&!seen.has(x.fr)));
  for(const x of [...same,...any]){if(out.length>=2)break;if(seen.has(x.fr))continue;seen.add(x.fr);out.push(x.fr);}
  return out;
}
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
function choose(btn,tr,w){
  if(answered)return;answered=true;
  const ok=tr===w.fr,box=$("#choices");box.classList.add("locked");
  [...box.children].forEach(b=>{
    const lab=b.querySelector(".lab").textContent;
    if(lab===w.fr)b.classList.add("correct");
    else if(b===btn)b.classList.add("wrong");
    else b.classList.add("dim");
  });
  grade(ok);
  const cb=$("#continueBtn");cb.classList.remove("hidden");cb.focus();
}
function grade(known){
  const id=queue.shift(),r=SRS[id]||{box:0,due:0};
  if(known){r.box=Math.min((r.box||0)+1,6);r.due=Date.now()+(INT[r.box]||32)*DAY;session.known++;}
  else{r.box=1;r.due=Date.now()+INT[1]*DAY;queue.push(id);}
  SRS[id]=r;session.seen.add(id);save();
}
function finish(){
  const seen=session.seen.size,known=session.known,ratio=seen?known/seen:0;
  $("#statSeen").textContent=seen;$("#statKnown").textContent=known;$("#statTotal").textContent=totalLearned();
  if(ratio>=.8){$("#doneEmoji").textContent="🌟";$("#doneTitle").textContent="Excellent !";$("#doneText").textContent="Presque tout maîtrisé. Reviens demain pour ancrer ces mots.";}
  else if(ratio>=.4){$("#doneEmoji").textContent="🌿";$("#doneTitle").textContent="Belle session !";$("#doneText").textContent="Les mots hésitants reviendront bientôt — c'est comme ça qu'ils rentrent.";}
  else{$("#doneEmoji").textContent="🌱";$("#doneTitle").textContent="C'est un début !";$("#doneText").textContent="Tu viens de planter des graines. Reviens demain, tu seras surprise.";}
  show("done");
}
$("#reviewBtn").onclick=startReview;
$("#quitBtn").onclick=()=>{save();renderHome();};
$("#continueBtn").onclick=next;
$("#doneHome").onclick=renderHome;
$("#navBtn").onclick=()=>show("guide");
$("#guideBack").onclick=renderHome;
$("#browseBtn").onclick=()=>window.browseShow();
document.addEventListener("keydown",e=>{
  if(screens.study.classList.contains("hidden"))return;
  if(!answered){const n=parseInt(e.key,10);if(n>=1&&n<=3){e.preventDefault();const b=$("#choices").children[n-1];if(b)b.click();}return;}
  if(e.code==="Enter"||e.code==="Space"){e.preventDefault();next();}
});
function setProgress(barSel,remSel){
  const done=session.total-queue.length;
  $(barSel).style.width=Math.round(done/session.total*100)+"%";
  $(remSel).textContent=queue.length+" restant"+(queue.length>1?"s":"");
}
window.App={
  show, shuffle, grade, next, save,
  home:renderHome, setProgress,
  answered:()=>answered, setAnswered:v=>{answered=v;},
  words:()=>WORDS, verbs:()=>VERBS,
};
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
