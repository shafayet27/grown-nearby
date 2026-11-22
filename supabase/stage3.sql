-- Grown Nearby: Stage 3 (basket, checkout, orders; test mode, no payments yet)
-- Run once in Supabase: SQL Editor -> New query -> paste all -> Run

-- 1. Orders: one order per seller ---------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity (start with 1001),
  buyer_id uuid not null references auth.users(id),
  shop_id uuid not null references shops(id),
  status text not null default 'placed'
    check (status in ('placed','confirmed','ready','completed','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded')),   -- used from the payments stage
  delivery_method text not null check (delivery_method in ('collection','seller_delivery','courier')),
  courier text check (courier in ('evri','dpd')),
  delivery_fee_pence int not null default 0,
  subtotal_pence int not null default 0,
  total_pence int not null default 0,
  buyer_name text not null,
  buyer_phone text not null,
  delivery_address text,
  delivery_postcode text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id serial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  title text not null,          -- copied at the time of ordering, so later edits don't change old orders
  unit text not null,
  price_pence int not null,
  quantity int not null check (quantity between 1 and 20)
);

create index orders_buyer_idx on orders (buyer_id);
create index orders_shop_idx on orders (shop_id);
create index order_items_order_idx on order_items (order_id);

-- 2. Who can see orders: the buyer, the seller, and admins. Nobody writes directly.
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "buyer or seller reads orders" on orders for select using (
  buyer_id = auth.uid()
  or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
  or is_admin()
);
create policy "reads order items" on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid()
           or exists (select 1 from shops s where s.id = o.shop_id and s.owner_id = auth.uid())
           or is_admin())
  )
);

revoke all on orders, order_items from anon, authenticated;
grant select on orders, order_items to authenticated;

-- 3. Place orders: checks everything again on the server, using the real prices ------
create or replace function place_orders(
  p_name text, p_phone text, p_address text, p_postcode text, p_note text, p_groups jsonb
) returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g jsonb;
  it jsonb;
  v_shop uuid;
  v_method text;
  v_opt delivery_options%rowtype;
  v_l listings%rowtype;
  v_order uuid;
  v_orders uuid[] := '{}';
  v_sub int;
  v_qty int;
  v_perish boolean;
  v_pc text := null;
  v_needs_addr boolean := false;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 or jsonb_array_length(p_groups) > 10 then
    raise exception 'Your basket is empty.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Please enter your name.'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Please enter a phone number the seller can reach you on.';
  end if;

  for g in select * from jsonb_array_elements(p_groups) loop
    if coalesce(g->>'method', '') <> 'collection' then v_needs_addr := true; end if;
  end loop;

  if v_needs_addr then
    if length(trim(coalesce(p_address, ''))) < 5 then raise exception 'Please enter your delivery address.'; end if;
    v_pc := upper(replace(trim(coalesce(p_postcode, '')), ' ', ''));
    v_pc := regexp_replace(v_pc, '^(.*)(...)$', '\1 \2');
    if not exists (select 1 from cities where active and v_pc ~ postcode_regex) then
      raise exception 'We only deliver within Birmingham for now. Please enter a Birmingham postcode.';
    end if;
  end if;

  for g in select * from jsonb_array_elements(p_groups) loop
    v_shop := (g->>'shop_id')::uuid;
    v_method := g->>'method';

    if v_method not in ('collection', 'seller_delivery', 'courier') then
      raise exception 'Please choose how you want to get each order.';
    end if;
    if jsonb_typeof(g->'items') <> 'array' or jsonb_array_length(g->'items') = 0 or jsonb_array_length(g->'items') > 30 then
      raise exception 'Your basket is empty.';
    end if;
    if not exists (select 1 from shops where id = v_shop) then
      raise exception 'One of the sellers is no longer available.';
    end if;
    if exists (select 1 from shops where id = v_shop and owner_id = v_uid) then
      raise exception 'You can''t order from your own shop.';
    end if;

    select * into v_opt from delivery_options where shop_id = v_shop and method = v_method;
    if not found then raise exception 'That delivery option isn''t available from this seller.'; end if;

    insert into orders (buyer_id, shop_id, delivery_method, courier, delivery_fee_pence,
                        buyer_name, buyer_phone, delivery_address, delivery_postcode, note)
    values (v_uid, v_shop, v_method, v_opt.courier, v_opt.fee_pence,
            trim(p_name), trim(p_phone),
            case when v_method = 'collection' then null else trim(p_address) end,
            case when v_method = 'collection' then null else v_pc end,
            nullif(trim(coalesce(p_note, '')), ''))
    returning id into v_order;

    v_sub := 0;
    v_perish := false;
    for it in select * from jsonb_array_elements(g->'items') loop
      v_qty := (it->>'quantity')::int;
      if v_qty < 1 or v_qty > 20 then raise exception 'Quantities must be between 1 and 20.'; end if;

      select * into v_l from listings
      where id = (it->>'listing_id')::uuid and shop_id = v_shop and active and status = 'approved';
      if not found then
        raise exception 'An item in your basket is no longer available. Please check your basket.';
      end if;

      if v_l.is_perishable then v_perish := true; end if;
      insert into order_items (order_id, listing_id, title, unit, price_pence, quantity)
      values (v_order, v_l.id, v_l.title, v_l.unit, v_l.price_pence, v_qty);
      v_sub := v_sub + v_l.price_pence * v_qty;
    end loop;

    if v_method = 'courier' and v_perish then
      raise exception 'Fresh items can''t be sent by courier. Please choose collection or delivery by the seller.';
    end if;

    update orders set subtotal_pence = v_sub, total_pence = v_sub + v_opt.fee_pence where id = v_order;
    v_orders := v_orders || v_order;
  end loop;

  return v_orders;
end;
$$;
revoke execute on function place_orders(text, text, text, text, text, jsonb) from public, anon;
grant execute on function place_orders(text, text, text, text, text, jsonb) to authenticated;

-- 4. Moving an order along: sellers confirm, prepare and complete; buyers can cancel early ----
create or replace function set_order_status(p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  o orders%rowtype;
  v_buyer boolean;
  v_seller boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select * into o from orders where id = p_order;
  if not found then raise exception 'That order couldn''t be found.'; end if;

  v_buyer := o.buyer_id = auth.uid();
  v_seller := exists (select 1 from shops s where s.id = o.shop_id and s.owner_id = auth.uid());
  if not (v_buyer or v_seller) then raise exception 'That order couldn''t be found.'; end if;
  if p_status not in ('confirmed', 'ready', 'completed', 'cancelled') then raise exception 'Invalid status.'; end if;

  if v_seller then
    if not (
      (o.status = 'placed' and p_status in ('confirmed', 'cancelled'))
      or (o.status = 'confirmed' and p_status in ('ready', 'cancelled'))
      or (o.status = 'ready' and p_status in ('completed', 'cancelled'))
    ) then
      raise exception 'That change isn''t possible for this order.';
    end if;
  else
    if not (o.status = 'placed' and p_status = 'cancelled') then
      raise exception 'You can only cancel an order before the seller confirms it.';
    end if;
  end if;

  update orders set status = p_status, updated_at = now() where id = p_order;
end;
$$;
revoke execute on function set_order_status(uuid, text) from public, anon;
grant execute on function set_order_status(uuid, text) to authenticated;
