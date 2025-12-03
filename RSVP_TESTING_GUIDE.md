# RSVP System Testing Guide

## Step 1: Create a Test Event

1. **Log into your CRM**
   - Go to `/events` page
   - Click "Add Event"

2. **Fill in Event Details**
   - **Event Title**: "Test RSVP Event - December 2024"
   - **Event Date**: Pick a future date
   - **Location**: "Test Location"
   - **Description**: "This is a test event for RSVP functionality"
   - **Max Capacity**: Enter a number (e.g., 10) to test capacity limits
   - **Brand Color**: Pick a color (optional)
   - **Header Image URL**: Leave blank or add a test image URL

3. **Enable Public RSVP**
   - ✅ **Toggle ON**: "Publish Public RSVP Page"
   - This will generate a public slug automatically

4. **Create Event**
   - Click "Create Event & Tasks"
   - Wait for success message

## Step 2: Get Your Public Event URL

1. **Find Your Event**
   - Scroll to "Event Timeline" section
   - Find your test event
   - You should see a "Published" badge
   - Click "View Public Page" button

2. **Copy the URL**
   - The URL will be: `/event/[slug]`
   - Example: `/event/test-rsvp-event-december-2024`
   - Copy the full URL (including your domain)

## Step 3: Test Public RSVP Page

1. **Open Public Page**
   - Open the public URL in a new tab/incognito window
   - Or share with someone else to test
   - Should NOT require login

2. **Verify Page Loads**
   - ✅ Event title displays
   - ✅ Event date displays
   - ✅ Location displays
   - ✅ Description displays
   - ✅ RSVP form is visible

## Step 4: Submit Test RSVP

1. **Fill RSVP Form**
   - **Name**: "Test User"
   - **Email**: Use your real email to receive confirmation
   - **Phone**: "555-123-4567" (optional)
   - **Number of Guests**: 2

2. **Submit RSVP**
   - Click "RSVP Now"
   - Should see confirmation message
   - Should see "RSVP Confirmed!" screen

3. **Check Email**
   - Check your email inbox
   - Should receive confirmation email within seconds
   - Email should include:
     - Event details
     - Date and time
     - Location
     - Guest count
     - Agent information

## Step 5: Verify in Dashboard

1. **Go Back to Events Page**
   - Navigate to `/events`
   - Find your test event
   - Click on it to expand (if using accordion)

2. **Check RSVP Management**
   - Should see RSVP Management section
   - Should show:
     - Total RSVPs: 1
     - Confirmed: 1
     - Stats card showing the count

3. **View RSVP Details**
   - Click on RSVP Management card
   - Should see your test RSVP in the list
   - Should show:
     - Name: "Test User"
     - Email: Your email
     - Guest count: 2
     - Status: Confirmed

## Step 6: Test Capacity Limit

1. **Create Multiple RSVPs**
   - Go back to public page
   - Submit RSVPs until you reach capacity
   - Use different emails each time

2. **Test Waitlist**
   - Once capacity is reached
   - Next RSVP should show "Join Waitlist"
   - Should receive waitlist confirmation email

## Step 7: Test Check-In

1. **Check In an RSVP**
   - In Events dashboard
   - Find RSVP Management section
   - Click "Check In" button next to an RSVP
   - Should update status to "Checked In"

## Step 8: Test Export

1. **Export RSVPs**
   - In RSVP Management section
   - Click "Export CSV" button
   - Should download a CSV file
   - Open CSV and verify data is correct

## Troubleshooting

**RSVP form doesn't appear:**
- Make sure event is published (`is_published = true`)
- Check browser console for errors
- Verify public_slug is generated

**Email not received:**
- Check Supabase Edge Function logs
- Verify RESEND_API_KEY is set
- Check spam folder
- Verify email address is correct

**RSVP doesn't appear in dashboard:**
- Refresh the page
- Check browser console for errors
- Verify you're logged in as the event owner
- Check Supabase logs for RLS policy issues

**Public page shows 404:**
- Verify public_slug is set on the event
- Check URL matches the slug exactly
- Make sure event is published

## Quick Test Checklist

- [ ] Event created successfully
- [ ] Public page accessible (no login required)
- [ ] RSVP form displays correctly
- [ ] RSVP submission works
- [ ] Confirmation email received
- [ ] RSVP appears in dashboard
- [ ] RSVP stats display correctly
- [ ] Check-in functionality works
- [ ] CSV export works
- [ ] Capacity limit works
- [ ] Waitlist functionality works
