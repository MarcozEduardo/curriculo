/* NUCLEO NEXUS · DATA monta snapshot do ranker real · ver README.md */
(function () {
  'use strict';
  var CORES = {
    contato: '#ff7a00', marcos: '#f59e0b', projetos: '#10b981',
    recrutador: '#a855f7', nexus: '#06b6d4', sobre_marcos: '#fbbf24',
    historia_pessoal: '#dc2626', skills: '#3b82f6', experiencia: '#f97316',
    formacao: '#8b5cf6', neurodivergencia: '#ec4899', recrutamento: '#a855f7',
    transparencia: '#14b8a6', meta_ia: '#6366f1', smalltalk: '#94a3b8',
    curiosidades: '#eab308', glossario: '#64748b', sobre_curriculo: '#0891b2',
    identidade_visitante: '#f43f5e', pcd: '#fb7185'
  };
  function build() {
    var ranker = window.BobbyChat && window.BobbyChat.ranker;
    if (!ranker) return null;
    var memory = ranker.memory || {};
    var nodesMap = (ranker.dialog && ranker.dialog.nodes) || null;
    if (!nodesMap || !nodesMap.size) return null;
    var byOrbit = {};
    nodesMap.forEach(function (node) {
      var slug = node.orbit || 'unknown';
      if (!byOrbit[slug]) byOrbit[slug] = [];
      byOrbit[slug].push(node);
    });
    var orbitSlugs = Object.keys(byOrbit);
    var orbitas = orbitSlugs.map(function (slug) {
      var all = byOrbit[slug] || [];
      var layer1 = all.filter(function (n) { return n.layer === 1; });
      var visible = (layer1.length ? layer1 : all).slice(0, 14);
      var objetos = visible.map(function (node) {
        var variants = (node.variants || []).slice(0, 3);
        var atributos = variants.map(function (v, i) {
          return { nome: 'v' + (i + 1), tipo: 'explicavel', dono: node.id, pendente: false, entregue: false };
        });
        if (atributos.length === 0 && node.answer) {
          atributos.push({ nome: 'resposta', tipo: 'explicavel', dono: node.id, pendente: false, entregue: false });
        }
        var rotuloBase = node.label || node.question || node.id || 'node';
        return {
          slug: String(node.id || 'n-' + Math.random().toString(36).slice(2, 6)),
          rotulo: String(rotuloBase).slice(0, 22),
          genero: 'm', dono: 'marcos', tipo_entidade: 'conceito',
          serve_para: node.facet || '',
          ativo: memory.activeEntity === node.id,
          no_rastro: false, calor_rastro: 0, assunto: null,
          atributos: atributos
        };
      });
      var temp = 0.2;
      if (memory.topicCount && memory.topicCount[slug]) temp = Math.min(1, 0.3 + memory.topicCount[slug] * 0.1);
      if (memory.activeOrbit === slug) temp = Math.max(temp, 0.7);
      return {
        slug: slug, nome: slug, descricao: '',
        cor: CORES[slug] || '#ff7a00', temperatura: temp, fechada: false,
        visitada: !!(memory.topicCount && memory.topicCount[slug] > 0),
        turnosVisitados: (memory.topicCount && memory.topicCount[slug]) || 0,
        objetos: objetos
      };
    });
    var sat = (memory.history || []).slice(-6).reverse().map(function (h) {
      return { objeto: h.entity || h.orbit, orbita: h.orbit, assunto: h.facet, calor: 1 };
    }).filter(function (s) { return s.objeto; });
    return {
      links: {},
      orbita_ativa: memory.activeOrbit || orbitSlugs[0] || 'contato',
      objeto_ativo: memory.activeEntity || null,
      assunto_ativo: memory.lastFacet || null,
      entregues_sessao: [],
      satelite: sat,
      conexoes_posse: [],
      contagens: { orbitas: orbitSlugs.length, satelites: nodesMap.size, atributos: 0, blocos: 0 },
      turnos: memory.turn || 0,
      orbitas: orbitas,
      telemetria: { total_repeticoes: 0, total_embregens: 0, camadas_tela: [], so_opcoes: false, sugestoes_ativas: [], pendentes: 0 }
    };
  }
  window.NucleoData = { build: build };
})();