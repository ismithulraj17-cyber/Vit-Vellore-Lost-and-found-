# VIT Find & Connect

Lost and found reports for the VIT Vellore campus. The app includes local preview reports and can connect to Supabase for shared, persistent reports and uploaded item photos.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase environment variables, the app runs with its local preview reports. Reports created in preview mode are kept only while the page is open.

## Enable Supabase

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql) to create the report API, private contact storage, and item-photo bucket.
3. Copy `.env.example` to `.env.local`, then fill in the project URL and publishable key from Supabase **Project Connect**.
4. Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values to Vercel Project Settings → Environment Variables, then redeploy.

The browser uses only the publishable key. Do not put a Supabase service-role key in this app or in a `VITE_` variable. Contact details are stored separately and returned only for reports whose owner enabled contact sharing. Uploaded report photos are public so they can appear on report cards; avoid including people, IDs, or other private information in photos.

Existing item photos are local JPG assets under `public/items/`; newly submitted photos are uploaded to Supabase Storage when configured.
