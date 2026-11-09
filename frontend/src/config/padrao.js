// Configuração PADRÃO de todo cliente. É a base.
//
// Cada cliente pode sobrescrever qualquer chave daqui em
// src/clientes/<slug>/config.js — só o que ele declarar muda; o resto continua
// vindo deste arquivo. Chave nova no sistema nasce AQUI, com o valor que vale
// para todo mundo, e só depois algum cliente diverge dela.

const padrao = {
  // Nome exibido. Sobrescrito pelo nome cadastrado no banco quando houver.
  nome: 'Stock',

  tema: {
    corPrimaria: '#4FB3A9',
    corPrimariaInk: '#0F1112', // texto SOBRE a cor primária (escuro ou claro, o que contrastar)
    logo: null,                // caminho em /public ou URL
  },

  // Liga/desliga módulos de config/modulos.js: { produtos: false } esconde
  // rota e menu. Ausente = ligado.
  modulos: {},

  // Textos que costumam mudar de cliente para cliente.
  textos: {},

  // Regras de negócio parametrizáveis. Regra que só um cliente tem fica aqui
  // com o valor neutro (desligado) e o cliente liga no config dele.
  regras: {},

  // Abas que só o cliente tem: [{ caminho, pagina, rotulo, icone }].
  rotasExtras: [],
}

export default padrao
