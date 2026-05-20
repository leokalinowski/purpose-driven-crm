/**
 * Settings — the configuration center for the Hub.
 *
 * Seven sections, all on one scrollable page with a sticky rail nav:
 *   1. Profile & account ............. identity + contact + license
 *   2. Brand & content ............... colors, logos, AI tone, signature
 *   3. Annual goals .................. GCI / closings / conversations
 *   4. Notifications ................. timezone, quiet hours, reminder day
 *   5. Billing ....................... Stripe customer portal
 *   6. Security ...................... password, sign-out, account help
 *   7. Data & export ................. CSV downloads + GDPR contact
 *
 * Data layer:
 *   - profiles ............. useUserProfile (identity, contact, license)
 *                            useCoachingGoals (annual_*_goal)
 *                            useNotificationPrefs (tz, reminders, quiet hrs)
 *   - agent_marketing_settings   useAgentMarketingSettings (brand, AI, etc.)
 *   - auth.users ........... useAuth (email, sign out)
 *
 * Voice & Audience fields (target_audience, tone_guidelines, brand_guidelines,
 * example_copy, what_not_to_say) ARE wired — they're consumed by:
 *   - generate-ai-newsletter ...... drafts the weekly newsletter copy
 *   - generate-social-copy ........ social post captions
 *   - process-thumbnail-queue ..... AI thumbnail / image prompts
 *   - delight-suggest-gift ........ tone-matching gift suggestions
 *
 * Note: the previous duplicate brand columns on `profiles` were dropped in
 * the Phase-0 dedupe migration; `agent_marketing_settings` is the source
 * of truth for color/headshot/logo/AI-tone/scheduling fields.
 */

import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  User,
  Palette,
  CreditCard,
  Loader2,
  Check,
  Trophy,
  Bell,
  Shield,
  Database,
  Download,
  LogOut,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SubscriptionSettings } from '@/components/settings/SubscriptionSettings';
import { AssetUploader } from '@/components/settings/AssetUploader';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAgentMarketingSettings, type AgentMarketingSettings } from '@/hooks/useAgentMarketingSettings';
import { useCoachingGoals } from '@/hooks/useCoachingGoals';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Rail nav config ───────────────────────────────────────────────────

type RailKey =
  | 'profile'
  | 'brand'
  | 'goals'
  | 'notifications'
  | 'billing'
  | 'security'
  | 'data';

const railItems: { id: RailKey; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile & account', icon: User },
  { id: 'brand', label: 'Brand & content', icon: Palette },
  { id: 'goals', label: 'Annual goals', icon: Trophy },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'data', label: 'Data & export', icon: Database },
];

// ── Brand voice defaults ─────────────────────────────────────────────
// Pre-fills the Voice & Audience textareas on first visit so agents see
// usable copy instead of six empty boxes. Pulled into the editor only when
// the saved value is null/empty — the agent can edit and save over them,
// and once they do their override is what every AI surface uses.

const BRAND_VOICE_DEFAULTS = {
  target_audience: [
    'First-time buyers and growing families in my service area, mostly ages 28–55.',
    'A healthy mix of buyers and sellers — equal weight to both, with a soft preference for relationship-driven repeat clients and referrals.',
    'Light on investors. Most readers are looking for a home, not a portfolio play.',
  ].join('\n\n'),
  tone_guidelines: [
    'Warm, direct, and human. Like a trusted friend who happens to be an expert.',
    'Short sentences. Active voice. No real-estate jargon — no "stunning," "luxurious," "must-see," or anything that sounds like an ad.',
    'Confident but never pushy. Educate first, sell second. Light humor is welcome when it lands naturally.',
  ].join('\n\n'),
  brand_guidelines: [
    'I show up as a guide, not a salesperson. Every email, post, or message should leave the reader feeling more informed — even if they never work with me.',
    'Always sign off with my first name only.',
    'Never use exclamation marks in subject lines. Avoid emojis in formal communications; sparing use is fine in casual posts.',
    'When linking to listings, frame them around the reader\'s likely question (commute, school, layout) rather than features.',
  ].join('\n\n'),
  example_copy: [
    "Hey there — quick note from this week.",
    '',
    "Two homes hit the market in the neighborhood and one is already pending. The other has been sitting since Sunday and just had a price cut — usually a sign the seller is motivated.",
    '',
    "If you've been waiting for inventory to loosen up, this is one of the better windows we've had in months. Reply with a time and I'll send you a short list to look at.",
    '',
    "— Jordan",
  ].join('\n'),
  what_not_to_say: [
    'No "hot market," "won\'t last," "act fast," or any pressure language.',
    'No fake scarcity. Never imply a property is more in-demand than it actually is.',
    'No guarantees about price, timing, or outcomes ("you\'ll definitely make money," "rates will drop," etc.).',
    'No commentary on a buyer or seller\'s personal finances unless they\'ve volunteered the context.',
  ].join('\n'),
} as const;

