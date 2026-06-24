## Dighir Chap ROS — MVP Plan

A thin slice across all 4 portals, built on the existing TanStack Start + Supabase stack. Email/password auth now (OTP later). Google Maps deferred until you add your custom-domain API key — order tracking will use status updates first.

### 1. Database (single migration)

Tables (all with RLS + `created_at`/`updated_at`):
- `profiles` — name, phone, address, coins, tier (Bronze/Silver/Gold/Platinum)
- `app_role` enum + `user_roles` (owner, manager, cashier, marketing, rider_manager, rider, customer) + `has_role()` security-definer
- `categories` — name, image, sort_order, active
- `menu_items` — category_id, name, description, price, image, available
- `orders` — customer_id, rider_id, status (pending/confirmed/preparing/picked_up/delivered/cancelled), subtotal, delivery_fee, discount, coins_earned, coins_redeemed, payment_method (COD), address, lat/lng
- `order_items` — order_id, menu_item_id, qty, price
- `riders` — profile_id, vehicle, active, current_lat/lng
- `coupons` — code, type (%/flat/free_delivery), value, min_order, expires_at, active
- `complaints` — order_id, customer_id, message, status, resolution
- `loyalty_rules` — coins_per_100, redeem_rate (singleton, admin editable)
- `notifications` — user_id, title, body, read

RLS pattern: customers see own data; staff roles via `has_role()`; riders see assigned orders.

### 2. Auth & roles
- Email/password via existing Supabase client
- Trigger auto-creates `profiles` + assigns `customer` role on signup
- `/auth` public route; managed `_authenticated/` gate already in place

### 3. Routes (file-based)

**Customer (public + `_authenticated/`)**
- `/` — hero, categories, featured items
- `/menu` — search, category filter
- `/cart`, `/checkout` (COD)
- `/orders`, `/orders/$id` (status timeline + reorder)
- `/profile` (coins, tier, address)

**Admin CRM** `_authenticated/admin/*` (owner/manager/cashier)
- `/admin` dashboard, `/admin/orders` (realtime), `/admin/menu`, `/admin/customers`, `/admin/coupons`, `/admin/complaints`, `/admin/riders`, `/admin/loyalty`

**Rider** `_authenticated/rider/*`
- `/rider` assigned orders, status update, today's earnings

**Owner** `_authenticated/owner/*`
- `/owner` analytics: sales, orders, top items, rider performance, customer growth

### 4. Realtime & loyalty
- Supabase Realtime on `orders` → admin board + customer tracking page
- DB trigger awards coins on `status = delivered` using `loyalty_rules`
- Tier auto-upgrades via SQL function (lifetime spend thresholds)

### 5. UI/UX
- Foodpanda-inspired: warm coral primary (#E21B70-ish accent on light surface), rounded cards, bottom-nav on mobile
- Mobile-first, shadcn components, sticky cart bar on customer
- Distinct admin shell (sidebar) vs customer shell (top + bottom nav)

### 6. Explicitly deferred (called out so you know)
- Mobile OTP (needs Twilio secrets)
- Google Maps live tracking (needs your own API key for custom domain) — orders will show status timeline + rider name/phone instead
- Firebase push notifications (in-app notifications table only for now)
- Per-role granular permission matrix (roles enforce access; fine-grained per-action perms later)
- Marketing campaigns, segmentation, Multi-branch/franchise

### Technical notes
- Stack stays TanStack Start (not Next.js) — already configured, fully Supabase-compatible
- Server-only logic via `createServerFn` with `requireSupabaseAuth`
- Admin lists via Supabase from authenticated client (RLS enforces role gates)

### Build order
1. Migration (schema + RLS + triggers + seed loyalty_rules)
2. Auth pages + role bootstrap
3. Customer flow end-to-end (menu → checkout → order detail)
4. Admin orders + menu + realtime
5. Rider portal
6. Owner analytics
7. Coupons, complaints, loyalty redemption

Confirm and I'll start with the migration.