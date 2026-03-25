## Enhance Onboarding & Welcome Experience

The current onboarding components are functional but visually understated. The plan enhances both the **Welcome page** (post-checkout) and the **OnboardingWelcome** (dashboard walkthrough) to make them feel more celebratory and important.

### Changes

#### 1. Welcome Page (`src/pages/Welcome.tsx`)

- Make the success icon larger with a pulsing glow animation
- Add a bold "You're In!" badge/banner above the title
- Add a subtitle tagline: "Your journey to purposeful real estate starts now"
- Add a 3-step "What's Next" quick guide section (Check Email → Set Password → Explore Dashboard)
- Style the email notice card more prominently with an icon and stronger border

#### 2. Onboarding Walkthrough (`src/components/onboarding/OnboardingWelcome.tsx`)

- Add a prominent "GETTING STARTED" label/badge above the card to draw attention
- Increase the card's border weight and add a subtle animated glow/pulse border effect
- Make the icon area larger (bigger circle, bigger icon) with a gradient background
- Increase the title font size from `text-xl` to `text-2xl`/`text-3xl`
- Add step-specific subtitle/tagline under each title (e.g., "The foundation of your business" for Database)
- Add a decorative "Important" or "Setup Guide" ribbon/badge in the top-left corner
- Make the CTA buttons more prominent (larger, filled variant instead of outline)
- Add a subtle entrance animation (fade-in + scale) when switching steps

#### 3. Announcement Modal (`src/components/announcements/AnnouncementModal.tsx`)

- Add a header banner area with gradient background behind the badge and title
- Make modal titles larger and bolder
- Add a subtle animated entrance for the modal content

### Technical Details

- All animations use existing Tailwind animation utilities and CSS keyframes already defined in the project
- No new dependencies required
- Changes are purely visual/CSS with minor JSX restructuring
- Step subtitles added as a new `subtitle` field in the STEPS array