/** Generic system-prompt skeleton — fed into every AI request. */
const GPT_PROMPT_DEFAULT = [
  'You are writing as a working real-estate agent. Your job is to sound like a trusted neighbor, not a brochure.',
  '',
  'Always:',
  '- Lead with what is useful to the reader, not what is exciting to the agent.',
  '- Keep emails under 150 words and posts under 60 unless explicitly asked for more.',
  '- Use specifics (numbers, neighborhoods, dates) over adjectives.',
  '- Sign off with the agent\'s first name only.',
  '',
  'Never:',
  '- Use real-estate clichés ("stunning," "must-see," "luxurious," "won\'t last").',
  '- Manufacture urgency or scarcity.',
  '- Make outcome guarantees about price, timing, or market direction.',
].join('\n');

const inputCls =
  'h-[38px] px-3 border border-border rounded-lg bg-card text-sm text-reop-dark-blue focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';

const textareaCls = cn(inputCls, 'h-auto min-h-[72px] py-2.5 resize-y leading-[1.5]');

// ── Small primitives ──────────────────────────────────────────────────

function Field({
  label,
  children,
  full,
  help,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  help?: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'sm:col-span-2')}>
      <label className="text-xs font-semibold text-reop-dark-blue">{label}</label>
      {children}
      {help && <div className="text-[11.5px] text-muted-foreground leading-snug">{help}</div>}
    </div>
  );
}

function SectionShell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-card border border-border rounded-[12px] mb-[18px] overflow-hidden scroll-mt-6">
      <div className="px-6 py-[18px] border-b border-border">
        <h3 className="m-0 text-base font-semibold text-reop-dark-blue">{title}</h3>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground leading-snug">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function SaveButton({
  saving,
  disabled,
  onClick,
  children,
}: {
  saving: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition disabled:opacity-60"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      {saving ? 'Saving…' : children}
    </button>
  );
}

