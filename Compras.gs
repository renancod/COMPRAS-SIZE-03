/**
 * COMPRAS · Size Engenharia — ARQUIVO NOVO no MESMO projeto do Code.gs (planilha "Pedidos Size").
 * Usa o mesmo login/sessão. Ações do app de Compras começam com "c_"; as do link do financeiro com "fin_".
 * Colunas novas na aba Pedidos (T..Y) são criadas sozinhas.
 */
var CC = {
  RAIZ: 'Compras Size - Pedidos',   // pasta-mãe no Drive; dentro dela, uma pasta por pedido
  EMAIL_FINANCEIRO: '',             // e-mail(s) do financeiro, separados por vírgula (opcional; o link também é mostrado na tela)
  EMPRESA: 'Size Engenharia',
  FIN_DIAS: 15                      // validade do link do financeiro
};
var C = { NUM:1, OBRA:4, MAT:6, QTD:7, UN:8, DNEC:10, ST:12, FORN:13, VAL:14, DCOMP:15, DPAG:16, PREV:17, DENT:18, OBSC:19, PASTA:20, PAGTO:21, APROV:22, COTADO:23, LIB:24, COND:25 };
var NCOL = 25;
var NOMES_COL = { 20:'Pasta Drive', 21:'Forma de pagamento', 22:'Aprovação financeiro', 23:'Cotado a', 24:'Entrega liberada', 25:'Condição de compra' };

