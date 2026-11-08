-- Grown Nearby: Stage 1 schema (Birmingham launch)
-- Paste into Supabase: SQL Editor -> New query -> Run

create table cities (
  id serial primary key,
  name text unique not null,
  postcode_regex text not null,          -- used to check postcodes per city
  active boolean not null default true
);

create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,  -- null only for demo data
  city_id int not null references cities(id),
  name text not null,
  description text,
  postcode text not null,
  created_at timestamptz not null default now()
);

create table delivery_options (
  id serial primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  method text not null check (method in ('collection','seller_delivery','courier')),
  fee_pence int not null default 0 check (fee_pence >= 0),
  courier text check (courier in ('evri','dpd')),
  notes text,
  unique (shop_id, method),
  check ((method = 'courier') = (courier is not null))
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('Veg & fruit','Eggs & dairy','Honey & preserves','Bakes')),
  price_pence int not null check (price_pence > 0),
  unit text not null default 'each',
  is_organic boolean not null default false,
  organic_cert_ref text,                  -- certificate number, checked by you before showing the badge
  is_perishable boolean not null default true,   -- perishable items cannot use courier
  allergens text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index listings_category_idx on listings (category);
create index listings_shop_idx on listings (shop_id);

-- Security rules: everyone can read, only the shop owner can change their own data
alter table cities enable row level security;
alter table shops enable row level security;
alter table delivery_options enable row level security;
alter table listings enable row level security;

create policy "cities readable" on cities for select using (true);

create policy "shops readable" on shops for select using (true);
create policy "owner adds shop" on shops for insert with check (auth.uid() = owner_id);
create policy "owner edits shop" on shops for update using (auth.uid() = owner_id);
create policy "owner deletes shop" on shops for delete using (auth.uid() = owner_id);

create policy "delivery readable" on delivery_options for select using (true);
create policy "owner manages delivery" on delivery_options for all
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

create policy "active listings readable" on listings for select
  using (active or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "owner manages listings" on listings for all
  using (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- Launch city
insert into cities (name, postcode_regex)
values ('Birmingham', '^B[0-9]{1,2}[A-Z]? ?[0-9][A-Z]{2}$');

-- Demo data (made-up sellers) so the pages have something to show
do $$
declare c int; s1 uuid; s2 uuid; s3 uuid;
begin
  select id into c from cities where name = 'Birmingham';

  insert into shops (city_id, name, description, postcode)
  values (c, 'Hill Top Hens', 'A small flock on the edge of Kings Heath. Eggs laid this week.', 'B14 7AA') returning id into s1;
  insert into shops (city_id, name, description, postcode)
  values (c, 'Allotment 14', 'Organic veg and herbs from a Moseley allotment.', 'B13 8BB') returning id into s2;
  insert into shops (city_id, name, description, postcode)
  values (c, 'Canalside Bees', 'Raw honey and preserves made in Digbeth.', 'B5 5CC') returning id into s3;

  insert into delivery_options (shop_id, method, fee_pence, notes) values
    (s1, 'collection', 0, 'Collect Saturdays 10am to 2pm'),
    (s1, 'seller_delivery', 250, 'Delivered within 3 miles on Sundays'),
    (s2, 'collection', 0, 'Collect Wednesdays and Saturdays'),
    (s3, 'collection', 0, 'Collect any weekday evening'),
    (s3, 'seller_delivery', 300, 'Delivered across Birmingham on Fridays');
  insert into delivery_options (shop_id, method, fee_pence, courier, notes) values
    (s3, 'courier', 395, 'evri', 'Posted within 2 working days');

  insert into listings (shop_id, title, description, category, price_pence, unit, is_organic, is_perishable, allergens) values
    (s1, 'Free-range eggs, 12', 'Laid this week by our flock of 20 hens.', 'Eggs & dairy', 380, 'per dozen', false, true, 'Egg'),
    (s2, 'Mixed veg box', 'Seasonal carrots, leeks, kale and potatoes.', 'Veg & fruit', 1200, 'per box', true, true, 'None'),
    (s2, 'Herb bundle', 'Parsley, thyme and mint, cut fresh.', 'Veg & fruit', 200, 'per bunch', true, true, 'None'),
    (s3, 'Wildflower honey', 'Raw honey from hives along the canal.', 'Honey & preserves', 700, 'per 340g jar', false, false, 'None'),
    (s3, 'Strawberry jam', 'Small-batch jam made with our own strawberries.', 'Honey & preserves', 400, 'per 227g jar', false, false, 'None');
end $$;
