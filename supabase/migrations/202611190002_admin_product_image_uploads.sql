update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  where id = 'product-images';

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and name like 'admin-products/%'
    and public.is_admin()
  );

drop policy if exists "Admins can remove product images" on storage.objects;
create policy "Admins can remove product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and name like 'admin-products/%'
    and public.is_admin()
  );
