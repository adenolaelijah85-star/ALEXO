drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
  on public.products for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read all product variants" on public.product_variants;
create policy "Admins can read all product variants"
  on public.product_variants for select to authenticated
  using (public.is_admin());

create or replace function public.admin_update_product(
  p_product_id uuid,
  p_is_active boolean,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant jsonb;
  v_variant_id uuid;
  v_price_minor bigint;
  v_stock integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_product_id is null
    or p_is_active is null
    or p_variants is null
    or jsonb_typeof(p_variants) is distinct from 'array'
    or jsonb_array_length(p_variants) > 500 then
    raise exception 'Invalid product update' using errcode = '22023';
  end if;

  update public.products
    set is_active = p_is_active,
        updated_at = pg_catalog.now()
    where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  for v_variant in
    select value from pg_catalog.jsonb_array_elements(p_variants) as item(value)
  loop
    if jsonb_typeof(v_variant) is distinct from 'object' then
      raise exception 'Invalid variant update' using errcode = '22023';
    end if;

    v_variant_id := nullif(v_variant ->> 'id', '')::uuid;
    v_price_minor := nullif(v_variant ->> 'priceMinor', '')::bigint;
    v_stock := nullif(v_variant ->> 'stock', '')::integer;

    if v_variant_id is null or v_price_minor is null or v_price_minor <= 0
      or v_stock is null or v_stock < 0 then
      raise exception 'Price and stock values are required and must be valid' using errcode = '22023';
    end if;

    update public.product_variants
      set unit_price_minor = v_price_minor,
          stock = v_stock,
          compare_at_price_minor = case
            when compare_at_price_minor is not null
              and compare_at_price_minor <= v_price_minor then null
            else compare_at_price_minor
          end
      where id = v_variant_id and product_id = p_product_id;

    if not found then
      raise exception 'Variant does not belong to this product' using errcode = 'P0002';
    end if;
  end loop;
end;
$$;

revoke all on function public.admin_update_product(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_product(uuid, boolean, jsonb) to authenticated;
