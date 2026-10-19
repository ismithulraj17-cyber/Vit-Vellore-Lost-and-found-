# VIT Find & Connect

A responsive lost-and-found app for VIT Vellore. Browse, search, filter, sort, map, and report campus items from desktop or mobile.

**Source:** [GitHub repository](https://github.com/ismithulraj17-cyber/Vit-Vellore-Lost-and-found-)

## Run locally

```sh
npm install
npm run dev
```

## Project structure

- `src/App.jsx` - app shell, responsive report cards, filters, campus map, and report/detail forms.
- `src/components/MapSearch.jsx` - keyboard-friendly map search and location matching.
- `src/config/mapConfig.js` - campus map bounds and zoom settings.
- `src/lib/mapSearch.js` - map search helpers.
- `src/lib/reportsRepository.js` and `src/lib/supabaseClient.js` - Supabase report and photo access.
- `supabase/schema.sql` - database functions, private contact storage, and photo bucket setup.
- `src/data/seedItems.json` - 24 privacy-safe VIT seed reports shared by the local preview and database seed script.
- `scripts/seed.mjs` - confirms, clears, and repopulates the report table using the Supabase service role key.
- `public/items/` - local item photos; see `PHOTO_MANIFEST.md` for the exact seed photo filenames and descriptions.

Without Supabase credentials, the app runs with the local seed reports. To enable shared reports, first apply `supabase/schema.sql` in the Supabase SQL editor, copy `.env.example` to `.env.local`, and set the project URL, publishable key, and private `SUPABASE_SERVICE_ROLE_KEY`. Run `npm run seed` and type `REPLACE ALL` when prompted; this intentionally replaces all existing report rows. Then run `npm run dev`. Never add the service-role key to Vercel or any frontend environment variable.
