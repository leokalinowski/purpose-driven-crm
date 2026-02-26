
-- Insert test announcements for all 3 display styles
INSERT INTO announcements (title, content, type, image_url, action_url, action_label, is_active, priority, created_by, display_style, display_position, slides)
VALUES 
-- Modal with slides and image
('🎉 New Pipeline Feature', 'We''ve launched a brand new pipeline view that helps you track deals from lead to close. Drag and drop cards between stages, add notes, and see your revenue forecast at a glance.', 'feature', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600', '/pipeline', 'Try it now', true, 10, '0ec22502-e287-40ea-bb80-424d37762b8c', 'modal', 'center', '[{"title":"How to Use It","content":"Navigate to Pipeline from the sidebar. Click + Add Opportunity to create your first deal. Drag cards between stages to update status.","image_url":"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600"}]'::jsonb),
-- Toast with image  
('📊 Weekly Tip', 'Remember to update your SphereSync tasks every Friday. Consistent follow-ups lead to 3x more closings!', 'tip', 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400', '/spheresync-tasks', 'View Tasks', true, 5, '0ec22502-e287-40ea-bb80-424d37762b8c', 'toast', 'top-right', null),
-- Banner with image
('🗓️ Team Meeting Moved', 'This week''s team meeting has been moved to Thursday at 2 PM. Check the Events page for details.', 'meeting', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400', '/events', 'See Events', true, 8, '0ec22502-e287-40ea-bb80-424d37762b8c', 'banner', 'top-right', null);