/* ---------- utilidades ---------- */
function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'); }
function stamp_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm'); }
function limpa_(t) { return String(t || 'arquivo').replace(/[^\w.\- ]/g, '_'); }
function h_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function brd_(iso) { return iso ? String(iso).split('-').reverse().join('/') : ''; }
function dt_(s) { if (!s) return ''; var a = String(s).split('-'); return new Date(+a[0], a[1] - 1, +a[2]); }
function nr_(x) { var n = Number(String(x == null ? '' : x).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function st_(p) { return String(p.r[C.ST - 1] || 'Aberto'); }
function obs_(p, t) { var a = p.r[C.OBSC - 1]; return (a ? a + ' | ' : '') + t; }
function exigirCompras_(u) { var p = norm_(u.perfil); if (p !== 'compras' && p !== 'admin') throw new Error('Seu acesso não é do setor de Compras (coluna Perfil da aba Acessos).'); }

function peds_() {
  var s = aba_(ABA.PEDIDOS), cab = s.getRange(1, 1, 1, NCOL).getValues()[0];
  for (var c in NOMES_COL) if (!cab[c - 1]) s.getRange(1, Number(c)).setValue(NOMES_COL[c]);
  var n = s.getLastRow(), rows = [];
  if (n >= 2) s.getRange(2, 1, n - 1, NCOL).getValues().forEach(function (r, i) { if (r[0] !== '') rows.push({ l: i + 2, r: r }); });
  return { s: s, rows: rows };
}
function set_(P, p, pares) { pares.forEach(function (x) { P.s.getRange(p.l, x[0]).setValue(x[1]); p.r[x[0] - 1] = x[1]; }); }
function sel_(P, q, ok) {
  var s = (q.numeros || []).map(String), it = P.rows.filter(function (p) { return s.indexOf(String(p.r[0])) >= 0; });
  if (!it.length) throw new Error('Nenhum pedido selecionado.');
  it.forEach(function (p) { if (ok.indexOf(st_(p)) < 0) throw new Error('Pedido ' + p.r[0] + ' está em "' + st_(p) + '": ação não permitida.'); });
  return it;
}
function fornAtivos_() {
  return linhas_(ABA.FORNECEDORES, 11).filter(function (r) { return r[1] !== '' && (r[10] === '' || sim_(r[10])); });
}
function fornPorNome_(nome) { return fornAtivos_().filter(function (f) { return norm_(f[1]) === norm_(nome); })[0]; }
function proxLinha_(s) {
  var n = s.getLastRow(); if (n < 2) return 2;
  var a = s.getRange(2, 1, n - 1, 1).getValues();
  for (var i = a.length - 1; i >= 0; i--) if (a[i][0] !== '') return i + 3;
  return 2;
}

/* ---------- Drive ---------- */
function raiz_() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('RAIZ_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(CC.RAIZ), f = it.hasNext() ? it.next() : DriveApp.createFolder(CC.RAIZ);
  pr.setProperty('RAIZ_ID', f.getId()); return f;
}
function pasta_(P, p) {
  var m = String(p.r[C.PASTA - 1] || '').match(/folders\/([-\w]+)/);
  if (m) { try { return DriveApp.getFolderById(m[1]); } catch (e) {} }
  var f = raiz_().createFolder(p.r[0] + ' - ' + String(p.r[C.OBRA - 1]).substring(0, 40));
  set_(P, p, [[C.PASTA, f.getUrl()]]); return f;
}
function salvar_(P, p, prefixo, nome, mime, b64) {
  if (!b64 || b64.length > 13000000) throw new Error('Arquivo vazio ou maior que ~9 MB.');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime || 'application/pdf', prefixo + '_' + stamp_() + '_' + limpa_(nome));
  return pasta_(P, p).createFile(blob);
}

/* ---------- e-mail ---------- */
function tag_(it) { return '[' + it.map(function (p) { return p.r[0]; }).join(', ') + ']'; }
function email_(para, assunto, titulo, intro, it, comValor, anexos) {
  var th = 'style="border:1px solid #ccc;padding:6px;background:#0E2A6B;color:#fff;text-align:left"', td = 'style="border:1px solid #ccc;padding:6px"';
  var lin = it.map(function (p) {
    var r = p.r;
    return '<tr><td ' + td + '>' + h_(r[0]) + '</td><td ' + td + '>' + h_(r[C.MAT - 1]) + '</td><td ' + td + '>' + h_(r[C.QTD - 1]) + ' ' + h_(r[C.UN - 1]) + '</td><td ' + td + '>' + h_(r[C.OBRA - 1]) + '</td><td ' + td + '>' + h_(brd_(dataIso_(r[C.DNEC - 1]))) + '</td>' +
      (comValor ? '<td ' + td + '>R$ ' + Number(r[C.VAL - 1]).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</td>' : '') + '</tr>';
  }).join('');
  var html = '<div style="font-family:Arial;font-size:14px"><h2 style="color:#0E2A6B">' + h_(titulo) + '</h2><p>' + intro + '</p><table style="border-collapse:collapse;font-size:13px"><tr><th ' + th + '>Nº</th><th ' + th + '>Material</th><th ' + th + '>Qtd</th><th ' + th + '>Entrega na obra</th><th ' + th + '>Necessário até</th>' + (comValor ? '<th ' + th + '>Valor</th>' : '') + '</tr>' + lin + '</table><p>Atenciosamente,<br>Setor de Compras · ' + h_(CC.EMPRESA) + '</p></div>';
  GmailApp.sendEmail(String(para).replace(/;/g, ','), assunto, 'Abra este e-mail em formato HTML.', { htmlBody: html, name: CC.EMPRESA + ' · Compras', attachments: anexos || [] });
}

/* ---------- link do financeiro (assinado, sem login) ---------- */
function tokFin_(nums) {
  var c = Utilities.base64EncodeWebSafe(JSON.stringify({ p: nums, e: Date.now() + CC.FIN_DIAS * 864e5 }), Utilities.Charset.UTF_8);
  return c + '.' + assinar_('fin' + c);
}
function lerTokFin_(t) {
  var a = String(t || '').split('.');
  if (a.length !== 2 || assinar_('fin' + a[0]) !== a[1]) throw new Error('Link inválido.');
  var d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(a[0])).getDataAsString());
  if (d.e < Date.now()) throw new Error('Link expirado. Peça um novo ao setor de Compras.');
  return d.p;
}

/* ---------- rotas ---------- */
function comprasRota_(q, u) {
  exigirCompras_(u);
  if (q.acao === 'c_dados') return cDados_();
  if (q.acao === 'c_capturar') return capturarEmails();
  var f = CA[q.acao]; if (!f) throw new Error('Ação desconhecida: ' + q.acao);
  var L = LockService.getScriptLock(); L.waitLock(30000);
  try { return f(q, u); } finally { L.releaseLock(); }
}

