-- ============================================================
-- Gengdongta Storage Buckets
-- ============================================================

-- Create storage bucket for user-uploaded assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gengdongta-assets',
  'gengdongta-assets',
  true,                         -- public access for images
  10485760,                     -- 10 MB max file size
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read all files
CREATE POLICY "Anyone can read assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gengdongta-assets');

-- Storage RLS: only owner can upload/update their files
-- Files are organized as: {category}/{userId}_{timestamp}_{random}.{ext}
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gengdongta-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'gengdongta-assets'
    AND auth.uid() = owner
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gengdongta-assets'
    AND auth.uid() = owner
  );

-- avatars storage bucket policies
CREATE POLICY "任何人可查看头像" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "用户可上传自己的头像" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "用户可更新自己的头像" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "用户可删除自己的头像" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);
