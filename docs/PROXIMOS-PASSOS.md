# Onde este projeto está — 10 de novembro de 2026

Estrutura montada: base única, cliente por slug (`/mercado-do-ze`), personalização
em `frontend/src/clientes/<slug>/`, cadastro por código de convite e painel
`/admin`. Build e lint passando. **Nada testado com banco ainda: o Supabase não
foi criado.** Nada commitado.

Sem banco, dá para ver a base em modo de teste: `cd frontend && npm run dev` →
`http://localhost:5173/demo` (sem login nem convite).

---

## Falta para funcionar

### 1. Criar o Supabase

Duas opções:

- **Pedir ao Claude** para criar pelo conector do Supabase (região `sa-east-1`,
  ele mostra o custo antes e aplica as migrations), **ou**
- **Fazer pelo site:**
  1. supabase.com → **New project** → nome `stock`, região South America (São
     Paulo). Anote a senha do banco.
  2. **SQL Editor** → rode, nesta ordem:
     - `supabase/migrations/20261109233000_clientes_por_slug.sql`
     - `supabase/migrations/20261110000000_convites.sql`
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

1. `npm run dev` → `/admin` → entrar → **Gerar código**.
2. Abrir o link copiado (`/cadastro?codigo=...`) numa aba anônima e cadastrar
   uma empresa de teste.
3. Conferir que caiu em `/<slug>` já logado.
4. `npm run sincronizar-clientes` → conferir que a pasta
   `src/clientes/<slug>/` apareceu.
5. Abrir a URL de um cliente com outra conta → deve dizer "sem acesso".

Decidir: **Confirm email** ligado ou desligado no Supabase (Authentication →
Providers → Email). Ligado, o cliente confirma o e-mail e volta com o mesmo
código para terminar.

### 4. Publicar

- Commitar e subir para o GitHub.
- Vercel: novo projeto, *Root Directory* `frontend`, variáveis
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a service role **não**).
- No Supabase, **Authentication → URL Configuration**: colocar o domínio da
  Vercel em *Site URL* (senão o link de confirmação de e-mail aponta para
  localhost).

---

## Pendências conhecidas

- A tabela `produtos` existe na migration, mas não tem tela. Tirar se não for usar.
- O admin ainda não suspende nem reativa cliente pela tela (hoje: `update
  public.clientes set ativo = false where slug = '...'` no SQL Editor).
- Não há "esqueci minha senha" nem convite de mais usuários para o mesmo
  cliente (hoje: criar o usuário no Supabase e inserir em `cliente_membros`).
- Depois de aplicar as migrations, gerar `supabase/schema.sql`.
