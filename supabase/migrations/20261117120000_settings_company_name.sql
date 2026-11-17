-- Nome da empresa (opcional), exibido no cabeçalho dos relatórios em PDF.
alter table public.settings
  add column if not exists company_name text
  check (char_length(company_name) <= 80);
