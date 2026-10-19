import { isSupabaseConfigured, supabase } from './supabaseClient';

const mapReport = report => ({
  id: report.id,
  title: report.title,
  category: report.category,
  location: report.location,
  building: report.building,
  floor: report.floor || 'Floor not provided',
  landmark: report.landmark || '',
  lat: Number(report.lat),
  lng: Number(report.lng),
  status: report.status,
  date: report.date,
  description: report.description,
  image: report.image_url || '',
  owner: report.owner || '',
  phone: report.phone || '',
  contact: report.contact || '',
  shareContact: Boolean(report.share_contact),
});

export async function fetchReports() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_lost_found_reports');
  if (error) throw error;
  return (data || []).map(mapReport);
}

export async function uploadReportImage(dataUrl) {
  if (!isSupabaseConfigured || !dataUrl) return dataUrl || '';
  const imageBlob = await (await fetch(dataUrl)).blob();
  const extension = imageBlob.type === 'image/png' ? 'png'
    : imageBlob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from('report-images')
    .upload(path, imageBlob, { contentType: imageBlob.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('report-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function createReport(report) {
  if (!isSupabaseConfigured) return report.id;
  const { data, error } = await supabase.rpc('create_lost_found_report', {
    report: {
      title: report.title,
      category: report.category,
      location: report.location,
      building: report.building,
      floor: report.floor,
      landmark: report.landmark,
      lat: report.lat,
      lng: report.lng,
      status: report.status,
      date: report.date,
      description: report.description,
      image_url: report.image || null,
      owner: report.owner,
      phone: report.phone,
      contact: report.contact,
      share_contact: report.shareContact,
    },
  });
  if (error) throw error;
  return data;
}
