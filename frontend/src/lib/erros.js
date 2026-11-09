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
  validade_invalida: 'Validade deve ser de 1 a 90 dias.',
  'User already registered': 'Já existe uma conta com este e-mail. Entre com ela e use o código.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme o e-mail antes de entrar (veja sua caixa de entrada).',
}

export function traduzirErro(erro) {
  const texto = erro?.message ?? String(erro ?? '')
  const chave = Object.keys(MENSAGENS).find((k) => texto.includes(k))
  if (chave) return MENSAGENS[chave]
  if (/password/i.test(texto)) return 'A senha precisa ter pelo menos 6 caracteres.'
  return 'Não foi possível concluir. Tente de novo.'
}
