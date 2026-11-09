# DESIGN

Guia do visual. A fonte da verdade dos valores é
[frontend/src/index.css](frontend/src/index.css); aqui ficam os papéis e as regras.

Só modo escuro por enquanto.

## Tokens

| Token (`@theme`) | Papel |
|---|---|
| `fundo` | fundo de página |
| `card` | card, campo |
| `elevado` | hover |
| `borda` / `borda-forte` | divisória / contorno de controle |
| `texto` / `texto-2` / `texto-3` | primário / secundário / terciário |
| `ok` / `warn` / `danger` | estados |
| `acento` | **cor do cliente**, vem de `--cor-primaria` |
| `sobre-acento` | texto sobre o acento, vem de `--cor-primaria-ink` |

Viram utilitários do Tailwind: `bg-card`, `text-texto-2`, `border-borda`, `bg-acento`…

## Cor do cliente

- Tudo que é acento usa `acento` / `sobre-acento`, **nunca um hex** na tela.
- O valor vem de `tema.corPrimaria` e `tema.corPrimariaInk` no `config.js` do
  cliente (padrão em `src/config/padrao.js`), aplicado por `useTemaDoCliente`.
- Ao definir `corPrimaria` de um cliente, defina também `corPrimariaInk` (texto
  escuro ou claro, o que tiver mais contraste) e confira o contraste WCAG AA.