// ── 1. Profile & account ─────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const { profile, loading, save } = useUserProfile();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [teamName, setTeamName] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [brokerageInfo, setBrokerageInfo] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [stateLicensesInput, setStateLicensesInput] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [canEmailMarketing, setCanEmailMarketing] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setPhoneNumber(profile.phone_number ?? '');
    setOfficeNumber(profile.office_number ?? '');
    setOfficeAddress(profile.office_address ?? '');
    setWebsite(profile.website ?? '');
    setTeamName(profile.team_name ?? '');
    setBrokerage(profile.brokerage ?? '');
    setBrokerageInfo(profile.brokerage_info ?? '');
    setLicenseNumber(profile.license_number ?? '');
    setStateLicensesInput((profile.state_licenses ?? []).join(', '));
    setPrivacyPolicyUrl(profile.privacy_policy_url ?? '');
    setCanEmailMarketing(profile.can_email_marketing ?? true);
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const stateLicenses = stateLicensesInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0 && s.length <= 4);
    const ok = await save({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone_number: phoneNumber.trim() || null,
      office_number: officeNumber.trim() || null,
      office_address: officeAddress.trim() || null,
      website: website.trim() || null,
      team_name: teamName.trim() || null,
      brokerage: brokerage.trim() || null,
      brokerage_info: brokerageInfo.trim() || null,
      license_number: licenseNumber.trim() || null,
      state_licenses: stateLicenses.length > 0 ? stateLicenses : null,
      privacy_policy_url: privacyPolicyUrl.trim() || null,
      can_email_marketing: canEmailMarketing,
    });
    setSaving(false);
    toast({
      title: ok ? 'Profile saved' : "Couldn't save profile",
      description: ok ? 'Updated across the Hub.' : 'Try again in a moment.',
      variant: ok ? 'default' : 'destructive',
    });
  };

  return (
    <SectionShell
      id="profile"
      title="Profile & account"
      description="Your identity, contact info, license, and brokerage. Reused by the newsletter footer, event pages, and outreach drafts."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name">
              <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" />
            </Field>
            <Field label="Last name">
              <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Kim" />
            </Field>
            <Field label="Email" full help="Email is managed through your sign-in. Contact support to change.">
              <input className={cn(inputCls, 'opacity-70')} value={user?.email || ''} disabled />
            </Field>
            <Field label="Phone number" help="Mobile — shown on event pages + outreach.">
              <input className={inputCls} type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 (555) 123-4567" />
            </Field>
            <Field label="Office number">
              <input className={inputCls} type="tel" value={officeNumber} onChange={(e) => setOfficeNumber(e.target.value)} placeholder="+1 (555) 987-6543" />
            </Field>
            <Field label="Office address" full help="Used in your newsletter footer to satisfy CAN-SPAM.">
              <input className={inputCls} value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} placeholder="123 Main St, Suite 200, Seattle, WA 98101" />
            </Field>
            <Field label="Website">
              <input className={inputCls} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
            </Field>
            <Field label="Team name">
              <input className={inputCls} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="The Kim Group" />
            </Field>
            <Field label="Brokerage">
              <input className={inputCls} value={brokerage} onChange={(e) => setBrokerage(e.target.value)} placeholder="Coldwell Banker" />
            </Field>
            <Field label="License number">
              <input className={inputCls} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="DRE #01234567" />
            </Field>
            <Field label="Licensed states" help="Comma-separated state codes (e.g. CA, NV, AZ).">
              <input
                className={inputCls}
                value={stateLicensesInput}
                onChange={(e) => setStateLicensesInput(e.target.value)}
                placeholder="CA, NV, AZ"
              />
              {stateLicensesInput.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {stateLicensesInput
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter((s) => s.length > 0 && s.length <= 4)
                    .map((code) => (
                      <span key={code} className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {code}
                      </span>
                    ))}
                </div>
              )}
            </Field>
            <Field
              label="Brokerage info / disclosures"
              full
              help="Required compliance text from your brokerage. Shown in the newsletter footer."
            >
              <textarea
                className={textareaCls}
                value={brokerageInfo}
                onChange={(e) => setBrokerageInfo(e.target.value)}
                placeholder="Each office independently owned and operated. Equal Housing Opportunity."
              />
            </Field>
            <Field
              label="Privacy policy URL"
              full
              help="Linked in the newsletter footer. Required if you collect emails."
            >
              <input
                className={inputCls}
                type="url"
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="https://yoursite.com/privacy"
              />
            </Field>
            <Field label="Can receive marketing email" full>
              <label className="inline-flex items-center gap-2 text-sm text-reop-dark-blue cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  checked={canEmailMarketing}
                  onChange={(e) => setCanEmailMarketing(e.target.checked)}
                />
                <span>Receive product updates + tips from the REOP team.</span>
              </label>
            </Field>
          </div>
          <div className="flex justify-end mt-5">
            <SaveButton saving={saving} onClick={handleSave}>
              Save profile
            </SaveButton>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ── 2. Brand & content ───────────────────────────────────────────────

