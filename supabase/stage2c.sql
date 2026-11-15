-- Grown Nearby: let a seller update their address later
-- Run once in Supabase: SQL Editor -> New query -> paste all -> Run

create or replace function update_shop_address(p_address text, p_postcode text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pc text;
  v_shop uuid;
  v_city int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;

  select id into v_shop from shops where owner_id = auth.uid();
  if v_shop is null then
    raise exception 'You don''t have a shop yet.';
  end if;

  -- Tidy the postcode into the form "B14 7AA"
  v_pc := upper(replace(trim(p_postcode), ' ', ''));
  v_pc := regexp_replace(v_pc, '^(.*)(...)$', '\1 \2');

  select id into v_city
  from cities
  where active and v_pc ~ postcode_regex
  order by id
  limit 1;

  if v_city is null then
    raise exception 'Grown Nearby is only open in Birmingham for now. Please enter a Birmingham postcode.';
  end if;

  update shop_private set address = trim(p_address), postcode = v_pc where shop_id = v_shop;
  update shops set area = split_part(v_pc, ' ', 1), city_id = v_city where id = v_shop;
end;
$$;

revoke execute on function update_shop_address(text, text) from public, anon;
grant execute on function update_shop_address(text, text) to authenticated;
