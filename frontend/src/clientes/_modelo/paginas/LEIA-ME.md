# Páginas do cliente

Um arquivo aqui com o **mesmo nome** de uma página da base (`src/pages/**`)
substitui aquela página só para este cliente. Ex.: `DashboardPage.jsx`
(a base é `src/pages/dashboard/DashboardPage.jsx`).

Prefira **estender** a base em vez de copiar — assim correções da base
continuam chegando:

```jsx
import Base from '@/pages/dashboard/DashboardPage'

export default function DashboardPage() {
  return (
    <Base>
      <p>Bloco que só este cliente tem.</p>
    </Base>
  )
}
```

Copie a página inteira só quando a mudança for grande demais para isso.

Página que **não existe** na base (só deste cliente) também fica aqui e é
ligada em `config.js` → `rotasExtras`.
