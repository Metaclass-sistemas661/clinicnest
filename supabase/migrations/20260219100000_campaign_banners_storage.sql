-- Storage bucket for campaign banner images (public read, auth write)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-banners',
  'campaign-banners',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access (required so banner images load inside sent emails)
CREATE POLICY "Campaign banners are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'campaign-banners');

-- Authenticated users can upload banners
CREATE POLICY "Authenticated users can upload campaign banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-banners');

-- Authenticated users can delete their own banners
CREATE POLICY "Authenticated users can delete campaign banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-banners');
