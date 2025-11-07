# How to Convert Your Signup Video to GIF

You mentioned you already have a video explaining the signup process. Here's how to convert it to an animated GIF that you can embed in the invitation email.

## Option 1: CloudConvert (Recommended - Easy & Free)

1. **Visit**: https://cloudconvert.com/mp4-to-gif
2. **Upload** your video file
3. **Settings** (recommended):
   - Width: 600px (perfect for email)
   - Frame Rate: 10 fps (smaller file size, still smooth)
   - Quality: Medium to High
   - Start/End: Trim to keep under 30 seconds for smaller file size
4. **Convert** and download your GIF
5. **Upload to Supabase Storage** (instructions below)

## Option 2: EZGIF (Free Online Tool)

1. **Visit**: https://ezgif.com/video-to-gif
2. **Upload** your video (max 100MB)
3. **Convert** with these settings:
   - Size: 600 width
   - Frame rate: 10
   - Method: FFMPEG
4. **Optimize**: Use the "Optimize" tab to reduce file size
5. **Download** your optimized GIF

## Option 3: Loom or YouTube Link (Easiest - No Conversion)

If you don't want to create a GIF, you can just:
1. Upload video to **Loom** or **YouTube**
2. Get the shareable link
3. Use that link in the email template instead of a GIF

## Upload Your GIF to Supabase Storage

Once you have your GIF file:

1. Go to: https://supabase.com/dashboard/project/cguoaokqwgqvzkqqezcq/storage/buckets/assets
2. Click "Upload File"
3. Upload your GIF (name it something like `signup-tutorial.gif`)
4. Copy the public URL
5. Update the email template (see instructions below)

## Update the Email Template

Once your GIF is uploaded:

1. Open `supabase/functions/send-invitation-email/index.ts`
2. Find this section (around line 90):
   ```html
   <!-- Placeholder for GIF/Video -->
   <div style="background-color: #dbeafe; border-radius: 6px; padding: 40px; text-align: center;">
     <p style="color: #1e40af; font-size: 14px; margin: 0;">🎬 Video tutorial coming soon</p>
   </div>
   ```
3. Replace it with:
   ```html
   <!-- Your Tutorial GIF -->
   <div style="text-align: center;">
     <img src="YOUR_GIF_URL_HERE" alt="Signup Tutorial" style="max-width: 100%; height: auto; border-radius: 6px; border: 2px solid #2563eb;" />
   </div>
   ```
4. Replace `YOUR_GIF_URL_HERE` with your Supabase Storage URL

## Tips for a Good GIF

- **Keep it short**: 15-30 seconds is ideal
- **Size**: 600px width is perfect for email
- **File size**: Try to keep under 2MB for fast loading
- **Add text overlays**: Use tools like Kapwing to add instructional text
- **Test it**: Send a test invitation to yourself to see how it looks

## Alternative: Link to Video Instead

If GIF file size is too large, you can link to a video instead:

```html
<div style="text-align: center; margin: 16px 0;">
  <a href="YOUR_VIDEO_LINK" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    ▶️ Watch Setup Tutorial (2 minutes)
  </a>
</div>
```

This approach:
- Loads faster in email
- Works on all email clients
- Lets you update the video without changing the email template
- Supports longer tutorials

---

**Need Help?** Let me know if you need assistance with any of these steps!
