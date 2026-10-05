const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=new URLSearchParams(location.search).get('t')||'';
const R$=v=>v===''||v==null?'':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function aviso(t,e){$('#aviso').innerHTML=`<p class="msg ${e?'erro':'ok'}">${esc(t)}</p>`;setTimeout(()=>$('#aviso').innerHTML='',7000)}
async function api(acao,d={}){
  const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({acao,t:T,...d})});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('A API não retornou JSON.')}
  if(!j.ok)throw new Error(j.erro);return j.dados}
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(f)});
let D=[];
async function init(){try{D=(await api('fin_dados')).pedidos;draw()}catch(x){$('#app').innerHTML=`<p class="msg erro">${esc(x.message)}</p>`}}
function draw(){
  const pend=D.filter(p=>p.status==='Comprado'&&!p.aprov.startsWith('Aprovado')),tot=D.reduce((a,p)=>a+Number(p.valor||0),0);
  $('#app').innerHTML=`<h2 class="sub">${D.length} pedido(s) · total ${R$(tot)}</h2>
  ${D.map(p=>`<article class="pedido" style="grid-template-columns:1fr"><div class="topo"><strong>${esc(p.numero)}</strong><span class="tag">${esc(p.status)}</span></div>
   <div class="mat">${esc(p.material)} — ${esc(p.quantidade)} ${esc(p.unidade)}</div>
   <div class="info"><div><b>Obra:</b> ${esc(p.edificacao)}</div><div><b>Fornecedor:</b> ${esc(p.fornecedor)} · <b>${R$(p.valor)}</b></div>${p.condicao?`<div><b>Condição:</b> ${esc(p.condicao)}</div>`:''}${p.aprov?`<div><b>Situação:</b> ${esc(p.aprov)}${p.pagto?' · '+esc(p.pagto):''}</div>`:''}</div>
   ${p.arquivos.map(a=>`<button class="btn sec ver" data-n="${esc(p.numero)}" data-id="${esc(a.id)}">📄 ${esc(a.nome)}</button>`).join('')||'<small>Nenhum orçamento anexado ainda.</small>'}</article>`).join('')}
  <div id="viewer"></div>
  ${pend.length?`<form class="card" id="f"><h3>Decisão</h3><label>Seu nome<input name="nome" required></label>
   <label>Forma de pagamento<select name="forma"><option>Faturamento direto</option><option>Faturado</option></select></label>
   <label id="lp" hidden>Prazo do faturamento<input name="prazo" value="30 dias"></label>
   <label id="lc">Comprovante de pagamento (obrigatório)<input name="comp" type="file" accept="application/pdf,image/*"></label>
   <button class="btn" id="bt">Enviar pagamento</button></form>`:'<p class="msg ok">Nenhuma aprovação pendente neste link.</p>'}`;
  document.querySelectorAll('.ver').forEach(b=>b.onclick=async()=>{
    b.disabled=true;try{const a=await api('fin_arquivo',{numero:b.dataset.n,id:b.dataset.id});
      const bytes=Uint8Array.from(atob(a.b64),c=>c.charCodeAt(0)),u=URL.createObjectURL(new Blob([bytes],{type:a.mime}));
      $('#viewer').innerHTML=`<p><b>${esc(a.nome)}</b> · <a href="${u}" target="_blank">abrir em nova aba</a></p><iframe src="${u}" style="width:100%;height:70vh;border:1px solid var(--line);background:#fff"></iframe>`;
      $('#viewer').scrollIntoView()}catch(x){aviso(x.message,1)}b.disabled=false});
  const f=$('#f');if(!f)return;
  f.forma.onchange=()=>{const d=f.forma.value==='Faturamento direto';$('#lp').hidden=d;$('#lc').hidden=!d;$('#bt').textContent=d?'Enviar pagamento':'Aprovar'};
  f.onsubmit=async e=>{e.preventDefault();const d=f.forma.value==='Faturamento direto',fl=f.comp.files[0];
    if(d&&!fl)return aviso('No faturamento direto o comprovante é obrigatório.',1);
    $('#bt').disabled=true;
    try{const r=await api('fin_aprovar',{nome:f.nome.value,forma:f.forma.value,prazo:f.prazo.value,comp:d?{nome:fl.name,mime:fl.type,b64:await b64(fl)}:null});aviso(r.msg);init()}
    catch(x){aviso(x.message,1);$('#bt').disabled=false}}}
init();
