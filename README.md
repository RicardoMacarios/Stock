# Stock

Sistema de controle de estoque multi-cliente: uma base única, e cada cliente
acessa pelo próprio slug (`/nome-do-cliente`), com personalizações isoladas
quando precisar. Ver [docs/CLIENTES.md](docs/CLIENTES.md).

## Tecnologias

- **Frontend:** React, Vite, Tailwind CSS, React Router (em `frontend/`)
- **Banco e autenticação:** Supabase (estrutura em `supabase/`)
- **Hospedagem:** Vercel, com *Root Directory* `frontend`

## Estrutura

```
design/                    logos e arquivos de marca
docs/                      documentação (CLIENTES.md: como funciona o slug)
DESIGN.md                  regras do visual
supabase/                  migrations e schema do banco
frontend/
  scripts/
    sincronizar-clientes.js  cria a pasta de cada cliente do banco que ainda não tem
    novo-cliente.js          cria a pasta de um cliente na mão
  src/
    config/padrao.js       configuração padrão de todo cliente
    config/modulos.js      módulos (rota + menu) da base
    pages/
      dashboard/           tela inicial do cliente (/:slug)
      login/               login do cliente (/:slug/login)
      cadastro/            cadastro com código de convite (/cadastro)
      admin/               seu painel: gera convites, lista clientes (/admin)
    components/            componentes da base (layout, ui, auth)
    clientes/
      registro.js          junta base + personalização de cada slug
      _modelo/             molde copiado pelo novo-cliente
      demo/                cliente de exemplo, com cada tipo de personalização
      <slug>/              personalização de cada cliente
```

## Rodando localmente

```bash
cd frontend
npm install
npm run dev
```

Sem `.env` já dá para ver a base e o cliente de exemplo em
`http://localhost:5173/demo`. Para ligar o banco, crie `frontend/.env` a partir
do `frontend/.env.example`:

```env
VITE_SUPABASE_URL=https://<id-do-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave anon do painel do Supabase>
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Build de produção em `frontend/dist` |
| `npm run lint` | Verificação do código com ESLint |
| `npm run sincronizar-clientes` | Cria a pasta de todo cliente cadastrado que ainda não tem (precisa de `SUPABASE_SERVICE_ROLE_KEY` no `.env`) |
| `npm run novo-cliente -- "Nome"` | Cria `src/clientes/<slug>/` a partir do molde, na mão |

As mesmas variáveis `VITE_*` precisam estar cadastradas na Vercel. A
`SUPABASE_SERVICE_ROLE_KEY` **não**: ela fica só no seu computador.
