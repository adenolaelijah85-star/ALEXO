create or replace function public.admin_delete_product(p_product_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_image_urls text[];
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Product ID is required' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(image.image_url order by image.sort_order),
    array[]::text[]
  )
  into v_image_urls
  from public.product_images as image
  where image.product_id = p_product_id
    and not exists (
      select 1
      from public.product_images as shared_image
      where shared_image.image_url = image.image_url
        and shared_image.product_id <> p_product_id
    );

  delete from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  return v_image_urls;
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
