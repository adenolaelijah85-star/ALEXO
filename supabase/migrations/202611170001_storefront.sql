create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (length(sku) between 2 and 80),
  name text not null check (length(name) between 1 and 200),
  description text not null default '',
  category text not null,
  brand text,
  gender text not null default 'unisex' check (gender in ('women', 'men', 'unisex')),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique check (length(sku) between 2 and 100),
  size text not null,
  color text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_price_minor bigint not null check (unit_price_minor > 0),
  compare_at_price_minor bigint check (compare_at_price_minor is null or compare_at_price_minor > unit_price_minor),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  unique (product_id, sort_order)
);

create table if not exists public.store_shipping_methods (
  code text primary key check (length(code) between 2 and 40),
  label text not null,
  description text not null default '',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor bigint not null check (price_minor >= 0),
  is_active boolean not null default false
);

create table if not exists public.store_settings (
  singleton boolean primary key default true check (singleton),
  store_name text not null,
  support_email text not null,
  country text not null,
  privacy_url text not null,
  terms_url text not null,
  shipping_policy_url text not null,
  returns_policy_url text not null,
  social_urls jsonb not null default '{}'::jsonb,
  checkout_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (privacy_url ~ '^https://'),
  check (terms_url ~ '^https://'),
  check (shipping_policy_url ~ '^https://'),
  check (returns_policy_url ~ '^https://'),
  check (support_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  paystack_reference text not null unique,
  customer_email text not null,
  customer_name text not null,
  customer_phone text not null,
  shipping_address jsonb not null,
  shipping_method text not null references public.store_shipping_methods(code),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint not null check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'payment_review', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_failed')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  access_token_hash text not null,
  reservation_expires_at timestamptz not null default (now() + interval '20 minutes'),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_sku text not null,
  variant_sku text not null,
  product_name text not null,
  size text not null,
  color text not null,
  image_url text not null,
  unit_price_minor bigint not null check (unit_price_minor > 0),
  quantity integer not null check (quantity > 0),
  line_total_minor bigint not null check (line_total_minor > 0)
);

create table if not exists public.checkout_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0)
);

create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists orders_customer_lookup_idx on public.orders(order_number, customer_email);
create index if not exists orders_expired_reservations_idx on public.orders(reservation_expires_at)
  where status = 'pending_payment';

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.store_shipping_methods enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.checkout_rate_limits enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select to anon, authenticated using (is_active);

drop policy if exists "Public can read active variants" on public.product_variants;
create policy "Public can read active variants"
  on public.product_variants for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active
    )
  );

drop policy if exists "Public can read active product images" on public.product_images;
create policy "Public can read active product images"
  on public.product_images for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

drop policy if exists "Public can read active shipping methods" on public.store_shipping_methods;
create policy "Public can read active shipping methods"
  on public.store_shipping_methods for select to anon, authenticated using (is_active);

drop policy if exists "Public can read storefront settings" on public.store_settings;
create policy "Public can read storefront settings"
  on public.store_settings for select to anon, authenticated using (singleton);

create or replace view public.storefront_public_settings
with (security_invoker = true)
as
select store_name, support_email, country, privacy_url, terms_url,
       shipping_policy_url, returns_policy_url, social_urls, checkout_enabled
from public.store_settings
where singleton;

create or replace view public.storefront_catalog
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.name,
  p.description,
  p.category,
  p.brand,
  p.gender,
  p.is_featured,
  p.is_new,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'sku', v.sku,
      'size', v.size,
      'color', v.color,
      'colorHex', v.color_hex,
      'currency', v.currency,
      'priceMinor', v.unit_price_minor,
      'compareAtPriceMinor', v.compare_at_price_minor,
      'stock', v.stock
    ) order by v.size, v.color)
    from public.product_variants v
    where v.product_id = p.id and v.is_active and v.stock > 0
  ), '[]'::jsonb) as variants,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'url', i.image_url,
      'alt', i.alt_text
    ) order by i.sort_order)
    from public.product_images i
    where i.product_id = p.id
  ), '[]'::jsonb) as images
from public.products p
where p.is_active;