function cDados_() {
  var P = peds_(), pedidos = [];
  for (var i = P.rows.length - 1; i >= 0 && pedidos.length < 500; i--) {
    var r = P.rows[i].r;
    pedidos.push({ numero: String(r[0]), solicitante: String(r[2]), edificacao: String(r[3]), etapa: String(r[4]), material: String(r[5]), quantidade: r[6], unidade: String(r[7]), prioridade: String(r[8]), data_necessidade: dataIso_(r[9]), observacoes: String(r[10]), status: String(r[11] || 'Aberto'), fornecedor: String(r[12]), valor: r[13], previsao_entrega: dataIso_(r[16]), obs_compras: String(r[18]), pasta: String(r[19]), pagto: String(r[20]), aprov: String(r[21]), cotado: String(r[22]), entrega_liberada: dataIso_(r[23]), condicao: String(r[24]) });
  }
  return {
    pedidos: pedidos,
    fornecedores: fornAtivos_().map(function (f) { return { codigo: f[0], nome: f[1], contato: f[3], telefone: f[4], email: f[5], materiais: f[7], condicao: f[8] }; }),
    materiais: linhas_(ABA.MATERIAIS, 2).filter(function (r) { return r[0] !== ''; }).map(function (r) { return { descricao: r[0], unidade: r[1] }; }),
    unidades: linhas_(ABA.LISTAS, 3).map(function (r) { return String(r[0]).trim(); }).filter(Boolean)
  };
}

