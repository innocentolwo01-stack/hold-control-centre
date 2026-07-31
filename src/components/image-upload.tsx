'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui';

type AssetOwner = 'partner' | 'reward' | 'campaign' | 'content' | 'app';
type AssetType = 'logo' | 'square_logo' | 'card' | 'thumbnail' | 'hero' | 'banner' | 'background' | 'gallery' | 'document';

type ImageUploadProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  pathPrefix: string;
  aspect?: 'square' | 'portrait' | 'wide';
  hint?: string;
  ownerType?: AssetOwner;
  ownerId?: string | null;
  assetType?: AssetType;
};

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

function safeFileName(value: string) {
  const extension = value.includes('.') ? value.split('.').pop()?.toLowerCase() : 'jpg';
  const stem = value.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  return `${stem}.${extension || 'jpg'}`;
}

export function ImageUpload({
  label,
  value,
  onChange,
  pathPrefix,
  aspect = 'wide',
  hint,
  ownerType,
  ownerId,
  assetType = 'card',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setError('');
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError('Use JPG, PNG, WebP, GIF, AVIF or SVG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('The image must be 8 MB or smaller.');
      return;
    }

    setBusy(true);
    try {
      const folder = pathPrefix.toLowerCase().replace(/[^a-z0-9/_-]+/g, '-').replace(/^\/+|\/+$/g, '') || 'uploads';
      const objectPath = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('hold-assets')
        .upload(objectPath, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('hold-assets').getPublicUrl(objectPath);
      const publicUrl = data.publicUrl;

      if (ownerType && ownerId) {
        const { error: assetError } = await supabase.from('media_assets').insert({
          owner_type: ownerType,
          owner_id: ownerId,
          asset_type: assetType,
          bucket_id: 'hold-assets',
          object_path: objectPath,
          public_url: publicUrl,
          mime_type: file.type,
          file_size_bytes: file.size,
        });
        if (assetError) console.warn('Image uploaded, but media record was not created:', assetError.message);
      }

      onChange(publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="image-upload-field">
      <div className="image-upload-label">
        <strong>{label}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div className={`image-upload-preview ${aspect}`}>
        {value ? (
          <div className="image-upload-photo" style={{ backgroundImage: `url(${value})` }} role="img" aria-label={label} />
        ) : (
          <div className="image-upload-empty"><ImagePlus size={30} /><span>No image uploaded</span></div>
        )}
      </div>
      <div className="image-upload-actions">
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" className="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 size={16} className="spin-icon" /> : <ImagePlus size={16} />}
          {value ? 'Replace image' : 'Upload image'}
        </Button>
        {value ? <Button type="button" className="secondary" onClick={() => onChange('')}><RotateCcw size={15} /> Clear</Button> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