create or replace function public.create_store_order(
  p_customer jsonb,
  p_shipping_address jsonb,
  p_shipping_method text,
  p_items jsonb,
  p_access_token_hash text
)
returns table (order_number text, paystack_reference text, amount_minor bigint, currency text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'AD-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 20));
  v_reference text := 'adelix-' || replace(v_order_id::text, '-', '');
  v_shipping public.store_shipping_methods%rowtype;
  v_item jsonb;
  v_variant record;
  v_quantity integer;
  v_currency text;
  v_subtotal bigint := 0;
  v_total bigint;
begin
  if not exists (
    select 1 from public.store_settings s
    where s.singleton
      and s.checkout_enabled
      and s.support_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and s.privacy_url ~ '^https://'
      and s.terms_url ~ '^https://'
      and s.shipping_policy_url ~ '^https://'
      and s.returns_policy_url ~ '^https://'
  ) then
    raise exception 'Store contact, policies, and checkout approval are required before taking orders';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Cart must contain between 1 and 20 items';
  end if;
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid checkout token';
  end if;
  if length(trim(coalesce(p_customer->>'email', ''))) > 254
     or length(trim(coalesce(p_customer->>'name', ''))) not between 2 and 200
     or length(trim(coalesce(p_customer->>'phone', ''))) not between 5 and 40 then
    raise exception 'Customer details are incomplete';
  end if;
  if jsonb_typeof(p_shipping_address) <> 'object'
     or length(trim(coalesce(p_shipping_address->>'address', ''))) not between 3 and 300
     or length(trim(coalesce(p_shipping_address->>'city', ''))) not between 2 and 100
     or length(trim(coalesce(p_shipping_address->>'country', ''))) not between 2 and 100 then
    raise exception 'Shipping address is incomplete';
  end if;

  select * into v_shipping
  from public.store_shipping_methods
  where code = p_shipping_method and is_active
  for share;
  if not found then
    raise exception 'Selected shipping method is unavailable';
  end if;
  v_currency := v_shipping.currency;

  insert into public.orders (
    id, order_number, paystack_reference, customer_email, customer_name,
    customer_phone, shipping_address, shipping_method, currency,
    subtotal_minor, shipping_minor, total_minor, access_token_hash
  ) values (
    v_order_id, v_order_number, v_reference,
    lower(trim(p_customer->>'email')), trim(p_customer->>'name'),
    trim(p_customer->>'phone'), p_shipping_address, v_shipping.code,
    v_currency, 0, v_shipping.price_minor, 1, p_access_token_hash
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'variantSku') or not (v_item ? 'quantity') then
      raise exception 'Each cart item must include variantSku and quantity';
    end if;
    if (v_item->>'quantity') !~ '^[1-9][0-9]{0,2}$' then
      raise exception 'Invalid item quantity';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity > 20 then
      raise exception 'Item quantity exceeds the allowed limit';
    end if;

    select v.id as variant_id, v.sku as variant_sku, v.size, v.color,
           v.currency, v.unit_price_minor, v.stock, p.id as product_id,
           p.sku as product_sku, p.name as product_name,
           coalesce((
             select i.image_url from public.product_images i
             where i.product_id = p.id order by i.sort_order limit 1
           ), '') as image_url
    into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.sku = trim(v_item->>'variantSku')
      and v.is_active and p.is_active
    for update of v;

    if not found then
      raise exception 'A selected product is no longer available';
    end if;
    if v_variant.currency <> v_currency then
      raise exception 'Products and shipping must use the same currency';
    end if;
    if v_variant.stock < v_quantity then
      raise exception 'Not enough stock for %', v_variant.product_name;
    end if;

    update public.product_variants
      set stock = stock - v_quantity
      where id = v_variant.variant_id;
    insert into public.order_items (
      order_id, product_id, variant_id, product_sku, variant_sku,
      product_name, size, color, image_url, unit_price_minor,
      quantity, line_total_minor
    ) values (
      v_order_id, v_variant.product_id, v_variant.variant_id,
      v_variant.product_sku, v_variant.variant_sku, v_variant.product_name,
      v_variant.size, v_variant.color, v_variant.image_url,
      v_variant.unit_price_minor, v_quantity,
      v_variant.unit_price_minor * v_quantity
    );
    v_subtotal := v_subtotal + v_variant.unit_price_minor * v_quantity;
  end loop;

  v_total := v_subtotal + v_shipping.price_minor;
  if v_total <= 0 then
    raise exception 'Order total must be positive';
  end if;
  update public.orders
    set subtotal_minor = v_subtotal, total_minor = v_total
    where id = v_order_id;

  return query select v_order_number, v_reference, v_total, v_currency;
end;
$$;

create or replace function public.get_order_for_payment(
  p_paystack_reference text,
  p_access_token_hash text
)
returns table (id uuid, order_number text, amount_minor bigint, currency text, status text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select o.id, o.order_number, o.total_minor, o.currency, o.status
  from public.orders o
  where o.paystack_reference = p_paystack_reference
    and o.access_token_hash = p_access_token_hash;
$$;

create or replace function public.consume_checkout_attempt(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;
  insert into public.checkout_rate_limits (key_hash, window_started_at, attempts)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
    set window_started_at = case
          when checkout_rate_limits.window_started_at < now() - interval '10 minutes' then now()
          else checkout_rate_limits.window_started_at
        end,
        attempts = case
          when checkout_rate_limits.window_started_at < now() - interval '10 minutes' then 1
          else checkout_rate_limits.attempts + 1
        end
  returning attempts into v_attempts;
  return v_attempts <= 5;
end;
$$;

create or replace function public.mark_order_paid(
  p_paystack_reference text,
  p_amount_minor bigint,
  p_currency text
)
returns table (order_number text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.orders o
    set status = case
          when o.status = 'pending_payment' then 'paid'
          when o.status = 'payment_failed' then 'payment_review'
          else o.status
        end,
        payment_status = 'paid',
        paid_at = coalesce(o.paid_at, now()),
        reservation_expires_at = now()
    where o.paystack_reference = p_paystack_reference
      and o.total_minor = p_amount_minor
      and o.currency = p_currency
      and o.status in ('pending_payment', 'payment_failed', 'paid', 'payment_review', 'processing', 'shipped', 'delivered')
    returning o.order_number, o.status;
  if not found then
    raise exception 'Payment does not match an open order';
  end if;
end;
$$;

create or replace function public.fail_store_order(p_paystack_reference text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_item record;
begin
  update public.orders
    set status = 'payment_failed', payment_status = 'failed'
    where paystack_reference = p_paystack_reference
      and status = 'pending_payment'
    returning id into v_order_id;
  if v_order_id is null then
    return false;
  end if;
  for v_item in
    select variant_id, quantity from public.order_items
    where order_id = v_order_id and variant_id is not null
  loop
    update public.product_variants
      set stock = stock + v_item.quantity
      where id = v_item.variant_id;
  end loop;
  return true;
end;
$$;

create or replace function public.release_expired_order_reservations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_item record;
  v_count integer := 0;
begin
  for v_order in
    update public.orders
      set status = 'payment_failed', payment_status = 'failed'
      where status = 'pending_payment' and reservation_expires_at < now()
      returning id
  loop
    for v_item in
      select variant_id, quantity from public.order_items
      where order_id = v_order.id and variant_id is not null
    loop
      update public.product_variants
        set stock = stock + v_item.quantity
        where id = v_item.variant_id;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.track_store_order(
  p_order_number text,
  p_customer_email text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'createdAt', o.created_at,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'currency', o.currency,
    'totalMinor', o.total_minor,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.product_name,
        'size', i.size,
        'color', i.color,
        'quantity', i.quantity,
        'image', i.image_url
      ) order by i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and lower(o.customer_email) = lower(trim(p_customer_email));
$$;

revoke all on function public.create_store_order(jsonb, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.get_order_for_payment(text, text) from public, anon, authenticated;
revoke all on function public.consume_checkout_attempt(text) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, bigint, text) from public, anon, authenticated;
revoke all on function public.fail_store_order(text) from public, anon, authenticated;
revoke all on function public.release_expired_order_reservations() from public, anon, authenticated;
revoke all on function public.track_store_order(text, text) from public, anon, authenticated;
grant execute on function public.create_store_order(jsonb, jsonb, text, jsonb, text) to service_role;
grant execute on function public.get_order_for_payment(text, text) to service_role;
grant execute on function public.consume_checkout_attempt(text) to service_role;
grant execute on function public.mark_order_paid(text, bigint, text) to service_role;
grant execute on function public.fail_store_order(text) to service_role;
grant execute on function public.release_expired_order_reservations() to service_role;
grant execute on function public.track_store_order(text, text) to service_role;

grant select on public.products, public.product_variants, public.product_images,
  public.store_shipping_methods, public.storefront_catalog,
  public.store_settings, public.storefront_public_settings to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

select cron.schedule(
  'release-expired-store-order-reservations',
  '* * * * *',
  $$select public.release_expired_order_reservations();$$
)
where not exists (
  select 1 from cron.job where jobname = 'release-expired-store-order-reservations'
);

select cron.schedule(
  'clean-old-store-checkout-rate-limits',
  '0 3 * * *',
  $$delete from public.checkout_rate_limits where window_started_at < now() - interval '24 hours';$$
)
where not exists (
  select 1 from cron.job where jobname = 'clean-old-store-checkout-rate-limits'
);
