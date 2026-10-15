'use strict';
/* ================= dasar ================= */
const PW=1200, PH=800;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const html=s=>{const t=document.createElement('template');t.innerHTML=s.trim();return t.content.firstElementChild;};
const ic=n=>`<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const byName=(a,b)=>a.name.localeCompare(b.name,'id',{numeric:true});
const byTitle=(a,b)=>(a.title||'').localeCompare(b.title||'','id',{numeric:true});
const fmtDate=d=>{if(!d)return '';try{return new Date(d+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}};

const store={folders:[],songs:[],setlists:[],settings:{id:'prefs'}};
const prefs=(()=>{const p={theme:'auto',finger:false,size:1,ink:0,tool:'pen'};try{Object.assign(p,JSON.parse(localStorage.getItem('bc-ui')||'{}'));}catch(e){}return p;})();
const savePrefs=()=>{try{localStorage.setItem('bc-ui',JSON.stringify(prefs));}catch(e){}};

/* ================= tema & warna kanvas ================= */
const THEMES=['auto','light','dark'], THEME_LBL={auto:'Otomatis',light:'Terang',dark:'Gelap'};
function applyTheme(){
  const r=document.documentElement;
  if(prefs.theme==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',prefs.theme);
  $('#themeLbl').textContent=THEME_LBL[prefs.theme];
}
const COL={paper:'#fff',staff:'#bbb',note:'#000',mark:'#d33'};
function readColors(){const cs=getComputedStyle(document.documentElement);for(const k in COL){const v=cs.getPropertyValue('--'+k).trim();if(v)COL[k]=v;}}

/* ================= penyimpanan lokal (IndexedDB) ================= */
let db=null;
function openDB(){
  return new Promise(res=>{
    try{
      const r=indexedDB.open('buku-chart',1);
      r.onupgradeneeded=()=>{for(const n of ['folders','songs','setlists','settings'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n,{keyPath:'id'});};
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>res(null);
      r.onblocked=()=>res(null);
    }catch(e){res(null);}
  });
}
const idbAll=n=>new Promise(res=>{try{const q=db.transaction(n).objectStore(n).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([]);}catch(e){res([]);}});
function idbPut(n,o){if(!db)return;try{db.transaction(n,'readwrite').objectStore(n).put(o);}catch(e){}}
function idbDel(n,id){if(!db)return;try{db.transaction(n,'readwrite').objectStore(n).delete(id);}catch(e){}}
const dirty=new Set(); let saveT=0;
function flush(){clearTimeout(saveT);for(const id of dirty){const s=store.songs.find(x=>x.id===id);if(s)idbPut('songs',s);}dirty.clear();}
function saveSong(s,now){s.updated=Date.now();dirty.add(s.id);clearTimeout(saveT);if(now)flush();else saveT=setTimeout(flush,350);}
const saveFolder=f=>idbPut('folders',f);
const saveSetlist=l=>{l.updated=Date.now();idbPut('setlists',l);};
addEventListener('pagehide',flush);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});

/* ================= pencarian data ================= */
const song=id=>store.songs.find(s=>s.id===id);
const folder=id=>store.folders.find(f=>f.id===id);
const setlist=id=>store.setlists.find(l=>l.id===id);
function pathOf(id){const out=[];let f=id?folder(id):null,g=0;while(f&&g++<50){out.unshift(f);f=f.parentId?folder(f.parentId):null;}return out;}
const pathLabel=id=>pathOf(id).map(f=>f.name).join(' / ')||'Bank Lagu';
function descendants(id){const out=[];const walk=p=>store.folders.filter(f=>f.parentId===p).forEach(f=>{out.push(f.id);walk(f.id);});walk(id);return out;}

/* ================= modal & toast ================= */
let mRes=null;
function closeModal(v){
  const val=typeof v==='function'?v():v;
  const r=mRes;mRes=null;
  $('#modal').hidden=true;$('#mBody').replaceChildren();$('#mFoot').replaceChildren();
  if(r)r(val);
}
function openModal(title,body,foot=[],wide=false){
  return new Promise(res=>{
    if(mRes)closeModal(undefined);
    mRes=res;
    $('#mTitle').textContent=title;
    $('#mSheet').classList.toggle('wide',wide);
    const b=$('#mBody');b.replaceChildren();b.append(body);
    const f=$('#mFoot');f.replaceChildren();f.hidden=!foot.length;
    foot.forEach(x=>{const bt=html(`<button class="btn ${x.cls||''}">${esc(x.label)}</button>`);bt.onclick=()=>closeModal(x.v);f.append(bt);});
    $('#modal').hidden=false;
  });
}
$('#modal').addEventListener('pointerdown',e=>{if(e.target.id==='modal')closeModal(undefined);});
$('#mClose').addEventListener('click',()=>closeModal(undefined));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal(undefined);});

async function askText(title,label,value='',ok='Simpan'){
  const inp=html(`<input class="field" maxlength="80" value="${esc(value)}">`);
  const body=html(`<label class="lbl"><span>${esc(label)}</span></label>`);body.append(inp);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')closeModal(()=>inp.value.trim());});
  const p=openModal(title,body,[{label:'Batal',v:null},{label:ok,cls:'primary',v:()=>inp.value.trim()}]);
  setTimeout(()=>{inp.focus();inp.select();},40);
  const r=await p;return r?r:null;
}
async function confirmBox(title,text,ok='Hapus',danger=true){
  const r=await openModal(title,html(`<p class="msg">${esc(text)}</p>`),[{label:'Batal',v:false},{label:ok,cls:danger?'danger':'primary',v:true}]);
  return r===true;
}
function choose(title,items){
  const body=html('<div class="list"></div>');
  items.forEach(it=>{
    const b=html(`<button class="row-btn ${it.danger?'danger-t':''}">${it.icon?ic(it.icon):''}<span>${esc(it.label)}</span></button>`);
    b.onclick=()=>closeModal(()=>it.v);body.append(b);
  });
  return openModal(title,body,[]);
}
async function pickFolder(title,exclude=[]){
  const rows=[];
  const walk=(p,d)=>store.folders.filter(f=>f.parentId===p&&!exclude.includes(f.id)).sort(byName).forEach(f=>{rows.push([f,d]);walk(f.id,d+1);});
  walk(null,1);
  const body=html('<div class="list"></div>');
  const mk=(label,val,d)=>{const b=html(`<button class="row-btn" style="padding-left:${12+d*18}px">${ic('folder')}<span>${esc(label)}</span></button>`);b.onclick=()=>closeModal(()=>val);body.append(b);};
  mk('Bank Lagu (utama)','__root',0);rows.forEach(([f,d])=>mk(f.name,f.id,d));
  const r=await openModal(title,body,[{label:'Batal',v:undefined}]);
  return r===undefined?undefined:(r==='__root'?null:r);
}
async function pickSongs(inList){
  let fid=null,q='';const sel=new Set();
  const body=html('<div class="picker"><input class="field" id="pkQ" placeholder="Cari judul lagu" aria-label="Cari judul lagu"><div class="crumbs" id="pkC"></div><div class="list" id="pkL"></div></div>');
  const draw=()=>{
    const ql=q.trim().toLowerCase();
    const cnt=`<span class="s">${sel.size} dipilih</span>`;
    const cr=[`<button class="crumb" data-f="">Bank Lagu</button>`].concat(pathOf(fid).map(f=>`<button class="crumb" data-f="${f.id}">${esc(f.name)}</button>`)).join('<span class="cs">›</span>');
    $('#pkC',body).innerHTML=ql?cnt:cr+'<span class="sp"></span>'+cnt;
    const fs=ql?[]:store.folders.filter(f=>f.parentId===fid).sort(byName);
    const ss=(ql?store.songs.filter(s=>(s.title||'').toLowerCase().includes(ql)):store.songs.filter(s=>s.folderId===fid)).sort(byTitle);
    $('#pkL',body).innerHTML=fs.map(f=>`<button class="row-btn" data-nf="${f.id}">${ic('folder')}<span>${esc(f.name)}</span>${ic('next')}</button>`).join('')+
      ss.map(s=>`<button class="row-btn ${sel.has(s.id)?'on':''}" data-ns="${s.id}">${ic(sel.has(s.id)?'check':'music')}<span>${esc(s.title||'Tanpa judul')}</span><span class="s">${inList.includes(s.id)?'sudah ada':''}</span></button>`).join('')||
      (fs.length?'':'<p class="msg">Belum ada lagu di sini.</p>');
  };
  body.addEventListener('click',e=>{
    const c=e.target.closest('[data-f]'),nf=e.target.closest('[data-nf]'),ns=e.target.closest('[data-ns]');
    if(c){fid=c.dataset.f||null;draw();}
    else if(nf){fid=nf.dataset.nf;draw();}
    else if(ns){const id=ns.dataset.ns;sel.has(id)?sel.delete(id):sel.add(id);draw();}
  });
  $('#pkQ',body).addEventListener('input',e=>{q=e.target.value;draw();});
  draw();
  const r=await openModal('Pilih lagu dari bank',body,[{label:'Batal',v:[]},{label:'Tambahkan ke setlist',cls:'primary',v:()=>[...sel]}],true);
  return r||[];
}
let toastT=0;
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},2000);}
/* ================= kertas & render ================= */
const WID=[1.6,2.6,4.2], ERAD=14, X0=50, X1=PW-50;
const PAPERS={
  blank:{name:'Kosong',n:0,lines:0,gap:0},
  ruled:{name:'Bergaris',n:0,lines:0,gap:0,rule:1},
  grid:{name:'Kotak-kotak',n:0,lines:0,gap:0,rule:2},
  staff6:{name:'Staff 5 garis (6 sistem)',n:6,lines:5,gap:11,legacy:1},
  staff4:{name:'Staff 5 garis besar (4 sistem)',n:4,lines:5,gap:14,legacy:1},
  line1:{name:'Satu garis drum (8 baris)',n:8,lines:1,gap:0,legacy:1}
};
function systems(t){
  const P=PAPERS[t]||PAPERS.staff6;if(!P.n)return [];
  const top=50,bottom=PH-40,pitch=(bottom-top)/P.n,h=(P.lines-1)*P.gap;
  return Array.from({length:P.n},(_,i)=>({y:top+i*pitch+(pitch-h)/2,gap:P.gap,lines:P.lines,h}));
}
function drawPaper(x,type,k){
  x.fillStyle=COL.paper;x.fillRect(0,0,PW*k,PH*k);
  const P=PAPERS[type]||PAPERS.blank;
  if(P.rule){
    x.strokeStyle=COL.staff;x.globalAlpha=.55;x.lineWidth=Math.max(1,k);x.beginPath();
    for(let y=60;y<PH;y+=40){x.moveTo(0,y*k);x.lineTo(PW*k,y*k);}
    if(P.rule===2)for(let X=40;X<PW;X+=40){x.moveTo(X*k,0);x.lineTo(X*k,PH*k);}
    x.stroke();x.globalAlpha=1;return;
  }
  const ss=systems(type);if(!ss.length)return;
  x.strokeStyle=COL.staff;x.lineWidth=Math.max(1,1.1*k);x.beginPath();
  for(const s of ss){
    for(let i=0;i<s.lines;i++){const y=(s.y+i*s.gap)*k;x.moveTo(X0*k,y);x.lineTo(X1*k,y);}
    const ex=s.lines===1?12:0;
    x.moveTo(X0*k,(s.y-ex)*k);x.lineTo(X0*k,(s.y+s.h+ex)*k);
    x.moveTo(X1*k,(s.y-ex)*k);x.lineTo(X1*k,(s.y+s.h+ex)*k);
  }
  x.stroke();
}
function drawStroke(x,s,k){
  const a=s.pts,n=a.length/3;if(!n)return;
  const base=WID[s.w]||WID[1];
  const lw=p=>Math.max(base*(0.45+p*1.1)*k,1.1);
  x.strokeStyle=x.fillStyle=s.c?COL.mark:COL.note;x.lineCap='round';x.lineJoin='round';
  if(n===1){x.beginPath();x.arc(a[0]*k,a[1]*k,lw(a[2])/2,0,6.2832);x.fill();return;}
  let px=a[0]*k,py=a[1]*k,pp=a[2],mx0=px,my0=py;
  for(let i=1;i<n;i++){
    const X=a[i*3]*k,Y=a[i*3+1]*k,P=a[i*3+2],mx=(px+X)/2,my=(py+Y)/2;
    x.lineWidth=lw((pp+P)/2);x.beginPath();x.moveTo(mx0,my0);x.quadraticCurveTo(px,py,mx,my);x.stroke();
    mx0=mx;my0=my;px=X;py=Y;pp=P;
  }
  x.lineWidth=lw(pp);x.beginPath();x.moveTo(mx0,my0);x.lineTo(px,py);x.stroke();
}
function renderPage(x,sg,pi,k){
  drawPaper(x,sg.paper,k);
  const pg=sg.pages[pi];if(pg)for(const s of pg.strokes)drawStroke(x,s,k);
}
function drawThumb(c,sg){
  if(!sg)return;c.width=480;c.height=320;
  renderPage(c.getContext('2d'),sg,0,480/PW);
}

/* ================= editor ================= */
const ed={song:null,pi:0,cv:null,ctx:null,base:null,bctx:null,k:1,dpr:1,cur:null,h:{},bound:false};
const edPage=()=>ed.song.pages[ed.pi];
const edHist=()=>ed.h[ed.pi]||(ed.h[ed.pi]={u:[],r:[]});
const edDirty=()=>saveSong(ed.song);
const r1=v=>Math.round(v*10)/10;

function edSize(){
  const st=$('#edStage'),w=st.clientWidth-20,h=st.clientHeight-20;
  if(w<50||h<50)return;
  const sc=Math.min(w/PW,h/PH),dpr=Math.min(window.devicePixelRatio||1,2);
  ed.k=sc*dpr;ed.dpr=dpr;
  const c=ed.cv,cw=Math.round(PW*ed.k),ch=Math.round(PH*ed.k);
  c.width=cw;c.height=ch;c.style.width=(PW*sc)+'px';c.style.height=(PH*sc)+'px';
  ed.ctx=c.getContext('2d');
  ed.base=document.createElement('canvas');ed.base.width=cw;ed.base.height=ch;ed.bctx=ed.base.getContext('2d');
  edRebase();
}
function edRebase(){
  if(!ed.bctx||!ed.song)return;
  readColors();renderPage(ed.bctx,ed.song,ed.pi,ed.k);edPaint();
}
function edPaint(){
  if(!ed.ctx||!ed.base)return;
  const x=ed.ctx;x.drawImage(ed.base,0,0);
  const c=ed.cur;if(!c)return;
  if(c.kind==='pen')drawStroke(x,c.s,ed.k);
  else if(c.at){x.strokeStyle=COL.mark;x.lineWidth=1.5*ed.dpr;x.beginPath();x.arc(c.at[0]*ed.k,c.at[1]*ed.k,ERAD*ed.k,0,6.2832);x.stroke();}
}
function edPt(e){
  const r=ed.cv.getBoundingClientRect();
  return [(e.clientX-r.left)/r.width*PW,(e.clientY-r.top)/r.height*PH,e.pressure>0?e.pressure:0.5];
}
const segD2=(px,py,ax,ay,bx,by)=>{
  const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
  let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));
  const X=ax+t*dx-px,Y=ay+t*dy-py;return X*X+Y*Y;
};
function eraseAt(p){
  const pg=edPage(),r2=ERAD*ERAD;
  const keep=pg.strokes.filter(s=>{
    const a=s.pts;
    if(a.length===3)return segD2(p[0],p[1],a[0],a[1],a[0],a[1])>=r2;
    for(let i=0;i<a.length-3;i+=3)if(segD2(p[0],p[1],a[i],a[i+1],a[i+3],a[i+4])<r2)return false;
    return true;
  });
  if(keep.length!==pg.strokes.length){
    if(!ed.cur.snap){const hs=edHist();hs.u.push(pg.strokes.slice());hs.r.length=0;ed.cur.snap=true;}
    pg.strokes=keep;edRebase();edDirty();
  }
}
const canDraw=e=>e.pointerType==='pen'||e.pointerType==='mouse'||prefs.finger;
function edDown(e){
  if(!canDraw(e)||ed.cur||!ed.base)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();ed.cv.setPointerCapture(e.pointerId);
  const p=edPt(e);
  if(prefs.tool==='pen'){
    ed.cur={kind:'pen',id:e.pointerId,s:{w:prefs.size,c:prefs.ink,pts:[r1(p[0]),r1(p[1]),Math.round(p[2]*100)/100]}};
  }else{
    ed.cur={kind:'eraser',id:e.pointerId,at:p,snap:false};eraseAt(p);
  }
  edPaint();
}
function edMove(e){
  const c=ed.cur;if(!c||c.id!==e.pointerId)return;
  const ev=e.getCoalescedEvents?e.getCoalescedEvents():[];
  for(const q of (ev.length?ev:[e])){
    const p=edPt(q);
    if(c.kind==='pen'){
      const a=c.s.pts,n=a.length,dx=p[0]-a[n-3],dy=p[1]-a[n-2];
      if(dx*dx+dy*dy<0.5)continue;
      a.push(r1(p[0]),r1(p[1]),Math.round(p[2]*100)/100);
    }else{c.at=p;eraseAt(p);}
  }
  edPaint();
}
function edUp(e){
  const c=ed.cur;if(!c||c.id!==e.pointerId)return;
  ed.cur=null;
  if(c.kind==='pen'){
    const hs=edHist(),pg=edPage();
    hs.u.push(pg.strokes.slice());if(hs.u.length>80)hs.u.shift();hs.r.length=0;
    pg.strokes.push(c.s);drawStroke(ed.bctx,c.s,ed.k);edDirty();
  }
  edPaint();edBtns();
}
function edCancel(e){if(ed.cur&&ed.cur.id===e.pointerId){ed.cur=null;edRebase();}}

function edUndo(){const hs=edHist();if(!hs.u.length)return;hs.r.push(edPage().strokes.slice());edPage().strokes=hs.u.pop();edRebase();edDirty();edBtns();}
function edRedo(){const hs=edHist();if(!hs.r.length)return;hs.u.push(edPage().strokes.slice());edPage().strokes=hs.r.pop();edRebase();edDirty();edBtns();}
function edBtns(){
  const hs=edHist();
  $('#edUndo').disabled=!hs.u.length;$('#edRedo').disabled=!hs.r.length;
  $$('#pal [data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===prefs.tool)));
  $$('#pal [data-ink]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ink===prefs.ink)));
  $$('#pal [data-size]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.size===prefs.size)));
  const n=ed.song?ed.song.pages.length:1;
  $('#pgPrev').disabled=ed.pi<=0;$('#pgNext').disabled=ed.pi>=n-1;
}
function edGo(i){
  const n=ed.song.pages.length;
  ed.pi=Math.max(0,Math.min(n-1,i));
  $('#pgLbl').textContent=`Hal ${ed.pi+1}/${n}`;
  edRebase();edBtns();
}
async function edMore(){
  const v=await choose('Opsi lagu',[
    {label:'Ganti jenis kertas',icon:'pen',v:'paper'},
    {label:prefs.finger?'Gambar dengan jari: hidup':'Gambar dengan jari: mati',icon:'pen',v:'finger'},
    {label:'Hapus halaman ini',icon:'trash',danger:true,v:'del'}
  ]);
  if(v==='paper'){
    const p=await choose('Jenis kertas',Object.keys(PAPERS).filter(k=>!PAPERS[k].legacy||ed.song.paper===k).map(k=>({label:(ed.song.paper===k?'✓ ':'')+PAPERS[k].name,icon:'list',v:k})));
    if(p){ed.song.paper=p;edDirty();edRebase();}
  }else if(v==='finger'){
    prefs.finger=!prefs.finger;savePrefs();toast(prefs.finger?'Jari sekarang bisa menulis':'Hanya stylus yang menulis');
  }else if(v==='del'){
    if(ed.song.pages.length<=1){toast('Lagu butuh minimal 1 halaman');return;}
    if(await confirmBox('Hapus halaman',`Halaman ${ed.pi+1} akan dihapus.`)){
      ed.song.pages.splice(ed.pi,1);ed.h={};edDirty();edGo(Math.min(ed.pi,ed.song.pages.length-1));
    }
  }
}
async function edClear(){
  if(!edPage().strokes.length)return;
  if(await confirmBox('Kosongkan halaman','Semua tulisan di halaman ini akan dihapus. Kamu masih bisa mengurungkan.','Kosongkan')){
    const hs=edHist();hs.u.push(edPage().strokes.slice());hs.r.length=0;edPage().strokes=[];edRebase();edDirty();edBtns();
  }
}
function initEditor(){
  if(ed.bound)return;ed.bound=true;
  ed.cv=$('#edCanvas');
  const c=ed.cv;
  c.addEventListener('pointerdown',edDown);c.addEventListener('pointermove',edMove);
  c.addEventListener('pointerup',edUp);c.addEventListener('pointercancel',edCancel);
  c.addEventListener('contextmenu',e=>e.preventDefault());
  new ResizeObserver(()=>{if(!$('#scr-editor').hidden)edSize();}).observe($('#edStage'));
  $('#pal').addEventListener('click',e=>{
    const t=e.target.closest('[data-tool],[data-ink],[data-size]');if(!t)return;
    if(t.dataset.tool)prefs.tool=t.dataset.tool;
    if(t.dataset.ink!==undefined)prefs.ink=+t.dataset.ink;
    if(t.dataset.size!==undefined)prefs.size=+t.dataset.size;
    savePrefs();edBtns();
  });
  $('#edUndo').onclick=edUndo;$('#edRedo').onclick=edRedo;$('#edClear').onclick=edClear;
  $('#pgPrev').onclick=()=>edGo(ed.pi-1);$('#pgNext').onclick=()=>edGo(ed.pi+1);
  $('#pgAdd').onclick=()=>{ed.song.pages.splice(ed.pi+1,0,{strokes:[]});ed.h={};edDirty();edGo(ed.pi+1);};
  $('#edMore').onclick=edMore;$('#edBack').onclick=closeEditor;
  $('#edTitle').addEventListener('input',e=>{ed.song.title=e.target.value;edDirty();});
  $('#edBpm').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,3);ed.song.bpm=e.target.value;edDirty();});
  $('#edMeter').addEventListener('input',e=>{ed.song.meter=e.target.value.trim();edDirty();});
  document.addEventListener('keydown',e=>{
    if($('#scr-editor').hidden||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z'||e.target.matches('input'))return;
    e.preventDefault();e.shiftKey?edRedo():edUndo();
  });
}
function openEditor(id){
  const sg=song(id);if(!sg)return;
  initEditor();
  ed.song=sg;ed.pi=0;ed.h={};ed.cur=null;
  show('scr-editor');
  $('#edTitle').value=sg.title||'';$('#edBpm').value=sg.bpm||'';$('#edMeter').value=sg.meter||'4/4';
  edSize();edGo(0);
}
function closeEditor(){
  ed.cur=null;flush();
  if(ed.song&&!(ed.song.title||'').trim()){ed.song.title='Tanpa judul';saveSong(ed.song,true);}
  ed.song=null;show('scr-bank');renderBank();
}
/* ================= navigasi ================= */
const ui={folderId:null,q:'',slId:null};
function show(id){
  $$('.screen').forEach(s=>{s.hidden=s.id!==id;});
  $('#app').dataset.mode=(id==='scr-editor'||id==='scr-perf')?'full':'nav';
  $$('.rbtn[data-nav]').forEach(b=>b.setAttribute('aria-current',String((id==='scr-bank'&&b.dataset.nav==='bank')||(id==='scr-sets'&&b.dataset.nav==='sets'))));
}

/* ================= bank lagu ================= */
function renderBank(){
  const root=$('#scr-bank');
  root.innerHTML=`<div class="ph"><h1>Bank Lagu</h1><span class="sp"></span>
    <input class="field search" id="bankQ" type="search" placeholder="Cari judul lagu" aria-label="Cari judul lagu" value="${esc(ui.q)}">
    <button class="btn" id="newFolder">${ic('folder')}Folder baru</button>
    <button class="btn primary" id="newSong">${ic('plus')}Lagu baru</button></div>
    <div class="crumbs" id="bankCrumbs"></div><div class="scroll"><div class="grid" id="bankGrid"></div></div>`;
  fillBank();
}
function fillBank(){
  readColors();
  const q=ui.q.trim().toLowerCase();
  const cr=[`<button class="crumb" data-crumb="">Bank Lagu</button>`].concat(pathOf(ui.folderId).map(f=>`<button class="crumb" data-crumb="${f.id}">${esc(f.name)}</button>`)).join('<span class="cs">›</span>');
  $('#bankCrumbs').innerHTML=q?`<span class="s">Hasil pencarian di semua folder</span>`:cr;
  const subs=q?[]:store.folders.filter(f=>f.parentId===ui.folderId).sort(byName);
  const songs=(q?store.songs.filter(s=>(s.title||'').toLowerCase().includes(q)):store.songs.filter(s=>s.folderId===ui.folderId)).sort(byTitle);
  const g=$('#bankGrid');
  g.innerHTML=subs.map(f=>{
    const ns=store.songs.filter(s=>s.folderId===f.id).length,nf=store.folders.filter(x=>x.parentId===f.id).length;
    return `<div class="card fold"><button class="open" data-open-folder="${f.id}"><span class="ficon">${ic('folder')}</span><span><span class="t">${esc(f.name)}</span><span class="s">${ns} lagu${nf?' · '+nf+' folder':''}</span></span></button>
      <button class="icon-btn more" data-more-folder="${f.id}" aria-label="Opsi folder">${ic('more')}</button></div>`;
  }).join('')+songs.map(s=>`<div class="card"><button class="open" data-open-song="${s.id}"><canvas class="thumb" data-thumb="${s.id}"></canvas>
      <span class="meta"><span class="t">${esc(s.title||'Tanpa judul')}</span><span class="s">${s.bpm?s.bpm+' BPM · ':''}${esc(s.meter||'4/4')} · ${s.pages.length} hal${q?' · '+esc(pathLabel(s.folderId)):''}</span></span></button>
      <button class="icon-btn more" data-more-song="${s.id}" aria-label="Opsi lagu">${ic('more')}</button></div>`).join('')||'';
  if(!subs.length&&!songs.length)g.innerHTML=`<div class="empty" style="grid-column:1/-1">${q?'Tidak ada lagu dengan judul itu.':'Folder ini masih kosong. Tekan “Lagu baru” untuk mulai menulis notasi.'}</div>`;
  $$('[data-thumb]',g).forEach(c=>drawThumb(c,song(c.dataset.thumb)));
}
async function newSong(){
  const t=await askText('Lagu baru','Judul lagu','','Buat');if(!t)return;
  const now=Date.now();
  const s={id:uid(),folderId:ui.q?null:ui.folderId,title:t,bpm:'',meter:'4/4',paper:'blank',pages:[{strokes:[]}],created:now,updated:now};
  store.songs.push(s);saveSong(s,true);ui.q='';openEditor(s.id);
}
async function newFolder(){
  const n=await askText('Folder baru','Nama folder','','Buat');if(!n)return;
  const f={id:uid(),parentId:ui.q?null:ui.folderId,name:n,created:Date.now()};
  store.folders.push(f);saveFolder(f);fillBank();
}
function removeSongs(ids){
  for(const id of ids){
    store.songs=store.songs.filter(s=>s.id!==id);idbDel('songs',id);
  }
  for(const l of store.setlists){const n=l.items.length;l.items=l.items.filter(it=>!ids.includes(it.songId));if(l.items.length!==n)saveSetlist(l);}
}
async function songMenu(id){
  const s=song(id);if(!s)return;
  const v=await choose(s.title||'Tanpa judul',[
    {label:'Buka & tulis',icon:'pen',v:'open'},{label:'Ganti judul',icon:'pen',v:'rename'},
    {label:'Pindahkan ke folder',icon:'folder',v:'move'},{label:'Duplikat',icon:'plus',v:'dup'},
    {label:'Hapus lagu',icon:'trash',danger:true,v:'del'}]);
  if(v==='open')openEditor(id);
  else if(v==='rename'){const t=await askText('Ganti judul','Judul lagu',s.title);if(t){s.title=t;saveSong(s,true);fillBank();}}
  else if(v==='move'){const f=await pickFolder('Pindahkan ke');if(f!==undefined){s.folderId=f;saveSong(s,true);fillBank();toast('Lagu dipindahkan');}}
  else if(v==='dup'){const c=JSON.parse(JSON.stringify(s));c.id=uid();c.title=(s.title||'Tanpa judul')+' (salinan)';c.created=Date.now();store.songs.push(c);saveSong(c,true);fillBank();}
  else if(v==='del'&&await confirmBox('Hapus lagu',`“${s.title||'Tanpa judul'}” akan dihapus dari bank dan dari semua setlist.`)){removeSongs([id]);fillBank();}
}
async function folderMenu(id){
  const f=folder(id);if(!f)return;
  const v=await choose(f.name,[{label:'Ganti nama',icon:'pen',v:'rename'},{label:'Pindahkan folder',icon:'folder',v:'move'},{label:'Hapus folder',icon:'trash',danger:true,v:'del'}]);
  if(v==='rename'){const n=await askText('Ganti nama folder','Nama folder',f.name);if(n){f.name=n;saveFolder(f);fillBank();}}
  else if(v==='move'){const p=await pickFolder('Pindahkan folder ke',[id,...descendants(id)]);if(p!==undefined){f.parentId=p;saveFolder(f);fillBank();}}
  else if(v==='del'){
    const ids=[id,...descendants(id)],ss=store.songs.filter(s=>ids.includes(s.folderId));
    if(await confirmBox('Hapus folder',`Folder “${f.name}” beserta ${ss.length} lagu di dalamnya akan dihapus.`)){
      removeSongs(ss.map(s=>s.id));
      for(const x of ids){store.folders=store.folders.filter(y=>y.id!==x);idbDel('folders',x);}
      if(ids.includes(ui.folderId))ui.folderId=null;
      renderBank();
    }
  }
}
function initBank(){
  const root=$('#scr-bank');
  root.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.id==='newSong')newSong();
    else if(t.id==='newFolder')newFolder();
    else if(t.dataset.openFolder!==undefined){ui.folderId=t.dataset.openFolder;ui.q='';renderBank();}
    else if(t.dataset.openSong)openEditor(t.dataset.openSong);
    else if(t.dataset.moreSong)songMenu(t.dataset.moreSong);
    else if(t.dataset.moreFolder)folderMenu(t.dataset.moreFolder);
    else if(t.dataset.crumb!==undefined){ui.folderId=t.dataset.crumb||null;ui.q='';renderBank();}
  });
  root.addEventListener('input',e=>{if(e.target.id==='bankQ'){ui.q=e.target.value;fillBank();}});
}

/* ================= setlist ================= */
function renderSets(){
  const sl=ui.slId?setlist(ui.slId):null;
  const root=$('#scr-sets');
  if(!sl){ui.slId=null;return renderSetList(root);}
  const rows=sl.items.map((it,i)=>{
    const s=song(it.songId);
    return `<div class="srow"><span class="n">${i+1}</span><div class="b"><span class="t">${esc(s?(s.title||'Tanpa judul'):'Lagu tidak ditemukan')}</span>
      <span class="s">${s?(s.bpm?s.bpm+' BPM · ':'')+esc(s.meter||'4/4')+' · '+s.pages.length+' hal · '+esc(pathLabel(s.folderId)):''}</span></div>
      <button class="icon-btn" data-play-from="${i}" aria-label="Mulai dari lagu ini">${ic('play')}</button>
      <button class="icon-btn" data-up="${i}" aria-label="Naikkan" ${i===0?'disabled':''}>${ic('up')}</button>
      <button class="icon-btn" data-down="${i}" aria-label="Turunkan" ${i===sl.items.length-1?'disabled':''}>${ic('down')}</button>
      <button class="icon-btn" data-del="${i}" aria-label="Keluarkan dari setlist">${ic('x')}</button></div>`;
  }).join('');
  root.innerHTML=`<div class="ph"><button class="icon-btn" id="slBack" aria-label="Kembali ke daftar setlist">${ic('back')}</button>
    <h1>${esc(sl.name)}</h1><button class="icon-btn" id="slRename" aria-label="Ganti nama setlist">${ic('pen')}</button><span class="sp"></span>
    <label class="mini">Tanggal<input class="field" type="date" id="slDate" value="${esc(sl.date||'')}" style="width:auto"></label>
    <button class="btn" id="slAdd">${ic('plus')}Tambah lagu</button>
    <button class="btn primary" id="slPlay">${ic('play')}Mulai tampil</button></div>
    <div class="scroll"><div class="rows">${rows||'<div class="empty">Setlist masih kosong. Tekan “Tambah lagu” lalu pilih dari bank lagu.</div>'}</div></div>`;
}
function renderSetList(root){
  const cards=store.setlists.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.created-a.created).map(l=>{
    const names=l.items.slice(0,3).map(it=>song(it.songId)).filter(Boolean).map(s=>s.title||'Tanpa judul').join(' · ');
    return `<div class="card setc"><button class="open" data-open-set="${l.id}"><span class="t">${esc(l.name)}</span>
      <span class="s">${l.date?esc(fmtDate(l.date))+' · ':''}${l.items.length} lagu</span><span class="s">${esc(names)}</span></button>
      <button class="icon-btn more" data-more-set="${l.id}" aria-label="Opsi setlist">${ic('more')}</button></div>`;
  }).join('');
  root.innerHTML=`<div class="ph"><h1>Setlist</h1><span class="sp"></span><button class="btn primary" id="newSet">${ic('plus')}Setlist baru</button></div>
    <div class="scroll"><div class="grid">${cards||'<div class="empty" style="grid-column:1/-1">Belum ada setlist. Buat satu untuk acara berikutnya, lalu pilih lagu dari bank.</div>'}</div></div>`;
}
async function newSetlist(){
  const n=await askText('Setlist baru','Nama acara','','Buat');if(!n)return;
  const l={id:uid(),name:n,date:'',items:[],created:Date.now(),updated:Date.now()};
  store.setlists.push(l);saveSetlist(l);ui.slId=l.id;renderSets();
}
async function setMenu(id){
  const l=setlist(id);if(!l)return;
  const v=await choose(l.name,[{label:'Buka',icon:'list',v:'open'},{label:'Ganti nama',icon:'pen',v:'rename'},{label:'Duplikat',icon:'plus',v:'dup'},{label:'Hapus setlist',icon:'trash',danger:true,v:'del'}]);
  if(v==='open'){ui.slId=id;renderSets();}
  else if(v==='rename'){const n=await askText('Ganti nama setlist','Nama acara',l.name);if(n){l.name=n;saveSetlist(l);renderSets();}}
  else if(v==='dup'){const c=JSON.parse(JSON.stringify(l));c.id=uid();c.name=l.name+' (salinan)';c.created=Date.now();c.items.forEach(it=>{it.eid=uid();});store.setlists.push(c);saveSetlist(c);renderSets();}
  else if(v==='del'&&await confirmBox('Hapus setlist',`Setlist “${l.name}” akan dihapus. Lagu di bank tidak ikut terhapus.`)){store.setlists=store.setlists.filter(x=>x.id!==id);idbDel('setlists',id);renderSets();}
}
function initSets(){
  const root=$('#scr-sets');
  root.addEventListener('click',async e=>{
    const t=e.target.closest('button');if(!t)return;
    const sl=ui.slId?setlist(ui.slId):null,d=t.dataset;
    if(t.id==='newSet')newSetlist();
    else if(d.openSet){ui.slId=d.openSet;renderSets();}
    else if(d.moreSet)setMenu(d.moreSet);
    else if(!sl)return;
    else if(t.id==='slBack'){ui.slId=null;renderSets();}
    else if(t.id==='slRename'){const n=await askText('Ganti nama setlist','Nama acara',sl.name);if(n){sl.name=n;saveSetlist(sl);renderSets();}}
    else if(t.id==='slAdd'){
      const ids=await pickSongs(sl.items.map(i=>i.songId));
      if(ids.length){ids.forEach(id=>sl.items.push({eid:uid(),songId:id}));saveSetlist(sl);renderSets();toast(ids.length+' lagu ditambahkan');}
    }
    else if(t.id==='slPlay')startPerf(sl.id,0);
    else if(d.playFrom!==undefined)startPerf(sl.id,+d.playFrom);
    else if(d.up!==undefined||d.down!==undefined){
      const i=+(d.up!==undefined?d.up:d.down),j=d.up!==undefined?i-1:i+1;
      if(j<0||j>=sl.items.length)return;
      [sl.items[i],sl.items[j]]=[sl.items[j],sl.items[i]];saveSetlist(sl);renderSets();
    }
    else if(d.del!==undefined){sl.items.splice(+d.del,1);saveSetlist(sl);renderSets();}
  });
  root.addEventListener('change',e=>{
    if(e.target.id==='slDate'&&ui.slId){const sl=setlist(ui.slId);if(sl){sl.date=e.target.value;saveSetlist(sl);}}
  });
}

/* ================= cadangan ================= */
function exportData(){return JSON.stringify({app:'buku-chart',v:1,folders:store.folders,songs:store.songs,setlists:store.setlists});}
function importData(txt){
  const d=JSON.parse(txt);
  if(!d||!Array.isArray(d.songs))throw new Error('format');
  const merge=(arr,list,kind)=>{
    for(const o of (arr||[])){
      if(!o||!o.id)continue;
      const i=store[list].findIndex(x=>x.id===o.id);
      if(i>=0)store[list][i]=o;else store[list].push(o);
      idbPut(kind,o);
    }
  };
  for(const s of d.songs){if(!Array.isArray(s.pages)||!s.pages.length)s.pages=[{strokes:[]}];}
  for(const l of (d.setlists||[])){if(!Array.isArray(l.items))l.items=[];}
  merge(d.folders,'folders','folders');merge(d.songs,'songs','songs');merge(d.setlists,'setlists','setlists');
  return [(d.songs||[]).length,(d.folders||[]).length,(d.setlists||[]).length];
}
function openBackup(){
  const body=html(`<div><p class="msg">Catatan tersimpan di perangkat ini. Salin cadangan sesekali, lalu tempel ke Catatan atau Files agar aman jika data Safari terhapus.</p>
    <textarea class="field ta" id="bkText" placeholder="Cadangan muncul di sini. Untuk impor, tempel cadangan di kotak ini."></textarea>
    <div class="btnrow"><button class="btn" id="bkCopy">${ic('save')}Salin cadangan</button><button class="btn" id="bkImport">Impor dari kotak</button></div>
    <p class="msg s" id="bkMsg"></p></div>`);
  $('#bkCopy',body).onclick=async()=>{
    const ta=$('#bkText',body);ta.value=exportData();
    try{await navigator.clipboard.writeText(ta.value);$('#bkMsg',body).textContent='Cadangan tersalin ke clipboard.';}
    catch(e){ta.focus();ta.select();$('#bkMsg',body).textContent='Clipboard ditolak. Teks sudah terpilih, tekan lama lalu pilih Salin.';}
  };
  $('#bkImport',body).onclick=()=>{
    const v=$('#bkText',body).value.trim();
    if(!v){$('#bkMsg',body).textContent='Kotak masih kosong.';return;}
    try{const [a,b,c]=importData(v);$('#bkMsg',body).textContent=`Diimpor: ${a} lagu, ${b} folder, ${c} setlist.`;refreshView();}
    catch(e){$('#bkMsg',body).textContent='Format cadangan tidak dikenali.';}
  };
  openModal('Cadangan data',body,[{label:'Tutup',v:null}],true);
}
function refreshView(){
  if(!$('#scr-bank').hidden)renderBank();
  else if(!$('#scr-sets').hidden)renderSets();
  else if(!$('#scr-editor').hidden)edRebase();
  else if(!$('#scr-perf').hidden)perfDraw();
}
/* ================= mode tampil ================= */
const perf={items:[],i:0,pg:0,slId:null,wl:null,sx:0,sy:0,st:0};
const trk=s=>s.title||'Tanpa judul';
function startPerf(slId,idx){
  const sl=setlist(slId);if(!sl)return;
  const items=sl.items.map(it=>song(it.songId)).filter(Boolean);
  if(!items.length){toast('Setlist masih kosong');return;}
  perf.slId=slId;perf.items=items;perf.i=Math.min(idx||0,items.length-1);perf.pg=0;
  $('#pDrawer').hidden=true;
  show('scr-perf');perfRender();keepAwake();
}
function perfDraw(){
  const st=$('#pStage'),w=st.clientWidth-16,h=st.clientHeight-16;
  if(w<50||h<50||!perf.items.length)return;
  const sc=Math.min(w/PW,h/PH),k=sc*Math.min(window.devicePixelRatio||1,2);
  const c=$('#pCanvas'),cw=Math.round(PW*k),ch=Math.round(PH*k);
  if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch;c.style.width=(PW*sc)+'px';c.style.height=(PH*sc)+'px';}
  readColors();renderPage(c.getContext('2d'),perf.items[perf.i],perf.pg,k);
}
function nextInfo(){
  const s=perf.items[perf.i];
  if(perf.pg<s.pages.length-1)return {t:'Hal. '+(perf.pg+2),s:'halaman berikut'};
  if(perf.i<perf.items.length-1)return {t:trk(perf.items[perf.i+1]),s:'lagu berikut'};
  return null;
}
function prevInfo(){
  if(perf.pg>0)return {t:'Hal. '+perf.pg,s:'halaman sebelum'};
  if(perf.i>0)return {t:trk(perf.items[perf.i-1]),s:'lagu sebelum'};
  return null;
}
function perfRender(){
  const s=perf.items[perf.i],n=perf.items.length;
  $('#pCount').textContent=`${perf.i+1}/${n}`;
  $('#pTitle').textContent=trk(s);
  $('#pBpm').textContent=s.bpm?s.bpm+' BPM':'– BPM';
  $('#pMeter').textContent=s.meter||'4/4';
  const pg=$('#pPg');pg.hidden=s.pages.length<2;pg.textContent=`Hal ${perf.pg+1}/${s.pages.length}`;
  const nx=nextInfo(),pv=prevInfo();
  const pb=$('#pPrev'),nb=$('#pNext');
  pb.disabled=!pv;nb.disabled=!nx;
  pb.innerHTML=ic('back')+(pv?`<span>${esc(pv.t)}<small>${pv.s}</small></span>`:'<span>Awal</span>');
  nb.innerHTML=(nx?`<span>${esc(nx.t)}<small>${nx.s}</small></span>`:'<span>Selesai</span>')+ic('next');
  perfDraw();perfList();
}
function perfList(){
  $('#pDrawerList').innerHTML=perf.items.map((s,i)=>`<button class="row-btn ${i===perf.i?'cur':''}" data-pi="${i}"><span class="n s">${i+1}</span><span>${esc(trk(s))}</span><span class="s">${s.bpm?s.bpm:''}</span></button>`).join('');
}
function perfStep(d){
  const s=perf.items[perf.i];
  if(d>0){
    if(perf.pg<s.pages.length-1)perf.pg++;
    else if(perf.i<perf.items.length-1){perf.i++;perf.pg=0;}
    else{toast('Ini lagu terakhir');return;}
  }else{
    if(perf.pg>0)perf.pg--;
    else if(perf.i>0){perf.i--;perf.pg=0;}
    else{toast('Ini lagu pertama');return;}
  }
  perfRender();
}
async function keepAwake(){try{if('wakeLock' in navigator)perf.wl=await navigator.wakeLock.request('screen');}catch(e){}}
function releaseAwake(){try{if(perf.wl)perf.wl.release();}catch(e){}perf.wl=null;}
function exitPerf(){releaseAwake();show('scr-sets');renderSets();}
function initPerf(){
  $('#pPrev').onclick=()=>perfStep(-1);
  $('#pNext').onclick=()=>perfStep(1);
  $('#pExit').onclick=exitPerf;
  $('#pList').onclick=()=>{$('#pDrawer').hidden=!$('#pDrawer').hidden;};
  $('#pDrawerList').addEventListener('click',e=>{
    const b=e.target.closest('[data-pi]');if(!b)return;
    perf.i=+b.dataset.pi;perf.pg=0;$('#pDrawer').hidden=true;perfRender();
  });
  const st=$('#pStage');
  st.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){perf.sx=e.clientX;perf.sy=e.clientY;perf.st=Date.now();}});
  st.addEventListener('pointerup',e=>{
    if(e.pointerType!=='touch'||!perf.st)return;
    const dx=e.clientX-perf.sx,dy=e.clientY-perf.sy,dt=Date.now()-perf.st;perf.st=0;
    if(Math.abs(dx)>90&&Math.abs(dy)<70&&dt<700)perfStep(dx<0?1:-1);
  });
  new ResizeObserver(()=>{if(!$('#scr-perf').hidden)perfDraw();}).observe(st);
  document.addEventListener('keydown',e=>{
    if($('#scr-perf').hidden||!$('#modal').hidden)return;
    const k=e.key;
    if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(k)){e.preventDefault();perfStep(1);}
    else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k)){e.preventDefault();perfStep(-1);}
    else if(k==='Escape')exitPerf();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#scr-perf').hidden)keepAwake();});
}

/* ================= contoh data awal ================= */
function seedStrokes(rows){
  const out=[];
  const S=(pts,w=1)=>({w,c:0,pts:pts.flatMap(p=>[p[0],p[1],0.5])});
  const L=(a,b,c,d,w=1)=>S([[a,b],[(a+c)/2,(b+d)/2],[c,d]],w);
  const oval=(x,y)=>{
    const a=[],b=[];
    for(let i=0;i<=16;i++){const t=i/16*6.9;a.push([x+Math.cos(t)*5.2,y+Math.sin(t)*3.5]);}
    for(let i=0;i<=10;i++){const t=i/10*6.5;b.push([x+Math.cos(t)*2.6,y+Math.sin(t)*1.7]);}
    return [S(a,2),S(b,1)];
  };
  const ss=systems('staff6');
  for(const r of rows){
    const s=ss[r.sys],g=s.gap;
    r.bars.forEach((b,bi)=>{
      const bx=70+bi*520,tops=[];
      for(let i=0;i<8;i++){
        const x=bx+34+i*60,hh=b.hh[i]==='x',sn=b.sn[i]==='x',bd=b.bd[i]==='x';
        if(hh){const y=s.y-0.55*g;out.push(L(x-4,y-4,x+4,y+4),L(x+4,y-4,x-4,y+4));}
        if(sn)out.push(...oval(x,s.y+1.5*g));
        if(bd){const y=s.y+3.5*g;out.push(...oval(x,y));out.push(L(x-5,y,x-5,y+3*g));}
        if(hh||sn){out.push(L(x+5,sn?s.y+1.5*g:s.y-0.55*g,x+5,s.y-3.4*g));tops[i]=x+5;}
      }
      for(let i=0;i<8;i+=2)if(tops[i]&&tops[i+1])out.push(L(tops[i],s.y-3.4*g,tops[i+1],s.y-3.4*g,2));
      out.push(L(bx+490,s.y,bx+490,s.y+4*g));
    });
  }
  return out;
}
function seedData(){
  const now=Date.now(),G=(hh,sn,bd)=>({hh,sn,bd});
  const f={id:uid(),parentId:null,name:'Contoh',created:now};
  const mk=(title,bpm,rows)=>({id:uid(),folderId:f.id,title,bpm:String(bpm),meter:'4/4',paper:'staff6',pages:[{strokes:seedStrokes(rows)}],created:now,updated:now});
  const A=mk('Rock Dasar (contoh)',110,[
    {sys:0,bars:[G('xxxxxxxx','..x...x.','x...x...'),G('xxxxxxxx','..x...x.','x...x...')]},
    {sys:2,bars:[G('xxxxxxxx','..x...x.','x..x..x.'),G('xxxxxxxx','..x...x.','x.x...x.')]}]);
  const B=mk('Funk Sederhana (contoh)',96,[
    {sys:0,bars:[G('xxxxxxxx','..x..x..','x..x..x.'),G('xxxxxxxx','..x..x..','x..x..x.')]},
    {sys:2,bars:[G('xxxxxxxx','..x..x.x','x.x..x..'),G('xxxxxxxx','..x..x..','x..x..x.')]}]);
  const l={id:uid(),name:'Contoh Setlist',date:'',items:[{eid:uid(),songId:A.id},{eid:uid(),songId:B.id}],created:now,updated:now};
  store.folders.push(f);store.songs.push(A,B);store.setlists.push(l);
  saveFolder(f);saveSong(A,true);saveSong(B,true);saveSetlist(l);
}

/* ================= mulai ================= */
(async function boot(){
  applyTheme();
  initBank();initSets();initPerf();
  $$('.rbtn[data-nav]').forEach(b=>b.onclick=()=>{
    if(b.dataset.nav==='bank'){show('scr-bank');renderBank();}
    else{ui.slId=null;show('scr-sets');renderSets();}
  });
  $('#btnBackup').onclick=openBackup;
  $('#btnTheme').onclick=()=>{
    prefs.theme=THEMES[(THEMES.indexOf(prefs.theme)+1)%THEMES.length];savePrefs();applyTheme();refreshView();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(prefs.theme==='auto')refreshView();});
  db=await openDB();
  if(db){
    const [fo,so,li,se]=await Promise.all([idbAll('folders'),idbAll('songs'),idbAll('setlists'),idbAll('settings')]);
    store.folders=fo;store.songs=so;store.setlists=li;
    store.settings=se.find(x=>x.id==='prefs')||{id:'prefs'};
    try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  }
  store.songs.forEach(s=>{if(!Array.isArray(s.pages)||!s.pages.length)s.pages=[{strokes:[]}];if(!s.paper)s.paper='blank';});
  store.setlists.forEach(l=>{if(!Array.isArray(l.items))l.items=[];});
  if(!store.settings.seeded){
    if(!store.songs.length&&!store.folders.length&&!store.setlists.length)seedData();
    store.settings.seeded=true;idbPut('settings',store.settings);
  }
  show('scr-bank');renderBank();
  if(!db){
    const w=html('<div class="warn">Penyimpanan lokal tidak aktif di browser ini. Catatan akan hilang saat halaman ditutup. Gunakan Cadangan untuk menyalinnya.</div>');
    $('#main').prepend(w);
  }
})();
if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
