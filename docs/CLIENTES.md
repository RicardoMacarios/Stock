# Clientes por slug

Um código e um banco para todos os clientes. Cada cliente tem um **slug**
(`/mercado-do-ze`) e, **se quiser algo diferente**, uma pasta própria em
`frontend/src/clientes/<slug>/`. O que estiver nessa pasta vale só para ele;
o resto vem da base.

## A regra: banco × código

| O quê | Onde | Quem muda |
| --- | --- | --- |
| **Cor, logo e nome** | Banco | O próprio cliente, em Configurações (na hora, sem deploy) |
| **Todo o resto** só daquele cliente (botão, aba nova, tela, textos, regras) | `src/clientes/<slug>/` | Você, em código |
| O que vale para **todos** | Base: `src/pages`, `src/components`, `src/config` | Você, em código |

## Cliente novo (convite)

1. Em `/admin`, em **Convites**, anote *para quem* (opcional), escolha quanto
   tempo **vale** (5 min, 30 min ou 4 horas) e clique **Gerar convite**. Sai
   um código único (`K7Q2-M9XA`) que vale para um cadastro só; o link
   `/cadastro?codigo=...` vai copiado, e a lista mostra a contagem regressiva,
   quem usou e qual cliente virou.
   - O endereço sai do nome que o cliente digitar (Mercado do Zé →
     `mercado-do-ze`; se já existir, `-2`). Para fixar um endereço, a RPC
     `gerar_convite` aceita `p_slug` (sem campo na tela por enquanto).
2. Mande o link para o cliente (o botão **WhatsApp** já abre a conversa com o
   link pronto). Ele informa o nome da empresa, e-mail e senha.
3. O banco confere o código e, de uma vez, cria a conta, o cliente com o slug
   (**a URL já funciona**), o vínculo dele como dono e queima o código.
4. No seu computador:

   ```bash
   cd frontend
   npm run sincronizar-clientes     # cria src/clientes/mercado-do-ze/ (e de quem mais faltar)
   ```

   A pasta só é necessária quando for personalizar; sem ela o cliente usa 100%
   a base.

Sem convite (você mesmo cria): `npm run novo-cliente -- "Mercado do Zé"` e o
`insert` que ele imprime.

## O que dá para mudar, do mais leve ao mais pesado

| Quero… | Onde | Exemplo |
| --- | --- | --- |
| Nome, cor, logo | **o próprio cliente**, em Configurações (`/<slug>/configuracoes`) | fica no banco e vale na hora, sem deploy |
| Trocar um texto | `config.js` → `textos` | `textos: { nomeProdutoPlural: 'Itens' }` |
| Desligar um módulo | `config.js` → `modulos` | `modulos: { produtos: false }` (some do menu e da rota) |
| Mudar uma regra | `config.js` → `regras` | `regras: { estoqueMinimoPadrao: 20 }` |
| Acrescentar algo numa tela (ex.: um botão) | `paginas/<MesmoNome>.jsx` estendendo a base | ver `clientes/_modelo/paginas/LEIA-ME.md` |
| Trocar uma tela inteira | `paginas/<MesmoNome>.jsx` | arquivo com o mesmo nome da página em `src/pages/**` |
| Trocar um componente (até o layout) | `componentes/<MesmoNome>.jsx` | `componentes/ClienteLayout.jsx` |
| Aba nova que só ele tem | `paginas/X.jsx` + `config.js` → `rotasExtras` | `clientes/demo/paginas/ValidadePage.jsx` |
| CSS específico | `estilo.css` | carregado só enquanto o cliente está na tela |

`config.js` declara **só a diferença**: o que não estiver nele continua
seguindo `src/config/padrao.js`, inclusive quando a base mudar. Objetos se
fundem chave a chave; arrays e valores simples são substituídos inteiros.

## Regras para a base não virar várias

1. **Prefira config a código.** Se dois clientes querem a mesma variação, ela
   vira uma chave em `padrao.js` (com o valor neutro) e cada um liga no seu
   `config.js`.
2. **Estenda, não copie.** Uma página copiada para a pasta do cliente para de
   receber correções da base. Importe a base e envolva-a; copie só quando não
   tiver jeito.
3. **Nomes de página e componente são únicos na base.** É pelo nome do arquivo
   que a troca acontece; o build falha se houver dois iguais.
4. **Rota fixa nova** (fora de `/:slug`) entra em `SLUGS_RESERVADOS`
   (`src/utils/slug.js`) e em `public.slug_reservado` no banco.
5. **Dado é isolado pelo banco**, não pela pasta: toda tabela tem `cliente_id`
   e policy com `eh_membro(cliente_id)`.

## Como funciona (para manutenção)

- `src/clientes/registro.js` descobre tudo por `import.meta.glob` no build:
  configs, páginas, componentes e estilos de cada pasta. `_modelo` é ignorada.
- `App.jsx` → `/:slug/*` → `ClienteProvider` resolve o slug no banco
  (`cliente_por_slug`) e monta a config: `padrao` < `config.js` do cliente <
  banco (nome, cor e logo que o dono salvou em Configurações).
- As telas são renderizadas por `<Pagina nome="X" />` e
  `<Componente nome="X" />`, que escolhem a versão do cliente ou a da base.
  Cada página vira um chunk separado: o código de um cliente não pesa para os
  outros.
- Sem `frontend/.env`, o app abre qualquer slug que tenha pasta, sem login,
  para dar para desenvolver a personalização antes do banco existir.
