import Link from 'next/link';

// Public marketing site — the first thing any visitor sees. Carries the
// same dark-ledger brand as the authenticated platforms (brass on ink,
// Fraunces display serif) rather than a generic SaaS look, since that
// premium/private-bank identity is the point for a UHNI wealth product.
export default function LandingPage() {
  return (
    <div className="bg-ink-950 text-ink-100">
      <SiteHeader />
      <Hero />
      <Services />
      <Features />
      <Pricing />
      <About />
      <Contact />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">WealthMatrix</p>
          <p className="font-display text-sm text-ink-300">Enterprise</p>
        </div>
        <nav className="hidden gap-8 text-sm text-ink-300 md:flex">
          <a href="#services" className="hover:text-ink-100">Services</a>
          <a href="#features" className="hover:text-ink-100">Features</a>
          <a href="#pricing" className="hover:text-ink-100">Pricing</a>
          <a href="#about" className="hover:text-ink-100">About</a>
          <a href="#contact" className="hover:text-ink-100">Contact</a>
        </nav>
        <div className="flex gap-3">
          <Link href="/login/client" className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink-100 transition hover:border-brass-500">
            Client Login
          </Link>
          <Link href="/login/advisor" className="rounded-sm bg-brass-500 px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-brass-400">
            Advisor Login
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass-400">Multi-entity wealth intelligence</p>
      <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl leading-tight text-ink-100 md:text-5xl">
        The wealth engine built for family offices and private client teams
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-300">
        WealthMatrix consolidates net worth across people, trusts, and holding companies,
        flags risk and compliance issues in real time, and gives every household a clear,
        auditable picture — the layered ownership structures a flat spreadsheet can&apos;t follow.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <Link href="/login/advisor" className="rounded-sm bg-brass-500 px-6 py-3 text-sm font-medium text-ink-950 transition hover:bg-brass-400">
          Advisor Login
        </Link>
        <Link href="/login/client" className="rounded-sm border border-hairline px-6 py-3 text-sm text-ink-100 transition hover:border-brass-500">
          Client Login
        </Link>
      </div>
    </section>
  );
}

const SERVICES = [
  {
    title: 'Wealth Management',
    description: 'Consolidated net worth across personal holdings and entity-attributed stakes, with FX-aware, multi-currency reporting for every household.',
  },
  {
    title: 'Family Office Tools',
    description: 'Model layered ownership through trusts, SPVs, and holding companies, and run what-if scenarios — a business sale, an inheritance, a relocation — before they happen.',
  },
  {
    title: 'Mortgage Adviser Tools',
    description: 'Surface leverage, liquidity, and concentration risk instantly, so lending conversations start from a verified picture of the client’s full financial position.',
  },
];

function Services() {
  return (
    <section id="services" className="border-t border-hairline bg-ink-900/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="What we do" title="Built for every seat at the table" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="rounded-sm border border-hairline bg-ink-900 p-6">
              <h3 className="font-display text-lg text-ink-100">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-300">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { title: 'AI Wealth Analyst', description: 'Leverage, concentration, liquidity, currency exposure, and suitability drift — colour-coded, with a plain-English note on each.' },
  { title: 'Live compliance monitoring', description: 'Automatic breach detection against firm-defined thresholds, with an FCA-ready audit trail and one-click exports.' },
  { title: 'Scenario modelling', description: 'Project the impact of a sale, inheritance, or relocation on net worth, tax, and liquidity before advising on it.' },
  { title: 'Entity structure maps', description: 'A visual ownership graph across people and entities, with NAV and effective ownership on hover.' },
  { title: 'Enterprise reporting', description: 'Household, entity, scenario, and adviser-performance reports — viewable in-app or exported to PDF.' },
  { title: 'Role-based access', description: 'Admins see the whole book; advisers see only their assigned households; clients see only their own — enforced end to end.' },
];

function Features() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="Why WealthMatrix" title="Everything a wealth team actually uses" />
        <div className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-l-2 border-brass-500/40 pl-4">
              <h3 className="text-sm font-medium uppercase tracking-wide text-ink-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { name: 'Starter', price: 'Contact us', blurb: 'For a single adviser getting a book of households onto one platform.', features: ['Up to 25 households', 'Core net worth & compliance', 'Email support'] },
  { name: 'Professional', price: 'Contact us', blurb: 'For growing advisory teams and family offices.', features: ['Unlimited households', 'AI Wealth Analyst', 'Scenario modelling', 'Priority support'], highlighted: true },
  { name: 'Enterprise', price: 'Contact us', blurb: 'For multi-adviser firms with bespoke compliance needs.', features: ['Everything in Professional', 'Custom compliance rules', 'Dedicated account manager', 'SLA & onboarding support'] },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-hairline bg-ink-900/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="Pricing" title="Plans for every size of book" />
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-500">
          Placeholder pricing — figures to be confirmed. Get in touch for a quote tailored to your firm.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-sm border p-6 ${p.highlighted ? 'border-brass-500 bg-ink-900' : 'border-hairline bg-ink-900/60'}`}
            >
              <h3 className="font-display text-lg text-ink-100">{p.name}</h3>
              <p className="mt-2 font-mono text-2xl text-brass-400">{p.price}</p>
              <p className="mt-3 text-sm text-ink-300">{p.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm text-ink-300">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-verdigris-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href="#contact" className="mt-6 block rounded-sm border border-hairline py-2 text-center text-sm text-ink-100 transition hover:border-brass-500">
                Get in touch
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <SectionHeading eyebrow="About us" title="Why we built WealthMatrix" />
        <p className="mt-6 text-sm leading-relaxed text-ink-300">
          Family offices and private wealth teams manage net worth that lives across
          people, trusts, and layers of holding companies — structures a flat-schema
          platform simply can&apos;t follow. WealthMatrix was built to walk that ownership
          graph correctly, attribute value proportionally, and surface risk and
          compliance issues before they become findings. It&apos;s the platform we wished
          existed when a spreadsheet stopped being enough.
        </p>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="border-t border-hairline bg-ink-900/40 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <SectionHeading eyebrow="Contact" title="Talk to us" />
        <p className="mt-6 text-sm leading-relaxed text-ink-300">
          Questions about WealthMatrix for your firm? Reach out and we&apos;ll get back to you.
        </p>
        <a
          href="mailto:hello@wealthmatrix.example"
          className="mt-6 inline-block rounded-sm bg-brass-500 px-6 py-3 text-sm font-medium text-ink-950 transition hover:bg-brass-400"
        >
          hello@wealthmatrix.example
        </a>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-hairline py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-xs text-ink-500 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} WealthMatrix Enterprise. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/login/advisor" className="hover:text-ink-300">Advisor Login</Link>
          <Link href="/login/client" className="hover:text-ink-300">Client Login</Link>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-400">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl text-ink-100 md:text-3xl">{title}</h2>
    </div>
  );
}
