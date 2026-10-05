const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={token:localStorage.c_token||'',nome:localStorage.c_nome||'',aba:'Aberto',sel:new Set(),ped:[],forn:[],uni:[],form:'',link:''};
const ABAS=['Aberto','Em cotação','Comprado','Pago','Entregue','Cadastros'];
const AC={cotar:'Pedir cotação',comprar:'Autorizar compra',anexar:'Anexar PDF',cancelar:'Cancelar',financeiro:'Enviar ao financeiro',liberar:'Liberar entrega',pagar:'Registrar pagamento',entregar:'Confirmar entrega',voltar:'Voltar p/ cotação'};
const POR={'Aberto':['cotar','comprar','anexar','cancelar'],'Em cotação':['cotar','comprar','anexar','cancelar'],'Comprado':['financeiro','liberar','pagar','entregar','anexar','voltar'],'Pago':['liberar','entregar','anexar'],'Entregue':['anexar'],'Cadastros':[]};
const SEC=['cancelar','voltar','anexar'];
const fd=i=>i?String(i).split('-').reverse().join('/'):'',R$=v=>v===''||v==null?'':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(f)});
function aviso(t,erro){const a=$('#aviso');a.innerHTML=`<p class="msg ${erro?'erro':'ok'}">${esc(t)}</p>`;setTimeout(()=>a.innerHTML='',7000)}
async function api(acao,d={}){
  const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({acao:acao==='login'?acao:'c_'+acao,token:S.token,...d})});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('A API não retornou JSON. Reimplante o Apps Script (nova versão) e confira o acesso "Qualquer pessoa".')}
  if(!j.ok)throw new Error(j.erro||'Erro na API');return j.dados}
function login(){
  $('#quem').hidden=true;
  $('#app').innerHTML=`<form class="card" id="f"><label>Seu nome<input name="nome" required></label><label>Senha<input name="senha" type="password" required></label><button class="btn">Entrar</button></form>`;
  $('#f').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;
    try{const d=await api('login',{nome:f.nome.value,senha:f.senha.value});
      if(!/^(compras|admin)$/i.test(String(d.perfil).trim()))throw new Error('Seu acesso não é do setor de Compras.');
      S.token=d.token;S.nome=d.nome;localStorage.c_token=d.token;localStorage.c_nome=d.nome;carregar()}
    catch(x){aviso(x.message,1);b.disabled=false}}}
async function carregar(){
  $('#quem').hidden=false;$('#quem').innerHTML=`${esc(S.nome)} · <a href="#" id="sair">sair</a> · <a href="#" id="atu">atualizar</a>`;
  $('#sair').onclick=e=>{e.preventDefault();localStorage.removeItem('c_token');S.token='';login()};$('#atu').onclick=e=>{e.preventDefault();carregar()};
  try{const d=await api('dados');S.ped=d.pedidos;S.forn=d.fornecedores;S.uni=d.unidades;S.sel.clear();S.form='';render()}
  catch(x){if(/[Ss]ess|perfil|setor/.test(x.message))return login();aviso(x.message,1)}}
function zap(p){
  const f=S.forn.find(x=>String(x.nome).trim().toLowerCase()===String(p.fornecedor).trim().toLowerCase());
  let t=String(f?.telefone||'').replace(/\D/g,'');if(!t)return '';if(t.length<=11)t='55'+t;
  const m=`Olá! A compra do pedido ${p.numero} (${p.material}, obra ${p.edificacao}) foi aprovada pelo financeiro (${p.pagto}). Pode enviar a nota fiscal, por favor? — Size Engenharia`;
  return `https://wa.me/${t}?text=${encodeURIComponent(m)}`}
