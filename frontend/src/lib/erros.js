// Chaves que as funções do banco levantam (raise exception '<chave>') e
// mensagens do Supabase Auth, traduzidas para a tela.
const MENSAGENS = {
  convite_invalido: 'Código de convite não encontrado.',
  convite_usado: 'Este código já foi usado.',
  convite_expirado: 'Este código expirou. Peça um novo.',
  nome_obrigatorio: 'Informe o nome da empresa.',
  slug_invalido: 'O nome da empresa precisa ter letras ou números.',
  slug_reservado: 'Esse nome não pode ser usado como endereço. Tente outro.',
  slug_em_uso: 'Esse endereço já está em uso.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo.',
  somente_admin: 'Só o administrador pode fazer isso.',
  somente_dono: 'Só o dono da conta pode alterar isso.',
  validade_invalida: 'Validade deve ser de 1 a 90 dias.',
  'User already registered': 'Já existe uma conta com este e-mail. Entre com ela e use o código.',
  produto_nao_encontrado: 'Produto não encontrado. Atualize a página.',
  quantidade_invalida: 'Informe uma quantidade maior que zero.',
  estoque_insuficiente: 'Não há estoque suficiente desse produto.',
  preco_invalido: 'Informe o preço da venda (ou cadastre o preço de venda do produto).',
  vendedor_obrigatorio: 'Escolha o vendedor.',
  vendedor_invalido: 'Vendedor não encontrado ou desativado.',
  venda_nao_encontrada: 'Venda não encontrada. Atualize a página.',
  carrinho_vazio: 'Bipe ou escolha pelo menos uma peça.',
  forma_pagamento_invalida: 'Forma de pagamento inválida. Escolha de novo.',
  valor_pago_invalido: 'Valor pago inválido: tem de ser maior que zero e não passar do total.',
  em_aberto_sem_cliente: 'Para deixar valor em aberto, escolha o cliente da compra.',
  valor_maior_que_em_aberto: 'O valor é maior do que o cliente tem em aberto.',
  venda_com_valor_em_aberto: 'Esta venda tem valor em aberto: as peças não podem ser alteradas. Desfaça e lance de novo.',
  venda_sem_pecas: 'Para tirar todas as peças, use "Desfazer" na venda.',
  venda_com_recebimento: 'Esta venda já teve pagamento do valor em aberto; não dá para desfazer.',
  cliente_loja_nao_encontrado: 'Cliente não encontrado. Escolha ou cadastre de novo.',
  condicional_nao_encontrado: 'Condicional não encontrado. Atualize a página.',
  condicional_ja_fechado: 'Este condicional já foi acertado.',
  condicionais_um_aberto_por_cliente: 'Este cliente já está com um condicional em aberto. Acerte o atual primeiro.',
  condicionais_prazo: 'A data de devolução não pode ser antes do dia em que pegou.',
  carrinho_grande_demais: 'Carrinho grande demais: divida em duas vendas.',
  vendedores_nome_unico: 'Já existe um vendedor com esse nome.',
  produtos_codigo_unico: 'Já existe um produto com esse código.',
  conta_existente_senha_errada:'Este e-mail já tem conta. Use a mesma senha dela para criar a empresa.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme o e-mail antes de entrar (veja sua caixa de entrada).',
  'rate limit': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  'For security purposes': 'Por segurança, aguarde alguns segundos antes de pedir de novo.',
  'should be different': 'A senha nova precisa ser diferente da atual.',
  'Failed to fetch': 'Sem conexão com o servidor. Confira sua internet.',
}

// Erros de venda que dizem QUAL produto (o banco manda o nome em `details`).
const COM_PRODUTO = {
  estoque_insuficiente: (nome) => `Não há estoque suficiente de ${nome}.`,
  preco_invalido: (nome) => `Informe o preço de ${nome}.`,
  quantidade_invalida: (nome) => `Quantidade inválida em ${nome}.`,
  cliente_ja_tem_condicional: (nome) => `${nome} já está com um condicional em aberto. Acerte o atual antes de levar peças de novo.`,
}

export function traduzirErro(erro) {
  const texto = erro?.message ?? String(erro ?? '')
  const comProduto = Object.keys(COM_PRODUTO).find((k) => texto.includes(k))
  if (comProduto && erro?.details) return COM_PRODUTO[comProduto](erro.details)
  const chave = Object.keys(MENSAGENS).find((k) => texto.includes(k))
  if (chave) return MENSAGENS[chave]
  if (/password/i.test(texto)) return 'A senha precisa ter pelo menos 6 caracteres.'
  return 'Não foi possível concluir. Tente de novo.'
}
