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
