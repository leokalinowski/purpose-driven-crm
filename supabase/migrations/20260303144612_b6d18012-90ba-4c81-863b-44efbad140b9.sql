
-- Add UPDATE and DELETE policies for agent-assets bucket so users can manage their own files
CREATE POLICY "Users can update their own agent assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own agent assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'agent-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
