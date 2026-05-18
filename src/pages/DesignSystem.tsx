import { ArrowRight, CheckCircle2, Clock, AlertCircle, Phone, Users, Target, BarChart3, TrendingUp, Briefcase, Award, Search } from "lucide-react";

const Swatch = ({ name, varName, hex }: { name: string; varName: string; hex?: string }) => (
  <div className="flex flex-col gap-2">
    <div
      className="h-20 w-full rounded-lg border border-border"
      style={{ backgroundColor: `hsl(var(${varName}))` }}
    />
    <div className="flex flex-col">
      <span className="text-sm font-semibold text-reop-dark-blue">{name}</span>
      <span className="text-xs text-muted-foreground font-mono">{varName}</span>
      {hex && <span className="text-xs text-muted-foreground font-mono">{hex}</span>}
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-14">
    <h2 className="text-xl font-medium border-b border-border pb-3 mb-6">{title}</h2>
    {children}
  </section>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 flex-wrap mb-4">
    <span className="font-mono text-xs text-muted-foreground w-32">{label}</span>
    {children}
  </div>
);

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-background text-foreground p-14 max-w-[1280px] mx-auto">
      <span className="eye-label">Design system preview</span>
      <h1 className="text-4xl font-medium tracking-tighter mt-1 mb-2">REOP Tokens</h1>
      <p className="text-muted-foreground max-w-xl mb-12">
        Visual verification of the design system tokens — colors, type, and core components.
        This page renders pure Tailwind utilities driven by the CSS variables in <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">src/index.css</code>.
      </p>

      <Section title="Brand colors">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Swatch name="Primary (teal)" varName="--primary" hex="#00a2ad" />
          <Swatch name="Secondary (dark blue)" varName="--secondary" hex="#005d6c" />
          <Swatch name="Accent (green)" varName="--accent" hex="#99ca3c" />
          <Swatch name="Background" varName="--background" hex="#F8F9FA" />
        </div>
      </Section>

      <Section title="Status & neutral">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Swatch name="Destructive" varName="--destructive" />
          <Swatch name="Warning" varName="--warning" />
          <Swatch name="Positive" varName="--positive" />
          <Swatch name="Muted" varName="--muted" />
          <Swatch name="Border" varName="--border" />
          <Swatch name="Foreground" varName="--foreground" />
          <Swatch name="Sidebar bg" varName="--sidebar-background" />
          <Swatch name="REOP teal-soft" varName="--reop-teal-soft" />
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-4">
          <p className="text-7xl font-medium tracking-tighter">Display 7xl</p>
          <p className="text-5xl font-medium tracking-tighter">Heading 5xl</p>
          <h1>h1 — Build a business that loves you back</h1>
          <h2>h2 — The agent operating system</h2>
          <h3>h3 — SphereSync, Pipeline, Database</h3>
          <h4>h4 — Section subhead</h4>
          <p className="text-base">Body — Inter 400, line-height 1.5. The quick brown fox jumps over the lazy dog.</p>
          <p className="text-sm text-muted-foreground">Small / muted — Inter 400, 14px.</p>
          <span className="eye-label">Eyebrow label</span>
        </div>
      </Section>

      <Section title="Buttons">
        <Row label="primary">
          <button className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-reop-teal-hover transition">
            Get Your Free Success Analysis <ArrowRight className="w-4 h-4" />
          </button>
          <button className="inline-flex items-center gap-2 h-14 px-7 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-reop-teal-hover transition">
            Schedule Strategy Session <ArrowRight className="w-4 h-4" />
          </button>
          <button className="inline-flex items-center h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-reop-teal-hover transition">
            Book a call
          </button>
        </Row>
        <Row label="secondary">
          <button className="inline-flex items-center h-11 px-5 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm">Learn More</button>
          <button className="inline-flex items-center h-11 px-5 rounded-lg border border-border text-reop-dark-blue font-semibold text-sm hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition">View Plans</button>
          <button className="inline-flex items-center h-11 px-5 rounded-lg text-reop-dark-blue font-semibold text-sm hover:bg-reop-teal-soft transition">Skip</button>
          <button className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition">
            <Phone className="w-4 h-4" />
          </button>
        </Row>
      </Section>

      <Section title="Badges & pills">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">Default</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-reop-dark-blue">Secondary</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-border text-reop-dark-blue">Outline</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[hsl(142_71%_94%)] text-[hsl(142_71%_28%)]"><CheckCircle2 className="w-3 h-3" />Live</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[hsl(45_93%_93%)] text-[hsl(35_80%_32%)]"><Clock className="w-3 h-3" />Stale</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[hsl(0_84%_95%)] text-[hsl(0_84%_40%)]"><AlertCircle className="w-3 h-3" />Overdue</span>
        </div>
      </Section>

      <Section title="Cards · Default">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Users, title: "Outreach Division", desc: "SphereSync™ weekly call lists, e-newsletters, and done-for-you Client Events." },
            { icon: Target, title: "Conversion Division", desc: "Buyer & Seller Blueprints with automated nurturing across the pipeline." },
            { icon: BarChart3, title: "Performance Division", desc: "The Agent Success Scoreboard™ tracks weekly habits and outcomes." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-lg p-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-reop-teal-soft text-primary mb-4">
                <Icon className="w-7 h-7" strokeWidth={1.75} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Card · KPI tile">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-start"><span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Active Pipeline</span><Briefcase className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-[32px] font-semibold text-reop-dark-blue mt-3 mb-1 leading-none">$2.4M</div>
            <div className="text-xs text-positive flex items-center gap-1"><TrendingUp className="w-3 h-3" />+18% vs last wk</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-start"><span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Calls This Week</span><Phone className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-[32px] font-semibold text-reop-dark-blue mt-3 mb-1 leading-none">42 / 50</div>
            <div className="text-xs text-muted-foreground">84% complete</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-start"><span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Sphere Touched</span><Users className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-[32px] font-semibold text-reop-dark-blue mt-3 mb-1 leading-none">1,287</div>
            <div className="text-xs text-positive flex items-center gap-1"><TrendingUp className="w-3 h-3" />+12 this wk</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-start"><span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Priorities</span><Award className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-[32px] font-semibold text-reop-dark-blue mt-3 mb-1 leading-none">25</div>
            <div className="text-xs text-muted-foreground">8 pipeline · 12 cadence · 5 engaged</div>
          </div>
        </div>
      </Section>

      <Section title="Form input">
        <div className="max-w-md">
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            placeholder="you@brokerage.com"
            className="block w-full h-10 px-3 border border-border rounded-lg bg-card text-sm text-reop-dark-blue focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
          <p className="text-xs text-muted-foreground mt-2">We'll send your weekly Coach narrative here every Monday.</p>
        </div>
      </Section>

      <Section title="Search input">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search contacts, opportunities, events..."
            className="w-full h-10 pl-9 pr-3 border border-border rounded-lg bg-card text-sm text-reop-dark-blue focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
      </Section>

      <Section title="Shadow · primary glow">
        <div className="bg-card rounded-lg p-6 shadow-primary-glow border border-border max-w-sm">
          <p className="text-sm text-reop-dark-blue">A card using <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">shadow-primary-glow</code> — soft teal halo for elevated surfaces.</p>
        </div>
      </Section>
    </div>
  );
}
