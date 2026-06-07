import { supabase } from './supabase';

const HEALTH_BUCKET = 'health-assets';

/**
 * Upload a file to Supabase Storage and return its public URL.
 */
export async function uploadHealthFile(
  file: File,
  folder: 'profiles' | 'therapy-before' | 'therapy-after' | 'attachments' | 'signatures'
): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(HEALTH_BUCKET)
    .upload(fileName, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(HEALTH_BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Upload multiple files, return array of public URLs.
 */
export async function uploadHealthFiles(
  files: File[],
  folder: 'profiles' | 'therapy-before' | 'therapy-after' | 'attachments'
): Promise<string[]> {
  const urls = await Promise.all(files.map(f => uploadHealthFile(f, folder)));
  return urls;
}

/**
 * Delete a file from Supabase Storage by URL.
 */
export async function deleteHealthFile(url: string): Promise<void> {
  const path = url.split(`${HEALTH_BUCKET}/`)[1];
  if (!path) return;
  await supabase.storage.from(HEALTH_BUCKET).remove([path]);
}
