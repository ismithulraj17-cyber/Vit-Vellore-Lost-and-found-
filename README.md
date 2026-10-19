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
- `public/items/` - bundled item photos used by the local preview reports.

Without Supabase credentials, the app runs with local preview reports. To enable shared reports and photo uploads, run `supabase/schema.sql`, copy `.env.example` to `.env.local`, and add the Supabase URL and publishable key. Add the same variables in Vercel Project Settings > Environment Variables before redeploying. Never expose a service-role key in the frontend.
