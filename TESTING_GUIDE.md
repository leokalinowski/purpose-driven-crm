# Testing Guide for Real Estate on Purpose CRM

## Creating and Managing Test Accounts

This guide will help you create and manage test accounts for training videos and demonstrations.

### Creating Test Invitations

1. **Access Admin Invitations Page**
   - Navigate to: `/admin-invitations`
   - Only accessible to users with admin role

2. **Generate a New Invitation**
   - Enter the test email (e.g., `test@example.com`)
   - Click "Generate Invitation"
   - The system will automatically:
     - Invalidate any previous unused invitations for that email
     - Create a new invitation valid for 30 days
     - Generate a unique invitation code

3. **Copy the Invitation Code**
   - Click the "Copy Code" button next to the invitation
   - Share this code with the user or use it for testing

### Signing Up with an Invitation

1. **Navigate to Sign Up Page**
   - Go to `/auth`
   - Click on the "Sign Up" tab

2. **Complete the 3-Step Signup Process**

   **Step 1: Basic Information**
   - First Name (required)
   - Last Name (required)
   - Email (required - must match the invitation email)
   - Password (required)
   - Invitation Code (required)

   **Step 2: Professional Information**
   - Team Name (required)
   - Brokerage (required)
   - Phone Number (required)

   **Step 3: Location & Licensing**
   - Office Address (optional)
   - Office Number (optional)
   - Website (optional)
   - State Licenses (optional)
     - **Format**: Enter state codes separated by commas
     - **Example**: `CA, NV, AZ`
     - **Note**: The system will automatically convert to uppercase and show visual tags

3. **Email Confirmation**
   - After successful signup, check the email inbox
   - Click the confirmation link in the email
   - Once confirmed, you can sign in

### Managing State Licenses

State licenses are entered as comma-separated values during signup:

- **Correct Format**: `CA, NV, AZ` or `ca, nv, az` (case-insensitive)
- **Visual Feedback**: You'll see tags appear below the input showing each parsed license
- **Storage**: Licenses are stored as an array in the database

### Deleting Test Accounts

For training videos, you may need to delete and recreate test accounts multiple times.

1. **Access User Management**
   - Navigate to: `/admin-dashboard`
   - Click on the "User Management" tab
   - Only accessible to admins

2. **Search for User**
   - Enter the user's email address
   - Click "Search" or press Enter
   - The system will display:
     - User's email
     - Account creation date
     - Profile status
     - User ID

3. **Delete the User**
   - Click "Delete User" button
   - Confirm the deletion in the dialog
   - This will:
     - Delete the user's profile
     - Remove the user from authentication system
     - Clean up all associated data

4. **Recreate the Account**
   - After deletion, you can immediately create a new invitation
   - Use the same email address
   - Complete the signup process again

### Handling Duplicate Signups

If a user tries to sign up with an email that already exists:

1. **Automatic Detection**
   - The system detects the duplicate signup attempt
   - Shows a yellow warning banner with the message:
     "This email is already registered. Would you like to sign in instead?"

2. **Switch to Sign In**
   - Click the "Switch to Sign In" button
   - You'll be automatically redirected to the Sign In tab
   - Enter your credentials to log in

### Common Issues and Solutions

#### Issue: "Invalid or expired invitation code"
**Solution**: 
- Verify the invitation code is correct
- Check that the email matches the invitation
- Ensure the invitation hasn't expired (30-day limit)
- Generate a new invitation if needed

#### Issue: "Account already exists"
**Solution**:
- Use the "Switch to Sign In" button to log in
- OR use User Management to delete the existing account
- Then create a new invitation and sign up again

#### Issue: State licenses not saving
**Solution**:
- Ensure you're using comma-separated values (e.g., `CA, NV, AZ`)
- Check that the visual tags appear below the input
- If still not working, leave the field empty and add licenses later in profile settings

#### Issue: Can't delete user
**Solution**:
- Ensure you're logged in as an admin
- Check that the email address is correct
- If the error persists, check the edge function logs

### Best Practices for Training Videos

1. **Use Dedicated Test Email**
   - Create a dedicated test email for training
   - Example: `training@yourdomain.com`

2. **Clean State Between Videos**
   - Delete the test account before each video
   - Create a fresh invitation
   - This ensures consistent starting state

3. **Document Invitation Codes**
   - Keep a list of active invitation codes
   - Note the email associated with each code
   - Track expiration dates

4. **Multiple Test Accounts**
   - Create multiple test accounts if needed
   - Use different roles (agent, admin)
   - Test different workflows

### Invitation Lifecycle

```
[Create Invitation] → Valid for 30 days
       ↓
[User Signs Up] → Invitation marked as "used"
       ↓
[Email Confirmation] → Account activated
       ↓
[User Logs In] → Full access to CRM

Alternative path:
[Create New Invitation] → Previous unused invitation automatically invalidated
```

### Security Notes

- Invitations expire after 30 days
- Each invitation is tied to a specific email
- Only admins can create and manage invitations
- Only admins can delete user accounts
- Deleted users cannot be recovered

### Technical Details

- **Database Tables**: `invitations`, `profiles`, `auth.users`
- **Edge Functions**: `admin-delete-user`
- **RLS Policies**: Enforced on all tables
- **Email Service**: Supabase Auth handles confirmation emails
