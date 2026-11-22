/* ==========================================================================
   ALEXO — Product data
   Inlined as plain JS (not fetched) so the site works by double-clicking
   index.html, with no local server required. ALEXO_PRODUCTS is the single
   preview catalog shared by the homepage, shop, search, and product pages.
   ========================================================================== */

/* ---------------- Lookbook ---------------- */
var ALEXO_LOOKBOOK = [
  { caption: "Summer Collection", image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=400&q=80&auto=format&fit=crop" },
  { caption: "Street Essentials", image: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=400&q=80&auto=format&fit=crop" },
  { caption: "Timeless Elegance", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80&auto=format&fit=crop" },
  { caption: "Minimal & Modern", image: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=400&q=80&auto=format&fit=crop" },
  { caption: "New Season", image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&q=80&auto=format&fit=crop" }
];

/* No customer reviews are displayed until genuine review records are connected. */
var ALEXO_REVIEWS = [];

/* ---------------- Single preview product catalog ---------------- */
var ALEXO_PRODUCTS = [
  {
    name: "Oversized Blazer", price: 89,
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&q=80&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=900&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=900&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&q=80&auto=format&fit=crop"
    ],
    colors: ["#c9bfa5", "#5b5b5b", "#1a1a1a"],
    category: "Outerwear", subcategory: "Outerwear", brand: "Zara", gender: "women",
    sizes: ["S", "M", "L", "XL"], newArrival: true
  },
  {
    name: "Basic Tank Top", price: 49,
    image: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=500&q=80&auto=format&fit=crop",
    colors: ["#c9bfa5", "#5b6674", "#a9b7c5"],
    category: "Tops", subcategory: "Tops", brand: "H&M", gender: "women",
    sizes: ["XS", "S", "M", "L", "XL"]
  },
  {
    name: "Flowy Co-ord Set", price: 79,
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80&auto=format&fit=crop",
    colors: ["#a68a68", "#1a1a1a"],
    category: "Co-ords", subcategory: "Co-ords", brand: "Mango", gender: "women",
    sizes: ["S", "M", "L"]
  },
  {
    name: "Ribbed Knit Top", price: 45, compareAtPrice: 59,
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&q=80&auto=format&fit=crop",
    colors: ["#1a1a1a", "#c9bfa5"],
    category: "Tops", subcategory: "Tops", brand: "Pull&Bear", gender: "women",
    sizes: ["XS", "S", "M", "L"]
  },
  {
    name: "Wide Leg Pants", price: 69,
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500&q=80&auto=format&fit=crop",
    colors: ["#efece6", "#a68a68"],
    category: "Bottoms", subcategory: "Bottoms", brand: "Zara", gender: "women",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    name: "Denim Jacket", price: 89,
    image: "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&q=80&auto=format&fit=crop",
    colors: ["#3b4a5a", "#5b6674"],
    category: "Outerwear", subcategory: "Outerwear", brand: "Nike", gender: "men",
    sizes: ["S", "M", "L", "XL"]
  },
  {
    name: "Pleated Midi Skirt", price: 59,
    image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500&q=80&auto=format&fit=crop",
    colors: ["#5b5b5b", "#1a1a1a"],
    category: "Bottoms", subcategory: "Bottoms", brand: "Mango", gender: "women",
    sizes: ["XS", "S", "M", "L"]
  },
  {
    name: "Cropped Shirt", price: 49,
    image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=500&q=80&auto=format&fit=crop",
    colors: ["#efece6", "#a68a68"],
    category: "Tops", subcategory: "Tops", brand: "Adidas", gender: "women",
    sizes: ["XS", "S", "M", "L"]
  },
  {
    name: "Linen Shirt", price: 55,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&q=80&auto=format&fit=crop",
    colors: ["#a68a68", "#1a1a1a"],
    category: "Tops", subcategory: "Tops", brand: "Pull&Bear", gender: "men",
    sizes: ["S", "M", "L", "XL", "XXL"]
  }
];

ALEXO_PRODUCTS.forEach(function (product) {
  product.id = product.id || String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  product.stock = product.stock || 10;
  product.description = product.description || product.name + " from the ALEXO collection.";
  product.rating = product.rating || 0;
  product.reviews = product.reviews || [];
  product.reviewCount = product.reviewCount || product.reviews.length;
  product.featured = product.featured !== false;
  product.onSale = Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
  product.images = product.images || [product.image];
  product.sizes = product.sizes || [];
  product.details = product.details || [];
});

var ALEXO_PRODUCT_REVIEWS = [];