(function(){
  const $=s=>document.querySelector(s);
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

  let tab="words", palier=0, q="";

  function buildChips(){
    const box=$("#browseChips");box.innerHTML="";
    box.classList.toggle("hidden",tab!=="words");
    if(tab!=="words")return;
    [["Tous",0],["1",1],["2",2],["3",3],["4",4],["5",5],["6",6]].forEach(([lab,val])=>{
      const b=document.createElement("button");b.type="button";
      b.className="chip"+(palier===val?" active":"");b.textContent=lab;
      b.onclick=()=>{palier=val;buildChips();render();};
      box.appendChild(b);
    });
  }

  function render(){
    const rows=$("#browseRows"),frag=document.createDocumentFragment();
    rows.innerHTML="";
    let list;
    if(tab==="words"){
      list=App.words();
      if(palier)list=list.filter(w=>w.lvl===palier);
      if(q)list=list.filter(w=>norm(w.en).includes(q)||norm(w.fr).includes(q));
      list.forEach(w=>{
        const el=document.createElement("div");el.className="row";
        const pos=w.pos&&w.pos!=="autre"?'<span class="pos2">'+w.pos+'</span>':"";
        const auto=w.src==="auto"?'<span class="auto2">auto</span>':"";
        el.innerHTML='<div class="top"><span class="en"></span>'+pos+auto+'</div><div class="fr2"></div>';
        el.querySelector(".en").textContent=w.en;
        el.querySelector(".fr2").textContent=w.fr;
        frag.appendChild(el);
      });
    }else{
      list=App.verbs();
      if(q)list=list.filter(v=>norm(v.en).includes(q)||norm(v.fr).includes(q)||norm(v.tr).includes(q));
      list.forEach(v=>{
        const el=document.createElement("div");el.className="row";
        el.innerHTML='<div class="top"><span class="en"></span><span class="auto2"></span></div><div class="forms"></div>';
        el.querySelector(".en").textContent=v.en;
        el.querySelector(".auto2").textContent=v.tr||"";
        el.querySelector(".forms").textContent=v.fr;
        frag.appendChild(el);
      });
    }
    if(!list.length){
      const e=document.createElement("div");e.className="empty";
      e.textContent="Aucun résultat.";frag.appendChild(e);
    }
    rows.appendChild(frag);
    const n=list.length,noun=tab==="words"?"mot":"verbe";
    $("#browseCount").textContent=n+" "+noun+(n>1?"s":"");
  }

  function setTab(t){
    tab=t;
    $("#tabWords").classList.toggle("active",t==="words");
    $("#tabVerbs").classList.toggle("active",t==="verbs");
    buildChips();render();
  }

  window.browseShow=function(){
    App.show("browse");
    buildChips();render();
  };

  const esc=s=>(s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  function buildPrint(){
    const pa=$("#print-area");if(pa.dataset.built)return;
    let h='<h1>Mes mots d\'anglais</h1><p class="pintro">Les 3000 mots anglais les plus utiles, du plus fréquent au plus rare, suivis des verbes irréguliers.</p>';
    const words=App.words();
    for(let l=1;l<=6;l++){
      const ws=words.filter(w=>w.lvl===l);if(!ws.length)continue;
      h+='<h2>Palier '+l+' · mots '+(l*500-499)+' à '+(l*500)+'</h2><div class="cols">';
      h+=ws.map(w=>'<div class="pr"><b>'+esc(w.en)+'</b> <span class="t">'+esc(w.fr)+'</span></div>').join("");
      h+='</div>';
    }
    const vs=App.verbs();
    h+='<h2>Verbes irréguliers</h2><div class="cols">';
    h+=vs.map(v=>'<div class="pr"><b>'+esc(v.en)+'</b> <span class="t">'+(v.tr?esc(v.tr)+" · ":"")+esc(v.fr)+'</span></div>').join("");
    h+='</div>';
    pa.innerHTML=h;pa.dataset.built="1";
  }

  $("#browseBack").onclick=()=>App.home();
  $("#browsePdf").onclick=()=>{buildPrint();window.print();};
  $("#tabWords").onclick=()=>setTab("words");
  $("#tabVerbs").onclick=()=>setTab("verbs");
  $("#browseSearch").addEventListener("input",e=>{q=norm(e.target.value.trim());render();});
})();
