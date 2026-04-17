-- Initial Supabase schema (run in Supabase SQL editor)
-- Note: Enables UUID and triggers for updated_at.

create extension if not exists "uuid-ossp";

-- updated_at trigger helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- categories
-- =========================
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete restrict,
  is_active boolean not null default true,
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists categories_is_active_idx on public.categories(is_active);
create index if not exists categories_sort_order_idx on public.categories(sort_order);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function set_updated_at();

-- =========================
-- coupons
-- =========================
create table if not exists public.coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('PERCENTAGE','FIXED_AMOUNT')),
  discount_value int not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  has_no_expiry boolean not null default false,
  min_cart_amount int,
  max_cart_amount int,
  min_items_quantity int,
  applies_to_all_products boolean not null default true,
  included_product_ids text[],
  included_category_ids text[],
  excluded_product_ids text[],
  exclude_sale_items boolean not null default false,
  new_customers_only boolean not null default false,
  usage_limit_total int,
  usage_limit_per_customer int,
  usage_count int not null default 0,
  allow_combining boolean not null default false,
  free_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at before update on public.coupons
for each row execute function set_updated_at();

-- =========================
-- content_sections
-- =========================
create table if not exists public.content_sections (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  title text,
  body jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists content_sections_set_updated_at on public.content_sections;
create trigger content_sections_set_updated_at before update on public.content_sections
for each row execute function set_updated_at();

-- =========================
-- legal_pages
-- =========================
create table if not exists public.legal_pages (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists legal_pages_set_updated_at on public.legal_pages;
create trigger legal_pages_set_updated_at before update on public.legal_pages
for each row execute function set_updated_at();

-- =========================
-- site_settings
-- =========================
create table if not exists public.site_settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function set_updated_at();

-- =========================
-- products (minimal CMS source)
-- =========================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  image_url text,
  price int not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_is_active_idx on public.products(is_active);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function set_updated_at();

-- =========================
-- top_sellers
-- =========================
create table if not exists public.top_sellers (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order int not null default 0,
  badge_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id)
);

create index if not exists top_sellers_sort_order_idx on public.top_sellers(sort_order);
create index if not exists top_sellers_is_active_idx on public.top_sellers(is_active);

drop trigger if exists top_sellers_set_updated_at on public.top_sellers;
create trigger top_sellers_set_updated_at before update on public.top_sellers
for each row execute function set_updated_at();

-- =========================
-- Recommended: RLS policy
-- =========================
-- For admin/service role usage only, you can keep RLS off for now.
-- If you enable RLS later, add policies per table.

