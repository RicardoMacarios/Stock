# Onde este projeto está — 10 de novembro de 2026

Estrutura montada: base única, cliente por slug (`/mercado-do-ze`), personalização
em `frontend/src/clientes/<slug>/`, cadastro por convite e painel `/admin`.

Módulos de cada loja (menu): **Dashboard** (vendas do dia, gráfico por vendedor,
estoque), **Vendas** (caixa com carrinho e leitor de código), **Condicional**
(peças para provar em casa, com acerto), **Clientes** (cadastro e ficha),
**Produtos** e **Configurações** (aparência e vendedores).

**Supabase criado** (projeto `Stock`, `sa-east-1`) com todas as migrations de
`supabase/migrations/` aplicadas. Loja de teste: `/estoque-teste`, com dados de
exemplo. Tudo no GitHub (`RicardoMacarios/Stock`, branch `main`).

A regra de onde fica cada personalização está no [CLAUDE.md](../CLAUDE.md):
cor, logo e nome no banco; o resto é código em `src/clientes/<slug>/`.

Sem banco, dá para ver a base em modo de teste: `cd frontend && npm run dev` →
`http://localhost:5173/demo` (sem login nem convite).

---

## Falta para funcionar

### 1. Criar o Supabase

Duas opções:

- **Pedir ao Claude** para criar pelo conector do Supabase (região `sa-east-1`,
  ele mostra o custo antes e aplica as migrations, que também criam o bucket
  `logos`), **ou**
- **Fazer pelo site:**
  1. supabase.com → **New project** → nome `stock`, região South America (São
     Paulo). Anote a senha do banco.
  2. **SQL Editor** → rode **todos** os arquivos de `supabase/migrations/`, na
     ordem do nome (a data no começo).
  3. **Authentication → Users → Add user** → crie seu usuário, copie o ID e rode:
     ```sql
     insert into public.plataforma_admins (user_id) values ('<seu id>');
     ```

### 2. Preencher `frontend/.env`

Copie de `frontend/.env.example`. Valores em **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://<id>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave anon>
SUPABASE_SERVICE_ROLE_KEY=<chave service_role>   # só no seu computador, NUNCA na Vercel
```

### 3. Testar o fluxo completo

1. `npm run dev` → `/login` → entrar (o admin cai no `/admin`) → **Gerar convite** (vale 5 min por padrão).
2. Abrir o link copiado (`/cadastro?codigo=...`) numa aba anônima e cadastrar
   uma empresa de teste.
3. Conferir que caiu em `/<slug>` já logado.
4. `npm run sincronizar-clientes` → conferir que a pasta
   `src/clientes/<slug>/` apareceu.
5. Abrir a URL de um cliente com outra conta → deve dizer "sem acesso".
6. Como dono, em **Configurações**, trocar nome, cor e logo → deve mudar na hora,
   inclusive na tela de login daquele cliente.

Decidir: **Confirm email** ligado ou desligado no Supabase (Authentication →
Providers → Email). Ligado, o cliente confirma o e-mail e volta com o mesmo
código para terminar.

**Esqueci a senha:** em Authentication → URL Configuration, coloque em
**Redirect URLs** `http://localhost:5173/redefinir-senha` e, quando publicar,
`https://<seu-dominio>/redefinir-senha`. Sem isso o link do e-mail não volta
para o sistema. No plano grátis, o e-mail padrão do Supabase manda poucos por
hora; para produção, configure um SMTP próprio (Authentication → Emails → SMTP).

### 4. Publicar

- Commitar e subir para o GitHub.
- Vercel: novo projeto, *Root Directory* `frontend`, variáveis
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a service role **não**).
- No Supabase, **Authentication → URL Configuration**: colocar o domínio da
  Vercel em *Site URL* (senão o link de confirmação de e-mail aponta para
  localhost).

---

## Pendências conhecidas

- O admin ainda não suspende nem reativa cliente pela tela (hoje: `update
  public.clientes set ativo = false where slug = '...'` no SQL Editor).
- Não há convite de mais usuários para a mesma loja: vendedores são só nomes
  (sem login). Para entrar de outro aparelho, usa-se a conta do dono.
- Financeiro (semana, mês, totais) ainda não existe: o dashboard mostra um dia
  por vez.
- A câmera para ler código só funciona em https (ou localhost).
- Depois de aplicar as migrations, gerar `supabase/schema.sql`.

---

## Como continuar o desenvolvimento

Receitas para o dia a dia. A explicação completa está em [CLIENTES.md](CLIENTES.md).

### Criar uma tela nova para TODOS os clientes

1. Crie a pasta e o arquivo: `frontend/src/pages/produtos/ProdutosPage.jsx`.
   O nome do arquivo precisa ser único em `src/pages`.
2. Se algum cliente puder querer acrescentar algo nela, receba `children` e
   renderize `{children}` onde o acréscimo deve aparecer (veja `DashboardPage`).
3. Registre em `frontend/src/config/modulos.js`:
   ```js
   { chave: 'produtos', caminho: 'produtos', pagina: 'ProdutosPage', rotulo: 'Produtos', icone: 'Package' },
   ```
4. Ícone novo: importe do `lucide-react` e adicione em `ICONES` no
   `src/components/layout/ClienteLayout.jsx`.
5. Precisa de tabela? Migration nova em `supabase/migrations/` com `cliente_id`
   e a policy `eh_membro(cliente_id)` (copie o molde de `produtos` na primeira
   migration).

### Personalizar para UM cliente só

Tudo dentro de `frontend/src/clientes/<slug>/`. Nunca mexa na base para isso.

- **Botão ou bloco a mais numa tela:** crie `paginas/<MesmoNomeDaTela>.jsx`:
  ```jsx
  import Base from '@/pages/dashboard/DashboardPage'

  export default function DashboardPage() {
    return (
      <Base>
        <button>Botão só deste cliente</button>
      </Base>
    )
  }
  ```
- **Aba nova só dele:** crie `paginas/RelatorioPage.jsx` e ligue no `config.js`:
  ```js
  rotasExtras: [{ caminho: 'relatorio', pagina: 'RelatorioPage', rotulo: 'Relatório', icone: 'FileText' }],
  ```
- **Esconder um módulo da base:** no `config.js`, `modulos: { produtos: false }`.
- **Trocar uma tela inteira:** `paginas/<MesmoNome>.jsx` sem importar a base
  (essa tela para de receber as correções da base).
- **Trocar um componente** (até o menu lateral): `componentes/<MesmoNome>.jsx`,
  ex.: `componentes/ClienteLayout.jsx`.
- **CSS só dele:** `estilo.css` na pasta.
- **Cor, logo e nome:** não é código, o próprio cliente muda em Configurações.

### Dois clientes pediram a mesma coisa

Vira opção da base: adicione a chave em `src/config/padrao.js` com o valor
desligado, faça a tela da base respeitar essa chave e ligue no `config.js` de
cada cliente que quiser.

### Antes de subir

```bash
cd frontend
npm run lint
npm run build
```

Migration e o código que depende dela vão no **mesmo commit**.