function BrandSection() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { fetchSettings, upsertSettings, loading: marketingLoading } = useAgentMarketingSettings();
  const [settings, setSettings] = useState<AgentMarketingSettings | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [primary, setPrimary] = useState('#0fb1c4');
  const [secondary, setSecondary] = useState('#1a3046');
  const [headshotUrl, setHeadshotUrl] = useState('');
  const [logoColoredUrl, setLogoColoredUrl] = useState('');
  const [logoWhiteUrl, setLogoWhiteUrl] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [brandGuidelines, setBrandGuidelines] = useState('');
  const [exampleCopy, setExampleCopy] = useState('');
  const [whatNotToSay, setWhatNotToSay] = useState('');
  const [gptPrompt, setGptPrompt] = useState('');
  const [schedulingUrl, setSchedulingUrl] = useState('');
  const [senderName, setSenderName] = useState('');
  const [signatureBlock, setSignatureBlock] = useState('');
  const [saving, setSaving] = useState(false);

  // Build a sensible default signature from whatever profile fields exist.
  // Used as the placeholder AND auto-filled when the agent has no saved
  // signature, so a fresh agent gets a working signature out of the box.
  const profileFallbackName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';
  const buildDefaultSignature = (): string => {
    if (!profile) return '';
    const lines: string[] = [];
    if (profileFallbackName) lines.push(profileFallbackName);
    if (profile.team_name) lines.push(profile.team_name);
    if (profile.brokerage) lines.push(profile.brokerage);
    const contactLine = [
      profile.phone_number,
      profile.website,
    ].filter(Boolean).join(' · ');
    if (contactLine) lines.push(contactLine);
    if (profile.license_number) {
      const states = (profile.state_licenses ?? []).join(', ');
      lines.push(states ? `License ${profile.license_number} (${states})` : `License ${profile.license_number}`);
    }
    return lines.join('\n');
  };

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    fetchSettings(user.id).then((data) => {
      if (!active) return;
      setSettings(data);
      if (data) {
        setPrimary(data.primary_color || '#0fb1c4');
        setSecondary(data.secondary_color || '#1a3046');
        setHeadshotUrl(data.headshot_url || '');
        setLogoColoredUrl(data.logo_colored_url || '');
        setLogoWhiteUrl(data.logo_white_url || '');
        // Voice & Audience: pre-fill empty fields with generic defaults so
        // a brand-new agent doesn't see five empty textareas. As soon as
        // they save, their override wins everywhere.
        setAudience(data.target_audience || BRAND_VOICE_DEFAULTS.target_audience);
        setTone(data.tone_guidelines || BRAND_VOICE_DEFAULTS.tone_guidelines);
        setBrandGuidelines(data.brand_guidelines || BRAND_VOICE_DEFAULTS.brand_guidelines);
        setExampleCopy(data.example_copy || BRAND_VOICE_DEFAULTS.example_copy);
        setWhatNotToSay(data.what_not_to_say || BRAND_VOICE_DEFAULTS.what_not_to_say);
        setGptPrompt(data.gpt_prompt || '');
        setSchedulingUrl(data.scheduling_url || '');
        // Outbound defaults — fall back to the profile-derived name +
        // a signature block built from contact info.
        setSenderName(data.sender_name || profileFallbackName);
        setSignatureBlock(data.signature_block || buildDefaultSignature());
      } else {
        // No row in agent_marketing_settings yet — first-time visit.
        setAudience(BRAND_VOICE_DEFAULTS.target_audience);
        setTone(BRAND_VOICE_DEFAULTS.tone_guidelines);
        setBrandGuidelines(BRAND_VOICE_DEFAULTS.brand_guidelines);
        setExampleCopy(BRAND_VOICE_DEFAULTS.example_copy);
        setWhatNotToSay(BRAND_VOICE_DEFAULTS.what_not_to_say);
        setSenderName(profileFallbackName);
        setSignatureBlock(buildDefaultSignature());
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
    // buildDefaultSignature closes over `profile`; the effect re-runs when
    // user.id or profile changes — exactly what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchSettings, profile]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const updated = await upsertSettings(user.id, {
      primary_color: primary || null,
      secondary_color: secondary || null,
      headshot_url: headshotUrl || null,
      logo_colored_url: logoColoredUrl || null,
      logo_white_url: logoWhiteUrl || null,
      target_audience: audience.trim() || null,
      tone_guidelines: tone.trim() || null,
      brand_guidelines: brandGuidelines.trim() || null,
      example_copy: exampleCopy.trim() || null,
      what_not_to_say: whatNotToSay.trim() || null,
      gpt_prompt: gptPrompt.trim() || null,
      scheduling_url: schedulingUrl.trim() || null,
      sender_name: senderName.trim() || null,
      signature_block: signatureBlock.trim() || null,
    });
    if (updated) setSettings(updated);
    setSaving(false);
  };

  if (!hydrated) {
    return (
      <SectionShell
        id="brand"
        title="Brand & content"
        description="Visual identity and writing voice the AI reuses across newsletters, social posts, and outreach drafts."
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      id="brand"
      title="Brand & content"
      description="Visual identity and writing voice the AI reuses across newsletters, social posts, and outreach drafts."
    >
      {/* ── Visual identity ── */}
      <div className="mb-6">
        <div className="eye-label mb-3 text-[10.5px]">Visual identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary color" help="Used in highlights and CTAs.">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-[38px] w-[44px] rounded border border-border cursor-pointer p-0.5"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
              />
              <input className={cn(inputCls, 'flex-1 font-mono')} value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </Field>
          <Field label="Secondary color" help="Used in headers and accents.">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-[38px] w-[44px] rounded border border-border cursor-pointer p-0.5"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
              />
              <input className={cn(inputCls, 'flex-1 font-mono')} value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </Field>
          {user?.id && (
            <>
              <AssetUploader
                label="Headshot"
                value={headshotUrl}
                onChange={setHeadshotUrl}
                userId={user.id}
                fileKey="headshot"
                shape="square"
                help="Used in the newsletter agent bio and event pages."
              />
              <AssetUploader
                label="Logo (color, for light backgrounds)"
                value={logoColoredUrl}
                onChange={setLogoColoredUrl}
                userId={user.id}
                fileKey="logo-colored"
                shape="wide"
                help="PNG with transparent background recommended."
              />
              <AssetUploader
                label="Logo (white, for dark backgrounds)"
                value={logoWhiteUrl}
                onChange={setLogoWhiteUrl}
                userId={user.id}
                fileKey="logo-white"
                shape="wide"
                help="Used on dark hero sections."
              />
            </>
          )}
        </div>
      </div>

      {/* ── Voice & audience ── */}
      <div className="mb-6 pt-5 border-t border-border">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="eye-label text-[10.5px]">Voice & audience</div>
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
              Used by every AI surface — newsletters, social copy, gift suggestions, thumbnail prompts. Edit any field to match your voice.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Target audience"
            full
            help={(
              <>
                Who you primarily serve. Helps the AI write to the right reader.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setAudience(BRAND_VOICE_DEFAULTS.target_audience)}
                >
                  Reset to suggested
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={BRAND_VOICE_DEFAULTS.target_audience}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              rows={4}
            />
          </Field>
          <Field
            label="Tone guidelines"
            full
            help={(
              <>
                Voice, formality, and any phrases to favor.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setTone(BRAND_VOICE_DEFAULTS.tone_guidelines)}
                >
                  Reset to suggested
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={BRAND_VOICE_DEFAULTS.tone_guidelines}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              rows={4}
            />
          </Field>
          <Field
            label="Brand guidelines"
            full
            help={(
              <>
                How you present — sign-offs, formatting habits, no-go phrases.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setBrandGuidelines(BRAND_VOICE_DEFAULTS.brand_guidelines)}
                >
                  Reset to suggested
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={BRAND_VOICE_DEFAULTS.brand_guidelines}
              value={brandGuidelines}
              onChange={(e) => setBrandGuidelines(e.target.value)}
              rows={4}
            />
          </Field>
          <Field
            label="Example copy"
            full
            help={(
              <>
                A short paragraph in your real voice. The AI imitates this style.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setExampleCopy(BRAND_VOICE_DEFAULTS.example_copy)}
                >
                  Reset to suggested
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={BRAND_VOICE_DEFAULTS.example_copy}
              value={exampleCopy}
              onChange={(e) => setExampleCopy(e.target.value)}
              rows={5}
            />
          </Field>
          <Field
            label="What NOT to say"
            full
            help={(
              <>
                Phrases, words, or claims the AI must avoid.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setWhatNotToSay(BRAND_VOICE_DEFAULTS.what_not_to_say)}
                >
                  Reset to suggested
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={BRAND_VOICE_DEFAULTS.what_not_to_say}
              value={whatNotToSay}
              onChange={(e) => setWhatNotToSay(e.target.value)}
              rows={4}
            />
          </Field>
          <Field
            label="System prompt override (advanced)"
            full
            help={(
              <>
                Optional. Prepended to every AI request — overrides the default prompt.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setGptPrompt(GPT_PROMPT_DEFAULT)}
                >
                  Insert the default
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={GPT_PROMPT_DEFAULT}
              value={gptPrompt}
              onChange={(e) => setGptPrompt(e.target.value)}
              rows={5}
            />
          </Field>
        </div>
      </div>

      {/* ── Outbound defaults ── */}
      <div className="pt-5 border-t border-border">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="eye-label text-[10.5px]">Outbound defaults</div>
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
              The From: name and signature used by AI newsletters and outreach drafts. Pre-filled from your profile — edit to taste.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Sender name (newsletter)"
            help={(
              <>
                Shown as <em>From: &lt;name&gt;</em> in outgoing emails.{' '}
                {profileFallbackName && (
                  <button
                    type="button"
                    className="text-primary font-medium hover:underline"
                    onClick={() => setSenderName(profileFallbackName)}
                  >
                    Reset to "{profileFallbackName}"
                  </button>
                )}
              </>
            )}
          >
            <input
              className={inputCls}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder={profileFallbackName || 'Your name'}
            />
          </Field>
          <Field
            label="Scheduling link"
            help='Calendly, Cal.com, etc. Used as the "Book a call" CTA in AI newsletters.'
          >
            <input
              type="url"
              className={inputCls}
              placeholder="https://calendly.com/your-handle/15min"
              value={schedulingUrl}
              onChange={(e) => setSchedulingUrl(e.target.value)}
            />
          </Field>
          <Field
            label="Email signature"
            full
            help={(
              <>
                Appended to AI newsletters + outreach drafts. Plain text — line breaks are kept.{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setSignatureBlock(buildDefaultSignature())}
                >
                  Rebuild from my profile
                </button>
              </>
            )}
          >
            <textarea
              className={textareaCls}
              placeholder={buildDefaultSignature() || 'Your Name\nYour Team\nYour Brokerage\n(555) 123-4567 · yoursite.com'}
              value={signatureBlock}
              onChange={(e) => setSignatureBlock(e.target.value)}
              rows={5}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <SaveButton saving={saving} disabled={marketingLoading} onClick={handleSave}>
          Save brand settings
        </SaveButton>
      </div>
    </SectionShell>
  );
}

// ── 3. Annual goals ──────────────────────────────────────────────────

function GoalsSection() {
  const { goals, loading, save } = useCoachingGoals();
  const { toast } = useToast();
  const [gci, setGci] = useState('');
  const [closings, setClosings] = useState('');
  const [conversations, setConversations] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || hydrated) return;
    setGci(goals.annual_gci_goal != null ? String(goals.annual_gci_goal) : '');
    setClosings(goals.annual_closings_goal != null ? String(goals.annual_closings_goal) : '');
    setConversations(goals.annual_conversations_goal != null ? String(goals.annual_conversations_goal) : '');
    setHydrated(true);
  }, [loading, hydrated, goals]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await save({
      annual_gci_goal: gci.trim() === '' ? null : Number(gci),
      annual_closings_goal: closings.trim() === '' ? null : Math.round(Number(closings)),
      annual_conversations_goal: conversations.trim() === '' ? null : Math.round(Number(conversations)),
    });
    setSaving(false);
    toast({
      title: ok ? 'Goals saved' : "Couldn't save goals",
      description: ok ? 'Your Scoreboard now shows pace + goal line.' : 'Try again in a moment.',
      variant: ok ? 'default' : 'destructive',
    });
  };

  return (
    <SectionShell
      id="goals"
      title="Annual goals"
      description="Self-set targets for the year. Drives the pace projection + goal line on your Scoreboard. Leave any field blank to hide that target."
    >
      {!hydrated ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Annual GCI ($)" help='e.g. "120000" for $120K.'>
              <input type="number" inputMode="decimal" className={inputCls} placeholder="120000" value={gci} onChange={(e) => setGci(e.target.value)} min="0" />
            </Field>
            <Field label="Annual closings (count)" help="Total closings you want this year.">
              <input type="number" inputMode="numeric" className={inputCls} placeholder="24" value={closings} onChange={(e) => setClosings(e.target.value)} min="0" step="1" />
            </Field>
            <Field label="Annual conversations" help="Drives the goal line on the trajectory chart (annual ÷ 52).">
              <input type="number" inputMode="numeric" className={inputCls} placeholder="1500" value={conversations} onChange={(e) => setConversations(e.target.value)} min="0" step="1" />
            </Field>
          </div>
          <div className="flex justify-end mt-5">
            <SaveButton saving={saving} onClick={handleSave}>
              Save goals
            </SaveButton>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ── 4. Notifications ─────────────────────────────────────────────────

const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain — Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function NotificationsSection() {
  const { prefs, loading, save } = useNotificationPrefs();
  const { toast } = useToast();
  const [timezone, setTimezone] = useState('America/New_York');
  const [reminderDay, setReminderDay] = useState(5);
  const [quietStart, setQuietStart] = useState(21);
  const [quietEnd, setQuietEnd] = useState(7);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || hydrated) return;
    setTimezone(prefs.timezone);
    setReminderDay(prefs.reminder_day);
    setQuietStart(prefs.quiet_hours_start);
    setQuietEnd(prefs.quiet_hours_end);
    setNotifyEmail(prefs.notify_email);
    setNotifyInApp(prefs.notify_in_app);
    setHydrated(true);
  }, [loading, hydrated, prefs]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await save({
      timezone,
      reminder_day: reminderDay,
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
    });
    setSaving(false);
    toast({
      title: ok ? 'Notifications saved' : "Couldn't save",
      description: ok ? 'Reminders will land in your local timezone.' : 'Try again in a moment.',
      variant: ok ? 'default' : 'destructive',
    });
  };

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
  };

  return (
    <SectionShell
      id="notifications"
      title="Notifications"
      description="Where and when reminders reach you. Quiet hours pause Coach pings and SphereSync task drops in your local time."
    >
      {!hydrated ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Timezone" help="All reminders are delivered in this timezone.">
              <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weekly check-in reminder" help="The day your Scoreboard reminder lands.">
              <select className={inputCls} value={reminderDay} onChange={(e) => setReminderDay(Number(e.target.value))}>
                {DAY_NAMES.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quiet hours start" help="No reminders after this hour.">
              <select className={inputCls} value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quiet hours end" help="Reminders resume at this hour.">
              <select className={inputCls} value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <label className="inline-flex items-center gap-2 text-sm text-reop-dark-blue cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
              />
              <span>Email me reminders + Coach nudges.</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-reop-dark-blue cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={notifyInApp}
                onChange={(e) => setNotifyInApp(e.target.checked)}
              />
              <span>Show in-app reminders + Coach action items.</span>
            </label>
          </div>

          <div className="flex justify-end mt-5">
            <SaveButton saving={saving} onClick={handleSave}>
              Save notifications
            </SaveButton>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ── 6. Security ──────────────────────────────────────────────────────

function SecuritySection() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [resetSending, setResetSending] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast({
        title: 'No email on file',
        description: 'Contact support to update your password.',
        variant: 'destructive',
      });
      return;
    }
    setResetSending(true);
    try {
      // Lazy import to avoid pulling supabase client into the top of the file.
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      toast({
        title: 'Password reset email sent',
        description: `Check ${user.email} for a link to set a new password.`,
      });
    } catch (err) {
      toast({
        title: 'Could not send reset email',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setResetSending(false);
    }
  };

  return (
    <SectionShell
      id="security"
      title="Security"
      description="Manage your password, sign out everywhere, or request account deletion."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold text-reop-dark-blue">Reset password</div>
            <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
              We'll email a secure link to <span className="font-medium text-reop-dark-blue">{user?.email || 'your inbox'}</span>.
            </p>
          </div>
          <button
            onClick={handlePasswordReset}
            disabled={resetSending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-muted/50 transition disabled:opacity-60"
          >
            {resetSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {resetSending ? 'Sending…' : 'Send reset email'}
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap pt-4 border-t border-border">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold text-reop-dark-blue">Sign out</div>
            <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
              End this session on this device.
            </p>
          </div>
          <button
            onClick={() => signOut?.()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-muted/50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap pt-4 border-t border-border">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold text-reop-dark-blue">Delete account</div>
            <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
              Permanent, irreversible. Ask the team to remove your account and all associated data.
            </p>
          </div>
          <a
            href="mailto:support@realestateonpurpose.com?subject=Delete%20my%20account"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-destructive/30 bg-card text-sm font-semibold text-destructive hover:bg-destructive/5 transition"
          >
            Email support
          </a>
        </div>
      </div>
    </SectionShell>
  );
}

// ── 7. Data & export ─────────────────────────────────────────────────

function DataExportSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);
  const [fullExporting, setFullExporting] = useState(false);

  // Complete data export — maps to T&C §19 ("Customer may request export
  // of certain Customer Data during the subscription term"). Calls the
  // `export-my-data` edge function which bundles every agent-scoped table
  // into one JSON document. The function is verify_jwt:true and runs
  // every query through RLS, so we only get the caller's own rows.
  const downloadFullExport = async () => {
    if (!user?.id) return;
    setFullExporting(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not signed in');
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
        ?? 'https://cguoaokqwgqvzkqqezcq.supabase.co';
      const res = await fetch(`${supabaseUrl}/functions/v1/export-my-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          // Pass the anon key too — Supabase Edge Functions require it
          // alongside the user token for verify_jwt routing.
          apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Export failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `reop-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: 'Your full data bundle has downloaded.' });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setFullExporting(false);
    }
  };

  const downloadCsv = async (kind: 'contacts' | 'check_ins' | 'newsletters') => {
    if (!user?.id) return;
    setExporting(kind);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      let rows: Record<string, unknown>[] = [];
      let filename = '';
      if (kind === 'contacts') {
        const { data, error } = await supabase
          .from('contacts')
          .select('first_name, last_name, email, phone_number, address_1, address_2, city, state, zip_code, notes, created_at')
          .eq('agent_id', user.id);
        if (error) throw error;
        rows = data ?? [];
        filename = 'contacts.csv';
      } else if (kind === 'check_ins') {
        const { data, error } = await supabase
          .from('coaching_submissions')
          .select(
            'week_ending, conversations, appointments_set, appointments_held, agreements_signed, offers_made_accepted, closings, closing_amount, dials_made, database_size, energy_rating, focus_rating, confidence_rating, focus_areas, must_do_task, challenges, coaching_notes, created_at',
          )
          .eq('agent_id', user.id)
          .order('week_ending', { ascending: false });
        if (error) throw error;
        rows = data ?? [];
        filename = 'check-ins.csv';
      } else {
        // RLS on newsletter_campaigns gates by created_by — match it.
        const { data, error } = await supabase
          .from('newsletter_campaigns')
          .select('campaign_name, subject, send_date, scheduled_at, recipient_count, open_rate, click_through_rate, status, created_at')
          .eq('created_by', user.id)
          .order('send_date', { ascending: false, nullsFirst: false });
        if (error) throw error;
        rows = data ?? [];
        filename = 'newsletters.csv';
      }
      if (rows.length === 0) {
        toast({
          title: 'Nothing to export',
          description: 'No records found yet.',
        });
        return;
      }
      const headers = Object.keys(rows[0]);
      const escape = (v: unknown) => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: `${rows.length} rows downloaded.` });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  const items: { key: 'contacts' | 'check_ins' | 'newsletters'; title: string; sub: string }[] = [
    { key: 'contacts', title: 'Contacts (CSV)', sub: 'Every contact in your database, with phone, email, and address.' },
    { key: 'check_ins', title: 'Check-ins (CSV)', sub: 'Every weekly Scoreboard check-in you’ve submitted.' },
    { key: 'newsletters', title: 'Newsletter history (CSV)', sub: 'Subject lines, send dates, and recipient counts.' },
  ];

  return (
    <SectionShell
      id="data"
      title="Data & export"
      description="Your data is yours. Download a copy whenever you need it."
    >
      <div className="flex flex-col gap-2.5">
        {items.map((it) => (
          <div key={it.key} className="flex items-start justify-between gap-4 flex-wrap py-3 border-b border-border last:border-b-0">
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-semibold text-reop-dark-blue">{it.title}</div>
              <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">{it.sub}</p>
            </div>
            <button
              onClick={() => downloadCsv(it.key)}
              disabled={exporting === it.key}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-muted/50 transition disabled:opacity-60"
            >
              {exporting === it.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting === it.key ? 'Exporting…' : 'Download'}
            </button>
          </div>
        ))}
      </div>

      {/* Complete account-wide JSON bundle — separate from the per-table
          CSV exports above. Heavier (single ~JSON file with every row
          across every agent-scoped table) and aligned to T&C §19 for
          regulatory/data-portability requests. */}
      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-reop-teal-soft/40 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-semibold text-reop-dark-blue">
              Complete account export (JSON)
            </div>
            <p className="text-[12.5px] text-muted-foreground leading-snug mt-1">
              One bundled JSON file containing every row in the database scoped to your account —
              profile, contacts, activities, opportunities, coaching, events, email logs, and more.
              Use this for backup, migration, or a data-portability request.
              See{' '}
              <a href="/terms" target="_blank" rel="noopener" className="text-primary hover:underline font-medium">
                T&amp;C §19
              </a>{' '}
              for retention details.
            </p>
          </div>
          <button
            onClick={downloadFullExport}
            disabled={fullExporting}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-reop-teal-hover transition disabled:opacity-60"
          >
            {fullExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {fullExporting ? 'Building bundle…' : 'Download everything'}
          </button>
        </div>
      </div>
    </SectionShell>
  );
}

// ── Page shell ───────────────────────────────────────────────────────

export default function Settings() {
  const [activeRail, setActiveRail] = useState<RailKey>('profile');

  return (
    <>
      <Helmet>
        <title>Settings — Real Estate on Purpose</title>
      </Helmet>
      <Layout>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <span className="eye-label block mb-1.5">Settings</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              Tune your Hub.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              The control center for your profile, brand, AI voice, reminders, and account. Most of the Hub reads from here.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="flex flex-col gap-0.5">
              {railItems.map((it) => {
                const Icon = it.icon;
                return (
                  <a
                    key={it.id}
                    href={`#${it.id}`}
                    onClick={() => setActiveRail(it.id)}
                    className={cn(
                      'flex gap-2.5 items-center px-3.5 py-[9px] rounded-lg text-[13px] text-left transition',
                      activeRail === it.id
                        ? 'bg-reop-teal-soft text-primary font-semibold'
                        : 'text-reop-dark-blue hover:bg-[hsl(210_20%_96%)]',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {it.label}
                  </a>
                );
              })}
            </div>
          </aside>

          <div>
            <ProfileSection />
            <BrandSection />
            <GoalsSection />
            <NotificationsSection />
            <div id="billing" className="mb-[18px] scroll-mt-6">
              <SubscriptionSettings />
            </div>
            <SecuritySection />
            <DataExportSection />
          </div>
        </div>
      </Layout>
    </>
  );
}
