# Banco (Supabase)

| Caminho | Papel |
| --- | --- |
| `migrations/` | Alterações em ordem, no padrão da CLI: `YYYYMMDDHHMMSS_descricao.sql` (UTC) |
| `schema.sql` | Retrato completo do schema atual, gerado depois de cada migration aplicada |
| `rollback/` | Script de volta de cada migration, mesmo nome com `.down.sql` |

## A regra

**Alteração no banco entra no mesmo commit que o código que depende dela.**

1. SQL novo em `migrations/`.
2. Aplique no projeto.
3. Regenere `schema.sql`.
4. Commite migration + `schema.sql` + frontend juntos.

Alteração feita pelo painel vira arquivo **no mesmo dia**. Arquivo de migration
não prova que foi aplicada; confira com:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

## Multi-cliente

- `clientes` — um registro por cliente, identificado pelo `slug` da URL.
- `cliente_membros` — quem acessa qual cliente.
- `convites` — códigos únicos que expiram; `criar_cliente_com_convite` cria
  cliente + dono e queima o código numa transação só.
- `plataforma_admins` — quem entra em `/admin` (só pelo SQL Editor).
- Toda tabela de negócio tem `cliente_id` + policy com `public.eh_membro(cliente_id)`
  (copie o molde de `produtos`).
- A personalização de cada cliente **não** fica no banco: fica em
  `frontend/src/clientes/<slug>/`. Ver [docs/CLIENTES.md](../docs/CLIENTES.md).

## Ambiente novo

1. Crie o projeto no Supabase.
2. Aplique as migrations em ordem (ou `schema.sql`, quando existir).
3. Crie seu usuário (Authentication → Users) e torne-se admin:

   ```sql
   insert into public.plataforma_admins (user_id) values ('<seu auth.users.id>');
   ```

4. Preencha `frontend/.env` com URL e anon key, entre em `/admin` e gere o
   primeiro convite.

**Confirm email:** com a confirmação de e-mail ligada no Supabase, o cliente
precisa confirmar antes de terminar o cadastro (a tela explica e ele volta com
o mesmo código). Desligada, termina na hora.

**Nunca rode `supabase db push`** sem conferir o que o banco já registra.