function render(){
  if(S.aba==='Cadastros')return renderCad();
  const lista=S.ped.filter(p=>p.status===S.aba).sort((a,b)=>(b.prioridade==='Urgente')-(a.prioridade==='Urgente')||String(a.data_necessidade||'9').localeCompare(b.data_necessidade||'9'));
  const n=a=>a==='Cadastros'?'':` (${S.ped.filter(p=>p.status===a).length})`,acs=POR[S.aba];
  $('#app').innerHTML=`${abas(n)}${linkbox()}${lista.length?`<label class="ck"><input type="checkbox" id="todos"> Selecionar todos</label>`:''}
  ${lista.map(p=>{const z=String(p.aprov).startsWith('Aprovado')?zap(p):'';return `<article class="pedido"><input type="checkbox" data-n="${esc(p.numero)}" ${S.sel.has(p.numero)?'checked':''}><div class="corpo">
   <div class="topo"><strong>${esc(p.numero)}</strong>${p.prioridade==='Urgente'?'<span class="urg">URGENTE</span>':''}</div>
   <div class="mat">${esc(p.material)} — ${esc(p.quantidade)} ${esc(p.unidade)}</div>
   <div class="info"><div><b>Obra:</b> ${esc(p.edificacao)}${p.etapa?' · '+esc(p.etapa):''} · <b>Solic.:</b> ${esc(p.solicitante)}</div>
   ${p.data_necessidade?`<div><b>Necessário até:</b> ${fd(p.data_necessidade)}</div>`:''}${p.observacoes?`<div><b>Obs:</b> ${esc(p.observacoes)}</div>`:''}
   ${p.cotado?`<div><b>Cotado a:</b> ${esc(p.cotado)}</div>`:''}${p.fornecedor?`<div><b>Fornecedor:</b> ${esc(p.fornecedor)} ${R$(p.valor)}${p.condicao?' · '+esc(p.condicao):''}</div>`:''}
   ${p.previsao_entrega?`<div><b>Previsão:</b> ${fd(p.previsao_entrega)}</div>`:''}${p.aprov?`<div><b>Financeiro:</b> ${esc(p.aprov)}${p.pagto?' · '+esc(p.pagto):''}</div>`:''}
   ${p.entrega_liberada?`<div><b>Entrega liberada:</b> ${fd(p.entrega_liberada)}</div>`:''}${p.obs_compras?`<div><b>Histórico:</b> ${esc(p.obs_compras)}</div>`:''}</div>
   <div class="lnk">${p.pasta?`<a href="${esc(p.pasta)}" target="_blank">📁 Pasta no Drive</a>`:''}${z?` <a href="${z}" target="_blank">💬 WhatsApp ao fornecedor</a>`:''}</div></div></article>`}).join('')||'<p class="vazio">Nenhum pedido nesta etapa.</p>'}
  <div id="painel">${S.form}</div>
  ${S.sel.size&&!S.form?`<div class="barra">${acs.map(a=>`<button class="btn ${SEC.includes(a)?'sec':''}" data-ac="${a}">${AC[a]} (${S.sel.size})</button>`).join('')}</div>`:''}`;
  ligaAbas();
  document.querySelectorAll('[data-n]').forEach(c=>c.onchange=()=>{c.checked?S.sel.add(c.dataset.n):S.sel.delete(c.dataset.n);render()});
  if($('#todos'))$('#todos').onchange=e=>{lista.forEach(p=>e.target.checked?S.sel.add(p.numero):S.sel.delete(p.numero));render()};
  document.querySelectorAll('[data-ac]').forEach(b=>b.onclick=()=>abrir(b.dataset.ac));
  if(S.form)ligar();
  const cp=$('#cp');if(cp)cp.onclick=()=>{navigator.clipboard.writeText(S.link);aviso('Link copiado')}}
const abas=n=>`<nav class="abas">${ABAS.map(a=>`<button class="${a===S.aba?'on':''}" data-a="${a}">${a}${n(a)}</button>`).join('')}</nav>`;
function ligaAbas(){document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{S.aba=b.dataset.a;S.sel.clear();S.form='';render()})}
const linkbox=()=>S.link?`<div class="card"><b>Link do financeiro</b><input readonly value="${esc(S.link)}"><button class="btn" id="cp">Copiar link</button><a class="btn sec" style="text-align:center;text-decoration:none" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Aprovação de compra – Size Engenharia: '+S.link)}">Enviar por WhatsApp</a></div>`:'';
function renderCad(){
  $('#app').innerHTML=`${abas(()=>'')}
  <form class="card" id="cf"><h3>Cadastrar fornecedor</h3><label>Razão social / Nome<input name="nome" required></label>
   <label>E-mail (recebe as cotações)<input name="email" type="email"></label><label>Telefone / WhatsApp<input name="telefone" placeholder="(51) 99999-0000"></label>
   <label>Contato<input name="contato"></label><label>CNPJ / CPF<input name="cnpj"></label><label>Cidade / UF<input name="cidade"></label>
   <label>Materiais que fornece<input name="materiais"></label><label>Condição de pagamento<input name="condicao"></label><button class="btn">Salvar fornecedor</button></form>
  <form class="card" id="mf"><h3>Cadastrar material</h3><label>Descrição<input name="descricao" required placeholder="ex: cimento CP-II 50kg"></label>
   <label>Unidade<select name="unidade">${S.uni.map(u=>`<option>${esc(u)}</option>`).join('')}</select></label><button class="btn">Salvar material</button></form>
  <div class="card"><h3>E-mails recebidos</h3><small>Orçamentos e notas respondidos por e-mail são salvos sozinhos na pasta do pedido a cada 10 min.</small><button class="btn sec" id="cap">Verificar e-mails agora</button></div>`;
  ligaAbas();
  const envia=(id,ac,fn)=>$(id).onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;
    try{const r=await api(ac,fn(f));aviso(r.msg);f.reset();carregar().then(()=>{S.aba='Cadastros';render()})}catch(x){aviso(x.message,1)}b.disabled=false};
  envia('#cf','cadFornecedor',f=>Object.fromEntries(new FormData(f)));envia('#mf','cadMaterial',f=>Object.fromEntries(new FormData(f)));
  $('#cap').onclick=async e=>{e.target.disabled=true;try{aviso((await api('capturar')).msg)}catch(x){aviso(x.message,1)}e.target.disabled=false}}
