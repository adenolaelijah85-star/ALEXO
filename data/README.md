# Product catalog import

`catalog-template.csv` is the starting point for the store's real inventory. Add
one row per sellable size/color variant. Repeat the product fields on each
variant row; `product_sku` groups those variants and `variant_sku` must be
unique for every row.

## Fields

- `product_sku`, `variant_sku`: stable internal identifiers; do not reuse them.
- `name`, `description`, `category`, `brand`, `gender`: actual product
  information. Leave `brand` empty if there is no real brand to display.
- `currency`: ISO 4217 currency code, for example `NGN`.
- `unit_price_minor`: integer in the currency's smallest unit. For NGN, enter
  kobo (₦25,000.00 is `2500000`). This prevents rounding errors in payment.
- `compare_at_price_minor`: optional original price in minor units; leave empty
  unless the product is genuinely on sale at `unit_price_minor`.
- `size`, `color`, `color_hex`: the variant's actual options.
- `stock`: physical quantity available for this exact size/color.
- `image_paths`: pipe-separated paths to genuine product photos, relative to
  `images/products/` (for example `linen-shirt-front.jpg|linen-shirt-back.jpg`).
  Upload these files to the Supabase Storage bucket named `product-images`;
  use the resulting public URLs in the product catalog.
- `is_featured`, `is_new`, `is_active`: `true` or `false`; only use `is_new`
  for genuinely new stock.

Do not use stock images as if they were photographs of the item for sale.
Remove rows for products that are not in stock or are not approved for sale.
The import template is intentionally empty: no product, price, or stock level
has been invented.

## Before import

1. Copy your original inventory sheet and fill in the template; keep an
   unchanged backup of the source.
2. Put each approved product photo in `images/products/`. Confirm that every
   image shows the matching item, color, and variant.
3. Check currency, prices, size/color availability, and stock against your
   actual inventory.
4. Upload photos to Supabase Storage, then import the catalog rows into the
   Supabase `products`, `product_variants`, and `product_images` tables.
5. Configure at least one real shipping method in `store_shipping_methods`.

The storefront must be served from an HTTPS host, not opened as a `file://`
URL, for Supabase and Paystack callbacks to work.
