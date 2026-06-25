## Goal
4টা feature add করব: (1) CRM থেকে browser push notification, (2) নতুন order এলে admin dashboard-এ auto popup + sound, (3) dashboard-এ recent orders live feed, (4) website জুড়ে button click-এ modern UI sound।

## Scope decision — Browser Notification

দুটো option আছে, আমি **Option A** suggest করছি (simpler, কোনো extra secret/key লাগবে না):

- **Option A — In-app + Tab notification (recommended)**: User যখন website-এ আছে (যেকোনো tab open থাকলে), browser-এর native `Notification` API দিয়ে notification pop up হবে + sound বাজবে। User permission একবার দিলেই হবে। কোনো VAPID key, service worker বা backend push server লাগবে না। Supabase Realtime দিয়ে instantly deliver হবে।
- **Option B — Web Push (background)**: User website বন্ধ করলেও notification পাবে। এটার জন্য VAPID keys generate করতে হবে, service worker setup, push subscription storage, server-side push sender — সব মিলিয়ে বড় work।

আমি Option A দিয়ে শুরু করছি। পরে দরকার হলে Option B add করা যাবে।

## Implementation

### 1. CRM → User browser notification
- **DB**: `notifications` table already exists। শুধু একটা `broadcast` flag বা `target_user_id = null` ব্যবহার করব "send to all" এর জন্য। Realtime enable করব এই table-এ।
- **Admin page** `/admin/notifications`: form দিয়ে title + body লিখে "Send to all" বা specific customer select করে push করা যাবে।
- **Client side**: customer shell এ একটা hook subscribe করবে `notifications` table-এ; নতুন row এলে `new Notification(title, { body })` fire করবে + soft "ding" sound বাজাবে + toast দেখাবে।
- প্রথমবার page load-এ permission request করব ("Allow notifications" prompt)।

### 2. Admin dashboard — new order alert
- `orders` table-এ Realtime subscribe করব admin dashboard-এ।
- নতুন order INSERT হলে: 
  - Top-right এ animated toast "🛎️ New order #1234 — ৳450"
  - Notification sound বাজবে (different tone — "cha-ching" style)
  - Browser notification (যদি permission থাকে)
  - Recent orders list-এর top-এ যোগ হবে

### 3. Dashboard recent orders panel
- Existing dashboard-এ একটা নতুন section "Live orders (last 10)" — pending/preparing orders চলবে real-time।

### 4. UI sounds
- ছোট utility `src/lib/sounds.ts` — Web Audio API দিয়ে synthesized tones (no asset files, lightweight):
  - `click()` — soft tap
  - `success()` — pleasant chime (add to cart, place order)
  - `notify()` — gentle ding (new notification)
  - `newOrder()` — distinctive chime (admin only)
- A global helper hook + opt-out toggle in user profile (mute button)। Default on।
- Major buttons এ wire করব: Add to cart, Place order, Login success ইত্যাদি।

## Files to touch
- `src/lib/sounds.ts` (new) — Web Audio synth helpers
- `src/lib/notifications.ts` (new) — permission helper + show()
- `src/routes/_authenticated/admin/notifications.tsx` (new)
- `src/routes/_authenticated/admin/index.tsx` — add live orders panel + realtime
- `src/components/customer-shell.tsx` — subscribe to notifications, show toasts
- `src/components/staff-shell.tsx` — admin notification permission, new-order subscriber
- Migration — enable Realtime on `notifications` and `orders` tables; allow admin to insert broadcast notifications via RLS।

## ASCII flow
```text
Admin form ─► insert notifications row
                     │
        Supabase Realtime broadcast
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
Customer browser                Admin dashboard
- Notification API              - Toast + sound
- Toast + ding                  - List refresh
```

Confirm করলে implement শুরু করছি।