function abrir(ac){
  const it=S.ped.filter(p=>S.sel.has(p.numero));let c='';
  if(ac==='cotar')c=`<div class="forn">${S.forn.map(f=>`<label class="ck"><input type="checkbox" name="forn" value="${esc(f.codigo)}" ${f.email?'':'disabled'}><span>${esc(f.nome)}<br><small>${esc(f.materiais)}${f.email?'':' · sem e-mail (cadastre em Cadastros)'}</small></span></label>`).join('')||'<small>Nenhum fornecedor. Cadastre em Cadastros.</small>'}</div>
    <label>Responder até<input type="date" name="prazo"></label><label>Mensagem (opcional)<input name="msg"></label><small>O fornecedor responde o e-mail com o PDF e ele é salvo na pasta do pedido no Drive.</small>`;
  if(ac==='comprar')c=`<label>Fornecedor escolhido<select name="fornecedor">${S.forn.map(f=>`<option value="${esc(f.codigo)}">${esc(f.nome)}</option>`).join('')}</select></label>
    <label>Condição da proposta<input name="condicao"></label><label>Previsão de entrega<input type="date" name="previsao"></label>
    ${it.map(p=>`<label>Valor total — ${esc(p.numero)} ${esc(p.material)} (R$)<input name="v_${esc(p.numero)}" inputmode="decimal" required></label>`).join('')}`;
  if(ac==='anexar')c=`<label>Tipo<select name="tipo"><option value="ORC">Orçamento</option><option value="NF">Nota fiscal</option><option value="COMPROVANTE">Comprovante</option><option value="OUTRO">Outro</option></select></label><label>Arquivo (PDF ou imagem, até ~9 MB)<input type="file" name="arq" accept="application/pdf,image/*" required></label>`;
  if(ac==='financeiro')c=`<small>Gera o link de aprovação (e envia por e-mail ao financeiro, se configurado). O financeiro vê o PDF do orçamento e aprova ou envia o pagamento.</small>`;
  if(ac==='liberar')c=`<label>Previsão de entrega (opcional)<input type="date" name="previsao"></label><label>Mensagem (opcional)<input name="msg"></label><small>Envia e-mail ao fornecedor liberando a entrega na obra.</small>`;
  if(ac==='cancelar')c=`<label>Motivo<input name="motivo" required></label>`;
  if(!c)c=`<small>Confirmar "${AC[ac]}" para ${it.length} pedido(s)?</small>`;
  S.form=`<form class="card" id="ff" data-ac="${ac}"><h3>${AC[ac]} · ${it.length} pedido(s)</h3>${c}<button class="btn">Confirmar</button><button type="button" class="btn sec" id="nao">Voltar</button></form>`;render()}
function ligar(){
  const f=$('#ff'),ac=f.dataset.ac;$('#nao').onclick=()=>{S.form='';render()};
  if(ac==='comprar'){const s=f.fornecedor,pre=()=>{const x=S.forn.find(y=>String(y.codigo)===s.value);f.condicao.value=x?.condicao||''};s.onchange=pre;pre()}
  f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('.btn');b.disabled=true;b.textContent='Aguarde…';
    const d={numeros:[...S.sel]};
    try{
      if(ac==='cotar'){d.fornecedores=[...f.querySelectorAll('[name=forn]:checked')].map(x=>x.value);d.prazo=f.prazo.value;d.msg=f.msg.value}
      if(ac==='comprar'){d.fornecedor=f.fornecedor.value;d.condicao=f.condicao.value;d.previsao=f.previsao.value;d.valores={};d.numeros.forEach(n=>d.valores[n]=f['v_'+n].value)}
      if(ac==='anexar'){const a=f.arq.files[0];d.tipo=f.tipo.value;d.nome=a.name;d.mime=a.type;d.b64=await b64(a)}
      if(ac==='financeiro')d.base=location.href.replace(/[?#].*$/,'').replace(/[^\/]*$/,'');
      if(ac==='liberar'){d.previsao=f.previsao.value;d.msg=f.msg.value}
      if(ac==='cancelar')d.motivo=f.motivo.value;
      const r=await api(ac,d);aviso(r.msg||'Feito');await carregar();if(r.link){S.link=r.link;render()}
    }catch(x){if(/[Ss]ess/.test(x.message))return login();aviso(x.message,1);b.disabled=false;b.textContent='Confirmar'}}}
S.token?carregar():login();
