create or replace function public.admin_create_product(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_sku text;
  v_name text;
  v_description text;
  v_category text;
  v_gender text;
  v_color text;
  v_color_hex text;
  v_price_text text;
  v_stock_text text;
  v_price_minor bigint;
  v_stock integer;
  v_image_url text;
  v_is_new boolean;
  v_is_active boolean;
  v_size_json jsonb;
  v_size text;
  v_variant_sku text;
  v_seen_sizes text[] := array[]::text[];
  v_seen_variant_skus text[] := array[]::text[];
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p is null or pg_catalog.jsonb_typeof(p) is distinct from 'object' then
    raise exception 'Invalid product data' using errcode = '22023';
  end if;

  v_sku := pg_catalog.btrim(coalesce(p ->> 'sku', ''));
  v_name := pg_catalog.btrim(coalesce(p ->> 'name', ''));
  v_description := coalesce(p ->> 'description', '');
  v_category := pg_catalog.btrim(coalesce(p ->> 'category', ''));
  v_gender := pg_catalog.lower(pg_catalog.btrim(coalesce(p ->> 'gender', '')));
  v_color := pg_catalog.btrim(coalesce(p ->> 'color', ''));
  v_color_hex := p ->> 'colorHex';
  v_price_text := p ->> 'priceMinor';
  v_stock_text := p ->> 'stock';
  v_image_url := nullif(pg_catalog.btrim(coalesce(p ->> 'imageUrl', '')), '');

  if pg_catalog.length(v_sku) not between 2 and 60
    or pg_catalog.length(v_name) not between 1 and 200
    or pg_catalog.length(v_description) > 2000
    or pg_catalog.length(v_category) not between 1 and 80
    or v_gender is null
    or v_gender not in ('women', 'men', 'unisex')
    or pg_catalog.length(v_color) not between 1 and 40
    or v_color_hex is null
    or v_color_hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid product details' using errcode = '22023';
  end if;

  if v_price_text is null or v_price_text !~ '^[1-9][0-9]{0,17}$' then
    raise exception 'Invalid product price' using errcode = '22023';
  end if;
  v_price_minor := v_price_text::bigint;

  if v_stock_text is null or v_stock_text !~ '^(0|[1-9][0-9]{0,8})$' then
    raise exception 'Invalid product stock' using errcode = '22023';
  end if;
  v_stock := v_stock_text::integer;

  if p ->> 'isNew' is null
    or p ->> 'isNew' not in ('true', 'false')
    or p ->> 'isActive' is null
    or p ->> 'isActive' not in ('true', 'false') then
    raise exception 'Invalid product visibility settings' using errcode = '22023';
  end if;
  v_is_new := (p ->> 'isNew')::boolean;
  v_is_active := (p ->> 'isActive')::boolean;

  if v_image_url is not null and (
    pg_catalog.length(v_image_url) > 2048
    or v_image_url !~ '^https://[^/[:space:]?#]+([/?#][^[:space:]]*)?$'
  ) then
    raise exception 'Product image URL must be a valid HTTPS URL' using errcode = '22023';
  end if;

  if p -> 'sizes' is null
    or pg_catalog.jsonb_typeof(p -> 'sizes') is distinct from 'array' then
    raise exception 'Product sizes must be an array' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p -> 'sizes') not between 1 and 50 then
    raise exception 'Add between 1 and 50 product sizes' using errcode = '22023';
  end if;

  insert into public.products (
    sku, name, description, category, brand, gender, is_new, is_active
  ) values (
    v_sku, v_name, v_description, v_category, 'ALEXO', v_gender, v_is_new, v_is_active
  )
  returning id into v_product_id;

  for v_size_json in
    select item.value
    from pg_catalog.jsonb_array_elements(p -> 'sizes') as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_size_json) is distinct from 'string' then
      raise exception 'Each product size must be text' using errcode = '22023';
    end if;

    v_size := pg_catalog.btrim(v_size_json #>> '{}');
    if pg_catalog.length(v_size) not between 1 and 30
      or v_size ~ '[[:cntrl:],]'
      or v_size !~ '[A-Za-z0-9]' then
      raise exception 'Invalid product size' using errcode = '22023';
    end if;

    if pg_catalog.lower(v_size) = any(v_seen_sizes) then
      raise exception 'Product sizes must be unique' using errcode = '22023';
    end if;
    v_seen_sizes := pg_catalog.array_append(v_seen_sizes, pg_catalog.lower(v_size));

    v_variant_sku := pg_catalog.upper(v_sku) || '-' ||
      pg_catalog.upper(pg_catalog.regexp_replace(v_size, '[^A-Za-z0-9]+', '-', 'g'));
    if pg_catalog.length(v_variant_sku) not between 2 and 100
      or v_variant_sku = any(v_seen_variant_skus) then
      raise exception 'Product sizes generate duplicate or invalid variant SKUs' using errcode = '22023';
    end if;
    v_seen_variant_skus := pg_catalog.array_append(v_seen_variant_skus, v_variant_sku);

    insert into public.product_variants (
      product_id, sku, size, color, color_hex, currency,
      unit_price_minor, stock, is_active
    ) values (
      v_product_id, v_variant_sku, v_size, v_color, v_color_hex, 'NGN',
      v_price_minor, v_stock, true
    );
  end loop;

  if v_image_url is not null then
    insert into public.product_images (product_id, image_url, alt_text, sort_order)
    values (v_product_id, v_image_url, v_name, 0);
  end if;
end;
$$;

revoke all on function public.admin_create_product(jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_product(jsonb) to authenticated;
