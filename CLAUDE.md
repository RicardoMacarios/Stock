# Stock — regras do projeto

Sistema multi-cliente: uma base única, cada cliente acessa pelo próprio slug
(`/mercado-do-ze`). Detalhes em [docs/CLIENTES.md](docs/CLIENTES.md);
pendências em [docs/PROXIMOS-PASSOS.md](docs/PROXIMOS-PASSOS.md).

## Onde fica cada personalização (padrão do projeto)

| O quê | Onde | Quem muda |
| --- | --- | --- |
| **Cor, logo e nome** do cliente | **Banco** (`clientes.cor_primaria`, `logo_url`, `nome`) | O próprio cliente (dono), em Configurações. Vale na hora, sem deploy |
| **Todo o resto** que for só de um cliente: botão diferente, aba nova, tela modificada, textos, regras | **Código**, em `frontend/src/clientes/<slug>/` | O desenvolvedor, com deploy |
| O que vale para **todos** os clientes | **Base**: `frontend/src/pages`, `src/components`, `src/config` | O desenvolvedor. Chega em todo cliente, menos em quem tem a própria versão daquela tela na pasta |

Ao implementar um pedido de cliente:

- Pedido de **um cliente só** → mexa só em `src/clientes/<slug>/`. Nunca na base.
- **Nada além de cor, logo e nome vai para o banco** como personalização, a não
  ser que o usuário peça explicitamente.
- Tela de cliente **estende** a da base (`import Base from '@/pages/...'` +
  `<Base>…</Base>`); copiar a tela inteira só quando não houver outro jeito.
- Se dois clientes pedirem a mesma coisa, ela vira opção da base
  (`src/config/padrao.js`) e cada um liga no próprio `config.js`.
- `slug` não muda depois de criado: a URL e a pasta dependem dele.

## Estrutura

- `frontend/src/pages/<pasta>/` — uma pasta por tela (`dashboard`, `login`,
  `cadastro`, `admin`, `configuracoes`).
- Cliente novo nasce pelo convite (`/admin` → código → `/cadastro`); a pasta
  dele vem do `npm run sincronizar-clientes`.
- Banco: migration nova em `supabase/migrations/` no mesmo commit do código
  que depende dela. Isolamento de dados é por RLS (`cliente_id` + `eh_membro`).

## Convenções

- Código, comentários, commits e docs em português.
- React + Vite + Tailwind 4, JavaScript sem TypeScript.
- Antes de commitar: `npm run lint` e `npm run build` em `frontend/`.