var CA = {
  c_cotar: function (q, u) {
    var P = peds_(), it = sel_(P, q, ['Aberto', 'Em cotação']), cods = (q.fornecedores || []).map(String);
    var fs = fornAtivos_().filter(function (f) { return cods.indexOf(String(f[0])) >= 0; });
    if (!fs.length) throw new Error('Escolha ao menos um fornecedor.');
    it.forEach(function (p) { pasta_(P, p); });
    var ok = [], sem = [];
    fs.forEach(function (f) {
      if (!f[5]) { sem.push(f[1]); return; }
      email_(f[5], 'Cotação Size ' + tag_(it), 'Solicitação de cotação', 'Prezados' + (f[3] ? ' (' + h_(f[3]) + ')' : '') + ', solicitamos cotação dos itens abaixo.' + (q.prazo ? ' Prazo para resposta: <b>' + brd_(q.prazo) + '</b>.' : '') + ' <b>Responda este e-mail anexando o orçamento em PDF</b> (mantenha o assunto). Informe preço, prazo de entrega e condição de pagamento.' + (q.msg ? '<br>' + h_(q.msg) : ''), it, false);
      ok.push(f[1]);
    });
    if (!ok.length) throw new Error('Nenhum fornecedor escolhido tem e-mail cadastrado.');
    it.forEach(function (p) {
      var a = p.r[C.COTADO - 1];
      set_(P, p, [[C.ST, 'Em cotação'], [C.COTADO, (a ? a + ' | ' : '') + ok.join(', ') + ' (' + hoje_() + ')'], [C.OBSC, obs_(p, 'Cotação enviada a ' + ok.join(', ') + ' em ' + hoje_())]]);
    });
    return { msg: 'Cotação enviada a ' + ok.join(', ') + '. Os PDFs respondidos por e-mail vão para a pasta do pedido no Drive.' + (sem.length ? ' Sem e-mail: ' + sem.join(', ') : '') };
  },
  c_comprar: function (q, u) {
    var P = peds_(), it = sel_(P, q, ['Aberto', 'Em cotação']), f = fornAtivos_().filter(function (x) { return String(x[0]) === String(q.fornecedor); })[0];
    if (!f) throw new Error('Fornecedor não encontrado.');
    var val = {}; it.forEach(function (p) { val[p.r[0]] = nr_((q.valores || {})[p.r[0]]); if (!(val[p.r[0]] > 0)) throw new Error('Informe o valor do pedido ' + p.r[0]); });
    it.forEach(function (p) {
      pasta_(P, p);
      set_(P, p, [[C.ST, 'Comprado'], [C.FORN, f[1]], [C.VAL, val[p.r[0]]], [C.COND, q.condicao || ''], [C.DCOMP, new Date()], [C.PREV, dt_(q.previsao)], [C.APROV, ''], [C.OBSC, obs_(p, 'Compra definida por ' + u.nome + ' em ' + hoje_())]]);
    });
    return { msg: it.length + ' pedido(s) com ' + f[1] + '. Agora use "Enviar ao financeiro".' };
  },
  c_financeiro: function (q, u) {
    var P = peds_(), it = sel_(P, q, ['Comprado']);
    it.forEach(function (p) {
      if (!p.r[C.FORN - 1] || !(Number(p.r[C.VAL - 1]) > 0)) throw new Error('Pedido ' + p.r[0] + ' sem fornecedor/valor.');
      if (String(p.r[C.APROV - 1]).indexOf('Aprovado') === 0) throw new Error('Pedido ' + p.r[0] + ' já foi aprovado.');
    });
    if (!/^https:\/\//.test(q.base || '')) throw new Error('Endereço do app inválido.');
    it.forEach(function (p) { pasta_(P, p); set_(P, p, [[C.APROV, 'Aguardando financeiro desde ' + hoje_()]]); });
    var link = q.base + 'financeiro.html?t=' + tokFin_(it.map(function (p) { return String(p.r[0]); }));
    var env = '';
    if (CC.EMAIL_FINANCEIRO) {
      email_(CC.EMAIL_FINANCEIRO, 'Aprovação de compra ' + tag_(it), 'Compra para aprovação', 'Há compras aguardando sua aprovação. <b><a href="' + link + '">Abrir orçamento e aprovar</a></b> (link válido por ' + CC.FIN_DIAS + ' dias).', it, true);
      env = ' E-mail enviado ao financeiro.';
    }
    return { msg: 'Link do financeiro gerado.' + env, link: link };
  },
  c_anexar: function (q, u) {
    var P = peds_(), it = sel_(P, q, ['Aberto', 'Em cotação', 'Comprado', 'Pago', 'Entregue']), pre = { ORC: 'ORC', NF: 'NF', COMPROVANTE: 'COMPROVANTE' }[q.tipo] || 'OUTRO';
    it.forEach(function (p) { salvar_(P, p, pre, q.nome, q.mime, q.b64); });
    return { msg: 'Arquivo salvo na pasta de ' + it.length + ' pedido(s).' };
  },
  c_liberar: function (q, u) {
    var P = peds_(), it = sel_(P, q, ['Comprado', 'Pago']), g = {}, out = [];
    it.forEach(function (p) { (g[p.r[C.FORN - 1]] = g[p.r[C.FORN - 1]] || []).push(p); });
    Object.keys(g).forEach(function (nome) {
      var f = fornPorNome_(nome);
      if (f && f[5]) { email_(f[5], 'Liberação de entrega Size ' + tag_(g[nome]), 'Entrega liberada', 'Prezados, está <b>liberada a entrega</b> dos itens abaixo no local indicado.' + (q.previsao ? ' Data prevista: <b>' + brd_(q.previsao) + '</b>.' : '') + (q.msg ? '<br>' + h_(q.msg) : ''), g[nome], false); out.push(nome); }
      g[nome].forEach(function (p) { set_(P, p, [[C.LIB, new Date()], [C.PREV, q.previsao ? dt_(q.previsao) : p.r[C.PREV - 1]], [C.OBSC, obs_(p, 'Entrega liberada por ' + u.nome + ' em ' + hoje_())]]); });
    });
    return { msg: 'Entrega liberada.' + (out.length ? ' E-mail enviado a ' + out.join(', ') + '.' : ' Nenhum e-mail enviado (fornecedor sem e-mail).') };
  },
  c_pagar: function (q) { var P = peds_(); sel_(P, q, ['Comprado']).forEach(function (p) { set_(P, p, [[C.ST, 'Pago'], [C.DPAG, new Date()]]); }); return { msg: 'Pagamento registrado.' }; },
  c_entregar: function (q) { var P = peds_(); sel_(P, q, ['Comprado', 'Pago']).forEach(function (p) { set_(P, p, [[C.ST, 'Entregue'], [C.DENT, new Date()]]); }); return { msg: 'Entrega confirmada.' }; },
  c_cancelar: function (q, u) { var P = peds_(); sel_(P, q, ['Aberto', 'Em cotação', 'Comprado']).forEach(function (p) { set_(P, p, [[C.ST, 'Cancelado'], [C.OBSC, obs_(p, 'Cancelado por ' + u.nome + ': ' + (q.motivo || ''))]]); }); return { msg: 'Cancelado.' }; },
  c_voltar: function (q, u) {
    var P = peds_(); sel_(P, q, ['Comprado']).forEach(function (p) { set_(P, p, [[C.ST, 'Em cotação'], [C.FORN, ''], [C.VAL, ''], [C.DCOMP, ''], [C.PREV, ''], [C.LIB, ''], [C.APROV, ''], [C.PAGTO, ''], [C.COND, ''], [C.OBSC, obs_(p, 'Compra desfeita por ' + u.nome)]]); });
    return { msg: 'Pedidos voltaram para cotação.' };
  },
  c_cadFornecedor: function (q) {
    var nome = String(q.nome || '').trim(); if (!nome) throw new Error('Informe o nome do fornecedor.');
    var s = aba_(ABA.FORNECEDORES), rows = linhas_(ABA.FORNECEDORES, 11), max = 0;
    rows.forEach(function (r) { if (norm_(r[1]) === norm_(nome)) throw new Error('Fornecedor já cadastrado.'); var n = parseInt(String(r[0]).replace(/\D/g, ''), 10); if (n > max) max = n; });
    var cod = 'F' + ('000' + (max + 1)).slice(-3);
    s.getRange(proxLinha_(s), 1, 1, 11).setValues([[cod, nome, q.cnpj || '', q.contato || '', q.telefone || '', q.email || '', q.cidade || '', q.materiais || '', q.condicao || '', q.obs || '', 'Sim']]);
    return { msg: 'Fornecedor ' + cod + ' cadastrado.' };
  },
  c_cadMaterial: function (q) {
    var d = String(q.descricao || '').trim(); if (!d) throw new Error('Informe o material.');
    if (linhas_(ABA.MATERIAIS, 2).some(function (r) { return norm_(r[0]) === norm_(d); })) throw new Error('Material já cadastrado.');
    var s = aba_(ABA.MATERIAIS); s.getRange(proxLinha_(s), 1, 1, 2).setValues([[d, q.unidade || '']]);
    return { msg: 'Material cadastrado.' };
  }
};

/* ---------- financeiro (acesso só pelo link) ---------- */
function finRota_(q) {
  var nums = lerTokFin_(q.t), P = peds_();
  var it = P.rows.filter(function (p) { return nums.indexOf(String(p.r[0])) >= 0; });
  if (!it.length) throw new Error('Pedidos não encontrados.');
  if (q.acao === 'fin_dados') {
    return { pedidos: it.map(function (p) {
      var r = p.r, arq = [], fi = pasta_(P, p).getFiles();
      while (fi.hasNext()) { var f = fi.next(); if (f.getName().indexOf('ORC_') === 0) arq.push({ id: f.getId(), nome: f.getName().replace(/^ORC_/, '') }); }
      return { numero: String(r[0]), material: String(r[5]), quantidade: r[6], unidade: String(r[7]), edificacao: String(r[3]), fornecedor: String(r[12]), valor: r[13], condicao: String(r[24]), status: st_(p), aprov: String(r[21]), pagto: String(r[20]), arquivos: arq };
    }) };
  }
  if (q.acao === 'fin_arquivo') {
    var p0 = it.filter(function (p) { return String(p.r[0]) === String(q.numero); })[0]; if (!p0) throw new Error('Pedido fora do link.');
    var fo = pasta_(P, p0), file = DriveApp.getFileById(q.id), pais = file.getParents(), ok = false;
    while (pais.hasNext()) if (pais.next().getId() === fo.getId()) ok = true;
    if (!ok) throw new Error('Arquivo não pertence ao pedido.');
    return { nome: file.getName(), mime: file.getMimeType(), b64: Utilities.base64Encode(file.getBlob().getBytes()) };
  }
  if (q.acao !== 'fin_aprovar') throw new Error('Ação desconhecida.');
  var L = LockService.getScriptLock(); L.waitLock(30000);
  try {
    var nome = String(q.nome || '').trim(); if (!nome) throw new Error('Informe seu nome.');
    var pend = it.filter(function (p) { return st_(p) === 'Comprado' && String(p.r[C.APROV - 1]).indexOf('Aprovado') !== 0; });
    if (!pend.length) throw new Error('Estes pedidos já foram aprovados.');
    var direto = q.forma === 'Faturamento direto';
    if (direto && !(q.comp && q.comp.b64)) throw new Error('No faturamento direto o comprovante é obrigatório.');
    if (!direto && !String(q.prazo || '').trim()) throw new Error('Informe o prazo do faturamento (ex: 30 dias).');
    var forma = direto ? 'Faturamento direto' : 'Faturado ' + String(q.prazo).trim(), anexos = [], g = {}, env = [];
    pend.forEach(function (p) {
      var pares = [[C.PAGTO, forma], [C.APROV, 'Aprovado por ' + nome + ' em ' + hoje_()], [C.OBSC, obs_(p, 'Financeiro: ' + forma + ' (' + nome + ', ' + hoje_() + ')')]];
      if (direto) { var f = salvar_(P, p, 'COMPROVANTE', q.comp.nome, q.comp.mime, q.comp.b64); if (!anexos.length) anexos.push(f.getBlob()); pares.push([C.ST, 'Pago'], [C.DPAG, new Date()]); }
      set_(P, p, pares);
      (g[p.r[C.FORN - 1]] = g[p.r[C.FORN - 1]] || []).push(p);
    });
    Object.keys(g).forEach(function (nf) {
      var f = fornPorNome_(nf); if (!f || !f[5]) return;
      email_(f[5], 'Compra aprovada Size ' + tag_(g[nf]), 'Compra aprovada', 'Prezados, a compra dos itens abaixo foi <b>aprovada pelo financeiro</b>. Forma de pagamento: <b>' + h_(forma) + '</b>.' + (direto ? ' Segue o comprovante em anexo.' : '') + '<br><b>Favor responder este e-mail anexando a nota fiscal.</b>', g[nf], true, anexos);
      env.push(nf);
    });
    return { msg: 'Aprovação registrada. ' + (env.length ? 'E-mail enviado a ' + env.join(', ') + '.' : 'Fornecedor sem e-mail cadastrado; avise o setor de Compras.') };
  } finally { L.releaseLock(); }
}

/* ---------- captura automática de PDFs que chegam por e-mail ---------- */
function capturarEmails() {
  var L = LockService.getScriptLock(); L.waitLock(30000);
  try {
    var eu = Session.getEffectiveUser().getEmail(), salvos = 0, P = null;
    GmailApp.search('has:attachment -from:me newer_than:90d (subject:"Cotação Size" OR subject:"Compra aprovada Size")', 0, 50).forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (m.getFrom().indexOf(eu) >= 0) return;
        var subj = m.getSubject(), nums = subj.match(/PED-\d{4}/g); if (!nums) return;
        var pre = /Cota/i.test(subj) ? 'ORC' : 'NF', rem = limpa_((m.getFrom().match(/<([^>]+)>/) || [0, m.getFrom()])[1]);
        m.getAttachments({ includeInlineImages: false }).forEach(function (a) {
          if (a.getSize() < 15000 && !/pdf/i.test(a.getContentType())) return;
          P = P || peds_();
          nums.forEach(function (n) {
            var p = P.rows.filter(function (x) { return String(x.r[0]) === n; })[0]; if (!p) return;
            var fo = pasta_(P, p), nome = pre + '_' + rem + '_' + m.getId().substring(0, 8) + '_' + limpa_(a.getName());
            if (fo.getFilesByName(nome).hasNext()) return;
            fo.createFile(a.copyBlob().setName(nome)); salvos++;
            set_(P, p, [[C.OBSC, obs_(p, (pre === 'ORC' ? 'Orçamento' : 'Nota fiscal') + ' recebido de ' + rem + ' em ' + hoje_())]]);
          });
        });
      });
    });
    return { msg: salvos + ' arquivo(s) novo(s) salvo(s) no Drive.' };
  } finally { L.releaseLock(); }
}
// Rode UMA vez no editor: autoriza Drive/Gmail e cria a verificação automática de e-mails a cada 10 min.
function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'capturarEmails') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('capturarEmails').timeBased().everyMinutes(10).create();
  peds_(); raiz_();
}
