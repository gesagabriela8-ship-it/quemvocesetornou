// Logica compartilhada da Etapa 2 ("A Camada Oculta"): faixas, classificacao dos
// 10 perfis hibridos e codificacao do resultado. Usada no navegador
// (camada-oculta.html) e no servidor (api/hotmart-webhook.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CamadaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var VERSAO = 'camada-1.1';
  var DIMS = ['A', 'V', 'D', 'H', 'S'];
  var DIM_NOMES = {
    A: 'Apego ansioso', V: 'Apego evitativo', D: 'Dependência emocional',
    H: 'Hiperindependência', S: 'Segurança afetiva'
  };
  var NOMES = {
    ambivalencia: 'Ambivalência Afetiva',
    paradoxo: 'O Paradoxo da Proximidade',
    fortaleza: 'A Fortaleza Vigilante',
    equilibrista: 'O Equilibrista Emocional',
    confianca: 'A Confiança em Construção',
    autonomia: 'A Autonomia Cautelosa',
    coracao: 'O Coração Sensível',
    guardiao: 'O Guardião de Si Mesmo',
    investidor: 'O Investidor Afetivo',
    recuperacao: 'A Recuperação da Confiança',
    mapa: 'Seu Mapa Dimensional'
  };
  // Perfil da etapa 1 -> dimensao correspondente (usado no desempate)
  var E1_DIM = { ansioso: 'A', evitativo: 'V', dependente: 'D', hiperindependente: 'H', seguro: 'S' };
  var E1_NOMES = {
    ansioso: 'Apego Ansioso', evitativo: 'Apego Evitativo', seguro: 'Apego Seguro',
    dependente: 'Dependência Emocional', hiperindependente: 'Hiperindependência Emocional'
  };
  var E1_COD = { ansioso: 'a', evitativo: 'e', seguro: 's', dependente: 'd', hiperindependente: 'h' };

  // Ordem = prioridade. grupo: 1 (tres dimensoes), 2 (duas), 3a (Investidor), 3b (demais com seguranca)
  // 'h' = elevada (14-21), 'm' = intermediaria (8-13)
  var REGRAS = [
    { k: 'recuperacao', g: '1', req: { D: 'h', H: 'h', S: 'h' } },
    { k: 'equilibrista', g: '1', req: { A: 'h', V: 'h', H: 'h' } },
    { k: 'ambivalencia', g: '2', req: { D: 'h', H: 'h' } },
    { k: 'fortaleza', g: '2', req: { A: 'h', H: 'h' } },
    { k: 'paradoxo', g: '2', req: { A: 'h', V: 'h' } },
    { k: 'guardiao', g: '2', req: { V: 'h', H: 'h' } },
    { k: 'investidor', g: '3a', req: { S: 'h', D: 'm', A: 'm' } },
    { k: 'confianca', g: '3b', req: { S: 'h', D: 'm' } },
    { k: 'autonomia', g: '3b', req: { S: 'h', V: 'm' } },
    { k: 'coracao', g: '3b', req: { S: 'h', A: 'm' } }
  ];
  var GRUPOS = ['1', '2', '3a', '3b'];

  function nivel(v) { return v >= 14 ? 'h' : (v >= 8 ? 'm' : 'b'); }
  function faixa(v) { return v >= 14 ? 'elevada' : (v >= 8 ? 'intermediária' : 'baixa'); }

  // respostas: array de 35 valores 0-3, na ordem A(1-7) V(8-14) D(15-21) H(22-28) S(29-35)
  function pontuar(respostas) {
    var s = {};
    DIMS.forEach(function (d, i) {
      var soma = 0;
      for (var j = 0; j < 7; j++) soma += Number(respostas[i * 7 + j]) || 0;
      s[d] = soma;
    });
    return s;
  }

  // A partir da v1.1: a classificacao por patamar (h/m) e a prioridade de grupos
  // (1 > 2 > 3a > 3b) continuam exatamente como a Dra. Aline desenhou - isso e o
  // que da peso certo pra quem realmente tem 3 dimensoes elevadas (grupo 1) sobre
  // quem tem so 2. A unica mudanca: antes, quando NENHUMA das 10 regras batia o
  // patamar minimo, a pessoa caia no "mapa" de fallback. Agora, nesse caso (e so
  // nesse caso), em vez do mapa, escolhemos a regra cujas dimensoes exigidas tem a
  // maior media de pontuacao da pessoa - ou seja, sempre as dimensoes/perfis mais
  // fortes dela que definem qual dos 10 hibridos ela recebe, mesmo sem bater o
  // patamar oficial. Isso garante que todo mundo sempre recebe um dos 10 perfis.
  function classificar(s, e1) {
    var dimE1 = E1_DIM[e1] || null;
    for (var gi = 0; gi < GRUPOS.length; gi++) {
      var eleg = REGRAS.filter(function (r) {
        if (r.g !== GRUPOS[gi]) return false;
        return Object.keys(r.req).every(function (d) { return nivel(s[d]) === r.req[d]; });
      });
      if (!eleg.length) continue;
      if (eleg.length === 1) return { tipo: 'perfil', key: eleg[0].k, regra: 'grupo ' + GRUPOS[gi], versao: VERSAO };
      // Desempate 1: maior soma nas dimensoes exigidas
      var soma = function (r) { return Object.keys(r.req).reduce(function (t, d) { return t + s[d]; }, 0); };
      var max = Math.max.apply(null, eleg.map(soma));
      var top = eleg.filter(function (r) { return soma(r) === max; });
      var regra = 'grupo ' + GRUPOS[gi] + ', desempate por soma';
      // Desempate 2: perfil ligado ao resultado da etapa 1
      if (top.length > 1 && dimE1) {
        var lig = top.filter(function (r) { return r.req[dimE1]; });
        if (lig.length) { top = lig; regra = 'grupo ' + GRUPOS[gi] + ', desempate pela etapa 1'; }
      }
      // Desempate 3: ordem da lista
      if (top.length > 1) regra = 'grupo ' + GRUPOS[gi] + ', desempate pela ordem';
      return { tipo: 'perfil', key: top[0].k, regra: regra, versao: VERSAO };
    }
    // Ninguem bateu patamar: nunca mais cai no mapa - escolhe o melhor encaixe
    // entre os 10, pela media de pontuacao nas dimensoes que cada regra pede
    // (media deixa regras de 2 e de 3 dimensoes comparaveis entre si).
    var media = function (r) {
      var dims = Object.keys(r.req);
      return dims.reduce(function (t, d) { return t + s[d]; }, 0) / dims.length;
    };
    var maxMedia = Math.max.apply(null, REGRAS.map(media));
    var topMedia = REGRAS.filter(function (r) { return media(r) === maxMedia; });
    var regraFinal = 'sem patamar, melhor encaixe (media ' + maxMedia.toFixed(1) + ')';
    if (topMedia.length > 1 && dimE1) {
      var ligFinal = topMedia.filter(function (r) { return r.req[dimE1]; });
      if (ligFinal.length) { topMedia = ligFinal; regraFinal += ', desempate pela etapa 1'; }
    }
    if (topMedia.length > 1) regraFinal += ', desempate pela ordem';
    return { tipo: 'perfil', key: topMedia[0].k, regra: regraFinal, versao: VERSAO };
  }

  // Blocos do Mapa Dimensional, na ordem de exibicao
  function blocosMapa(s) {
    if (DIMS.every(function (d) { return nivel(s[d]) === 'b'; })) return ['abertura', 'baixas', 'fechamento'];
    var b = ['abertura'];
    DIMS.forEach(function (d) { if (nivel(s[d]) === 'h') b.push(d + '2'); });
    DIMS.forEach(function (d) { if (nivel(s[d]) === 'm') b.push(d + '1'); });
    if (s.A >= 14 && s.D >= 14) b.push('AD');
    b.push('fechamento');
    return b;
  }

  function pad(n) { n = Math.max(0, Math.min(21, Math.round(Number(n) || 0))); return (n < 10 ? '0' : '') + n; }

  // Codigo compacto do resultado (vai no parametro sck da Hotmart e no link do e-mail)
  // formato: qv3 + letra do perfil da etapa 1 (ou x) + A V D H S com 2 digitos cada
  function codificar(e1, s) {
    return 'qv3' + (E1_COD[e1] || 'x') + DIMS.map(function (d) { return pad(s[d]); }).join('');
  }
  function decodificar(cod) {
    var m = /^qv3([aesdhx])(\d{10})$/.exec(String(cod || '').trim());
    if (!m) return null;
    var e1 = Object.keys(E1_COD).filter(function (k) { return E1_COD[k] === m[1]; })[0] || null;
    var s = {};
    DIMS.forEach(function (d, i) { s[d] = Math.min(21, parseInt(m[2].substr(i * 2, 2), 10)); });
    return { e1: e1, s: s };
  }

  return {
    VERSAO: VERSAO, DIMS: DIMS, DIM_NOMES: DIM_NOMES, NOMES: NOMES, E1_NOMES: E1_NOMES,
    nivel: nivel, faixa: faixa, pontuar: pontuar, classificar: classificar,
    blocosMapa: blocosMapa, codificar: codificar, decodificar: decodificar
  };
});
