import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local .env file first.');
}

const items = JSON.parse(await readFile(new URL('../src/data/seedItems.json', import.meta.url), 'utf8'));
if (items.length !== 24) throw new Error(`Expected 24 seed items, received ${items.length}.`);

const prompt = createInterface({ input: stdin, output: stdout });
console.warn('This replaces every row in public.lost_found_reports and cascades its contact rows.');
const confirmation = await prompt.question('Type REPLACE ALL to continue: ');
prompt.close();
if (confirmation !== 'REPLACE ALL') {
  console.log('Seed cancelled. No database changes were made.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: deleteError } = await supabase
  .from('lost_found_reports')
  .delete()
  .not('id', 'is', null);
if (deleteError) throw new Error(`Could not clear existing reports: ${deleteError.message}`);

const rows = items.map(({ id, title, category, location, building, floor, landmark, lat, lng, status, date, time, description, image }) => ({
  title, category, location, building, floor, landmark, lat, lng, status, date, time, description,
  image_url: image || null,
}));
const { data, error: insertError } = await supabase
  .from('lost_found_reports')
  .insert(rows)
  .select('id');
if (insertError) throw new Error(`Existing reports were cleared, but seed insert failed: ${insertError.message}`);
console.log(`Inserted ${data.length} campus reports.`);
