## Goal
এখন notification গুলা শুধু tab খোলা থাকলে in-app toast + browser Notification হিসেবে আসে। User চাচ্ছে **OS-level push** — ফোনের notification tray-তে swipe করা যায়, app বন্ধ থাকলেও আসে (installed PWA-এর মতো)। সাথে notification UI আরেকটু সুন্দর।

## দুইটা ভাগ

### Part A — Real Web Push (background notifications)
এইটা করতে **VAPID keys + service worker + push subscription storage + server sender** লাগবে। iOS-এ কাজ করবে **শুধু যদি user "Add to Home Screen" করে PWA install করে** (Apple-এর সীমা, আমাদের হাতে নেই)। Android Chrome/Edge/Firefox-এ browser-এই কাজ করবে।

**Steps:**
1. **VAPID keys generate** — একটা one-time script দিয়ে public + private key বানাব। Private key → Supabase secret (`VAPID_PRIVATE_KEY`), public key → `VITE_VAPID_PUBLIC_KEY` env।
2. **DB table** `push_subscriptions` (user_id, endpoint, p256dh, auth, user_agent, created_at) + RLS।
3. **Service worker** `public/push-sw.js` — শুধু `push` + `notificationclick` event handle করবে। App-shell cache করবে না (Lovable preview safety)। Registration wrapper preview/dev-এ skip করবে।
4. **Subscribe hook** — customer shell + admin shell-এ, permission granted হলে subscribe করে endpoint DB-তে save করবে।
5. **Server function** `sendPush` — `web-push` npm package দিয়ে subscription-এ push পাঠাবে। DB trigger বা admin notifications page থেকে call হবে।
6. **CRM notification form** এখন যেভাবে `notifications` table-এ insert করে, সেই same flow-এ extra step: `sendPush` server fn call করে matching subscription-গুলাতে push দিবে।
7. **Order alerts** — নতুন order এলে admin-দের subscription-এ push (rider role বাদ)।

### Part B — Prettier notification UI
1. **In-app toast redesign** — bigger card, icon (bell/bag/coin depending on type), gradient border, subtle enter animation, "View" action button।
2. **OS notification payload** — proper `icon`, `badge`, `image` (hero), `actions` (View / Dismiss), `vibrate`, `tag` (dedupe), `renotify: true`।
3. **Notification icon assets** — `public/notif-icon.png` (192), `public/notif-badge.png` (72 monochrome)।
4. Notification `type` field add করব (`order`, `promo`, `system`) যাতে icon/color আলাদা হয়।

## Files
- `scripts/gen-vapid.mjs` (new) — one-time key generation
- Migration — `push_subscriptions` table + RLS + grants; `notifications.type` column
- `public/push-sw.js` (new) — push + notificationclick only, guarded scope
- `src/lib/push-client.ts` (new) — subscribe/unsubscribe helpers, SW registration with preview guard
- `src/lib/push.functions.ts` (new) — `sendPush` server function using `web-push`
- `src/components/pretty-toast.tsx` (new) — custom sonner toast renderer
- `src/components/customer-shell.tsx` — auto-subscribe after permission, use pretty toast
- `src/components/staff-shell.tsx` — auto-subscribe (admin/owner), pretty toast for new orders
- `src/routes/_authenticated/admin/notifications.tsx` — trigger `sendPush` after insert; show subscriber count
- `src/integrations/supabase/auth-attacher.ts` — no change (already handles bearer)

## Secrets needed
- `VAPID_PUBLIC_KEY` (public — also expose as `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY` (server secret)
- `VAPID_SUBJECT` (mailto: URL, e.g. `mailto:admin@dighirchap.com`)

আমি generate করে secret-এ set করে দিব — user-কে কিছু করতে হবে না।

## iOS note (important)
Real push iOS-এ কাজ করবে **শুধু** যখন user Safari-তে site খুলে → Share → "Add to Home Screen" → home screen icon থেকে launch করে। এইটা Apple-এর restriction, workaround নাই। Install button আগেই আছে; iOS instruction card-এ এই কথাটা যোগ করব।

## Flow
```text
Admin sends notification
        │
        ├─► INSERT notifications row (in-app toast for open tabs — existing)
        │
        └─► sendPush server fn
                │
                ├─► fetch subscriptions (broadcast=all, or user_id match)
                └─► web-push.sendNotification(each) ──► phone OS tray
```

Confirm করলে shuru korchi।