# VIT Find & Connect

A campus lost-and-found board for VIT Vellore. Search reports, narrow them by category or location, view items on the campus map, and post lost or found reports from desktop or mobile.

**Repository:** [ismithulraj17-cyber/Vit-Vellore-Lost-and-found-](https://github.com/ismithulraj17-cyber/Vit-Vellore-Lost-and-found-)

## Features

- Browse and search lost, found, and reunited item reports.
- Filter by item category, campus location, and report status; sort by date or relevance.
- Switch between report cards and an interactive campus map.
- Post an item report with its location, optional image, and contact details.
- Mark an item reunited through the report verification flow.
- Use the included sample reports without connecting a database, or connect Supabase to share reports across devices.
- Switch between light and dark themes.

## Run locally

### Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm

### Install and start

```sh
git clone https://github.com/ismithulraj17-cyber/Vit-Vellore-Lost-and-found-.git
cd Vit-Vellore-Lost-and-found-
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment variables are needed for the sample-data preview.

Without Supabase, the app loads the reports in `src/data/seedItems.json`. New reports exist in the current page session only. Reunited status changes for sample reports are stored in that browser's local storage.

## Connect Supabase (optional)

Supabase lets visitors load and post shared reports and upload item photos.

1. Create a Supabase project.
2. Open the Supabase SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and set the project URL and publishable key:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

4. Restart the dev server so Vite loads the environment variables.

The database uses public, unauthenticated RPCs for listing and creating reports. Report phone numbers are visible so people can contact the reporter; names and email addresses appear only when the reporter opts in. Uploaded images are served from a public bucket. Do not put private information, faces, student IDs, or barcodes in photos. This project does not include sign-in, spam prevention, or report moderation; add appropriate controls before opening a public board to untrusted traffic.

### Optional demo-data seed

The seed script replaces **every existing report row** in the configured database with the 24 sample reports. It requires the Supabase service-role key locally and asks for `REPLACE ALL` before making changes.

Add the following to `.env.local` only if you intend to run the seed script:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Then run:

```sh
npm run seed
```

Review the prompt and type `REPLACE ALL` to continue. The existing rows are deleted before the sample rows are inserted. Never expose the service-role key in frontend code, a `VITE_` variable, source control, or Vercel settings.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. If using Supabase, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under the Vercel project's environment variables.
3. Deploy (Vite's default build command is `npm run build`, with `dist` as the output directory).

The Supabase schema must be applied before the shared-data deployment can list or create reports. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. Without the two `VITE_SUPABASE_*` values, the app uses its sample-data preview and reports are not shared between devices.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run seed` | Replace database reports with sample data after confirmation |

## Project structure

```text
src/
  App.jsx                    App interface and report flows
  components/MapSearch.jsx   Search suggestions for campus locations
  config/mapConfig.js        Campus map bounds and zoom settings
  data/seedItems.json        Sample reports
  lib/                       Supabase and map helpers
public/items/                Sample item photos and photo notes
scripts/seed.mjs             Confirmed Supabase sample-data seed
supabase/schema.sql          Tables, access functions, and photo bucket
```

The sample photos are product-reference images, not photos of the exact reported items. See [`public/items/PHOTO_MANIFEST.md`](public/items/PHOTO_MANIFEST.md) for the sample image notes.
