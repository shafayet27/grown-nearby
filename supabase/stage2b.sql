-- Grown Nearby: Stage 2b (listings, photos, approval)
-- Run once in Supabase: SQL Editor -> New query -> paste all -> Run

-- 1. Admins (people who can approve listings) ---------------------------------
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;
create policy "admins see themselves" on admins for select using (user_id = auth.uid());

-- Anyone may ask "am I an admin?". The answer only ever concerns the person asking.
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;
grant execute on function is_admin() to anon, authenticated;

-- 2. Approval columns on listings ---------------------------------------------
alter table listings
  add column status text not null default 'pending' check (status in ('pending','approved','rejected')),
  add column organic_verified boolean not null default false,
  add column review_note text,
  add column reviewed_at timestamptz;

-- Your demo listings count as already reviewed
update listings set status = 'approved', organic_verified = is_organic;

-- 3. Who can see which listings -----------------------------------------------
drop policy "active listings readable" on listings;
create policy "listings readable" on listings for select using (
  (active and status = 'approved')
  or exists (select 1 from shops s where s.id = shop_id and s.owner_id = auth.uid())
  or is_admin()
);

-- 4. Sellers can never change approval fields themselves ----------------------
revoke insert, update on listings from anon, authenticated;
grant insert (shop_id, title, description, category, price_pence, unit, is_organic,
              organic_cert_ref, is_perishable, allergens, active) on listings to authenticated;
grant update (title, description, category, price_pence, unit, is_organic,
              organic_cert_ref, is_perishable, allergens, active) on listings to authenticated;

-- If a seller changes what buyers rely on, the listing goes back for approval
create or replace function listings_reset_review() returns trigger
language plpgsql set search_path = public
as $$
begin
  if is_admin() then return new; end if;
  if (new.title, new.description, new.category, new.allergens, new.is_perishable, new.is_organic, new.organic_cert_ref)
     is distinct from
     (old.title, old.description, old.category, old.allergens, old.is_perishable, old.is_organic, old.organic_cert_ref)
  then
    new.status := 'pending';
    new.organic_verified := false;
    new.review_note := null;
  end if;
  return new;
end;
$$;
create trigger listings_reset_review before update on listings
  for each row execute function listings_reset_review();

-- A new photo on an approved listing also sends it back for approval
create or replace function images_reset_review() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if is_admin() then return new; end if;
  update listings set status = 'pending' where id = new.listing_id and status = 'approved';
  return new;
end;
$$;
create trigger images_reset_review after insert on listing_images
  for each row execute function images_reset_review();

-- 5. The approve / reject step (admins only) ----------------------------------
create or replace function review_listing(
  p_listing uuid, p_status text, p_note text, p_organic_verified boolean
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Not allowed.'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status.'; end if;
  update listings set
    status = p_status,
    review_note = nullif(trim(p_note), ''),
    reviewed_at = now(),
    organic_verified = (p_status = 'approved' and is_organic and coalesce(p_organic_verified, false))
  where id = p_listing;
end;
$$;
revoke execute on function review_listing(uuid, text, text, boolean) from public, anon;
grant execute on function review_listing(uuid, text, text, boolean) to authenticated;

-- 6. Photo storage -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Each seller can only use their own folder: <their user id>/<listing id>/<file>
create policy "sellers upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers see own photos" on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 7. Make yourself an admin (edit the email, then run this line on its own) ----
-- insert into admins (user_id) select id from auth.users where email = 'your-email@example.com';
