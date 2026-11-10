// Módulos da base. Cada um vira rota + item de menu dentro de /:slug.
// `chave` é a mesma de `modulos` em config/padrao.js (liga/desliga por cliente).
// `pagina` é o NOME do arquivo em src/pages/** — é por esse nome que um cliente
// substitui a página, criando src/clientes/<slug>/paginas/<pagina>.jsx.
//
// Exemplo:
//   { chave: 'produtos', caminho: 'produtos', pagina: 'ProdutosPage', rotulo: 'Produtos', icone: 'Package' }
//   → tela em src/pages/produtos/ProdutosPage.jsx
//   (caminho '' = tela que abre na raiz do slug)

const modulos = [
  { chave: 'dashboard', caminho: '', pagina: 'DashboardPage', rotulo: 'Dashboard', icone: 'LayoutDashboard' },
  { chave: 'vendas', caminho: 'vendas', pagina: 'VendasPage', rotulo: 'Vendas', icone: 'ShoppingCart' },
  { chave: 'produtos', caminho: 'produtos', pagina: 'ProdutosPage', rotulo: 'Produtos', icone: 'Package' },
  // soDono: some do menu e da rota para quem não é dono (o banco também barra).
  { chave: 'configuracoes', caminho: 'configuracoes', pagina: 'ConfiguracoesPage', rotulo: 'Configurações', icone: 'Settings', soDono: true },
]

export default modulos

// Menu e rotas do cliente: módulos da base ligados para ele + as rotas extras
// que só ele tem (config.rotasExtras, com páginas em src/clientes/<slug>/paginas).
export function itensDeMenu(config, { ehDono = false } = {}) {
  const base = modulos.filter((m) => config.modulos?.[m.chave] !== false && (!m.soDono || ehDono))
  return [...base, ...(config.rotasExtras ?? [])]
}
