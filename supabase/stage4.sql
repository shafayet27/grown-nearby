-- Grown Nearby: Stage 4 (payments with Stripe, commission, seller payouts)
-- Run once in Supabase: SQL Editor -> New query -> paste all -> Run

-- 1. Commission setting (one row). Change it any time with:
--      update platform_settings set commission_percent = 12;
create table platform_settings (
  id int primary key default 1 check (id = 1),
  commission_percent numeric(5,2) not null default 10 check (commission_percent between 0 and 30)
);
insert into platform_settings default values;
alter table platform_settings enable row level security;
create policy "settings readable" on platform_settings for select using (true);

-- 2. Seller payout accounts. Written only by the server, never by the browser.
create table shop_payouts (
  shop_id uuid primary key references shops(id) on delete cascade,
  stripe_account_id text unique,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table shop_payouts enable row level security;
create policy "owner reads payouts" on shop_payouts for select using (
  exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()) or is_admin()
);
revoke all on shop_payouts from anon, authenticated;
grant select on shop_payouts to authenticated;

-- 3. Payment details on orders
alter table orders
  add column payment_group uuid,
  add column commission_percent numeric(5,2) not null default 0,
  add column commission_pence int not null default 0,
  add column seller_amount_pence int not null default 0,
  add column stripe_payment_intent text,
  add column stripe_charge text,
  add column paid_at timestamptz,
  add column payout_status text not null default 'none' check (payout_status in ('none','pending','paid','failed')),
  add column stripe_transfer_id text;
create index orders_group_idx on orders (payment_group);

-- Test orders from the earlier stage were never paid for, so close them
update orders set status = 'cancelled' where payment_status = 'unpaid' and status = 'placed';

-- Sellers only see orders once they are paid
drop policy "buyer or seller reads orders" on orders;
create policy "buyer or seller reads orders" on orders for select using (
  buyer_id = auth.uid()
  or (payment_status = 'paid' and exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()))
  or is_admin()
);

-- 4. Placing orders: now needs sellers who can be paid, and records the commission.
drop function place_orders(text, text, text, text, text, jsonb);
create or replace function place_orders(
  p_name text, p_phone text, p_address text, p_postcode text, p_note text, p_groups jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid := gen_random_uuid();
  v_pct numeric(5,2);
  g jsonb;
  it jsonb;
  v_shop uuid;
  v_method text;
  v_opt delivery_options%rowtype;
  v_l listings%rowtype;
  v_order uuid;
  v_sub int;
  v_comm int;
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

  select commission_percent into v_pct from platform_settings where id = 1;
  v_pct := coalesce(v_pct, 10);

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
    if not exists (select 1 from shop_payouts where shop_id = v_shop and payouts_enabled) then
      raise exception 'One of the sellers in your basket can''t take payments yet. Please try again later.';
    end if;

    select * into v_opt from delivery_options where shop_id = v_shop and method = v_method;
    if not found then raise exception 'That delivery option isn''t available from this seller.'; end if;

    insert into orders (buyer_id, shop_id, delivery_method, courier, delivery_fee_pence, payment_group,
                        buyer_name, buyer_phone, delivery_address, delivery_postcode, note)
    values (v_uid, v_shop, v_method, v_opt.courier, v_opt.fee_pence, v_group,
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

    -- Commission is taken on the items. Delivery fees go to the seller in full.
    v_comm := round(v_sub * v_pct / 100.0)::int;
    update orders set
      subtotal_pence = v_sub,
      total_pence = v_sub + v_opt.fee_pence,
      commission_percent = v_pct,
      commission_pence = v_comm,
      seller_amount_pence = v_sub - v_comm + v_opt.fee_pence
    where id = v_order;
  end loop;

  return v_group;
end;
$$;
revoke execute on function place_orders(text, text, text, text, text, jsonb) from public, anon;
grant execute on function place_orders(text, text, text, text, text, jsonb) to authenticated;

-- 5. Order status changes now go through the server only (money may need to move)
drop function set_order_status(uuid, text);
create or replace function admin_set_order_status(p_order uuid, p_status text, p_actor uuid)
returns orders
language plpgsql security definer set search_path = public
as $$
declare
  o orders%rowtype;
  v_buyer boolean;
  v_seller boolean;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'That order couldn''t be found.'; end if;

  v_buyer := o.buyer_id = p_actor;
  v_seller := exists (select 1 from shops s where s.id = o.shop_id and s.owner_id = p_actor);
  if not (v_buyer or v_seller) then raise exception 'That order couldn''t be found.'; end if;
  if p_status not in ('confirmed', 'ready', 'completed', 'cancelled') then raise exception 'Invalid status.'; end if;

  if o.payment_status = 'unpaid' then
    if not (v_buyer and p_status = 'cancelled' and o.status = 'placed') then
      raise exception 'This order is waiting for payment.';
    end if;
  elsif o.payment_status = 'paid' then
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
  else
    raise exception 'This order can''t be changed.';
  end if;

  update orders set
    status = p_status,
    updated_at = now(),
    payout_status = case when p_status = 'completed' then 'pending' else payout_status end
  where id = p_order
  returning * into o;
  return o;
end;
$$;
revoke execute on function admin_set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function admin_set_order_status(uuid, text, uuid) to service_role;
