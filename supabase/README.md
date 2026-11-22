# Supabase and Paystack setup

The Edge Functions keep the Paystack secret and Supabase service-role key on
the server. Never place either key in an HTML page, `js/backend-config.js`,
Git, or a chat message. `js/backend-config.js` accepts only the public
Supabase project URL and anon/publishable key.

## Provision the backend

1. Create a Supabase project and enable the `pg_cron` extension.
2. Provision the project-specific `public.is_admin()` authorization function
   before applying migrations. The admin product migration uses it to restrict
   product updates and access to hidden products; it must return true only for
   approved administrators.
3. Link this folder with the Supabase CLI and apply the migrations:

   ```text
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   This also creates the customer profile/address table with row-level security;
   signed-in customers can access only their own record.

4. Configure server-side secrets in the Supabase project:

   ```text
   supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   supabase secrets set PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY
   supabase secrets set STOREFRONT_URL=https://YOUR_STOREFRONT_HOST
   supabase secrets set STOREFRONT_ORIGIN=https://YOUR_STOREFRONT_HOST
   ```

   Use the exact deployed origin (scheme and host, no trailing slash) for
   `STOREFRONT_ORIGIN`. `STOREFRONT_URL` is the public base URL used for
   Paystack's return page. Use Paystack test keys until the end-to-end flow has
   been verified in test mode.

5. Deploy `create-payment`, `verify-payment`, `paystack-webhook`, and
   `track-order`.
6. In Paystack, configure the webhook URL as
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`.
7. Put the project URL and public anon key in `js/backend-config.js`.
   In Supabase Authentication, enable email/password sign-in and email
   confirmation. Add the deployed `login.html` and `account.html` URLs to the
   allowed redirect URLs. Serve the storefront over HTTPS; `file://` previews
   cannot complete email confirmation or password-reset redirects.
8. Import verified product rows from `data/catalog-template.csv`, upload real
   product photos to the `product-images` bucket, and configure active
   `store_shipping_methods` rows. The migration deliberately inserts no
   products or shipping charges. Add a `store_settings` row with the actual
   support email, country, and HTTPS privacy, terms, shipping, and returns
   policy URLs. Only set `checkout_enabled` after testing all of those values.

The admin product editor uses the `admin_create_product`,
`admin_update_product`, and `admin_delete_product` RPCs from the latest
migrations. They rely on the existing `public.is_admin()` function to authorize
product creation, updates, and deletion and to expose hidden products in the
admin inventory; keep that function restricted to approved store
administrators. Product creation inserts the product, its size variants, and
optional image URL in one transaction. Updates change prices, stock, shop
visibility, featured status, and new-arrival status without granting browser
clients direct table-write access. Deleting a product removes its variants and
image records while order-history snapshots remain. The admin page also removes
unshared uploaded images under `admin-products/` after a successful deletion.
Product image uploads are stored in the public `product-images` bucket; the
upload migration restricts files to supported image types and a 10 MB limit,
and allows only admins to upload or remove those objects.

The Admin page can add products from CSV after the color-variant migration is
applied. The CSV headers are `sku,name,category,gender,price_ngn,sizes,colors,
stock_per_variant,description,image_url,is_new,is_active`; separate sizes and
colors with `|`. Each size/color combination receives the row's price and stock.
The importer previews and validates rows, asks for confirmation before writing,
and reports partial failures. Product edits can change variant prices and stock,
visibility, featured/new flags, and products can be permanently deleted.

`data/alexo-50-products-import.csv` contains the 50 product details supplied
for this catalog. It assigns 10 units to every size/color combination, generates
SKUs, maps the supplied color names to swatches, and marks all rows active.
Review the CSV and confirm actual inventory before importing it into the live
shop.

Existing Paystack order references retain their `adelix-` prefix for
compatibility with orders already created by the database. Do not rename that
external reference format without updating the order-creation function and
verification flow together.

The checkout endpoint calculates prices from Supabase, reserves stock in a
database transaction, and initializes Paystack server-side. The browser only
redirects to Paystack and clears its cart after the server verifies payment.
Order tracking requires the order number and matching checkout email.

The site must be hosted over HTTPS. A blank config, missing product variants,
or missing active shipping methods causes checkout to stop; it must never fall
back to the demo success screen.
