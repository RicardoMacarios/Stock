-- Código do produto para bipar na venda: o que o leitor (pistola USB/Bluetooth
-- ou câmera) lê da etiqueta — código de barras (EAN) ou conteúdo do QR Code.
-- Único dentro do cliente; dois clientes podem ter o mesmo código.

alter table public.produtos
  add column codigo text,
  add constraint produtos_codigo_formato check (codigo is null or (codigo = btrim(codigo) and length(codigo) between 1 and 120));

create unique index produtos_codigo_unico on public.produtos(cliente_id, codigo) where codigo is not null;
