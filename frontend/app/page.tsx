import Link from 'next/link';

// Public marketing site — the first thing any visitor sees. Carries the
// same dark-ledger brand as the authenticated platforms (brass on ink,
// Fraunces display serif) rather than a generic SaaS look, since that
// premium/private-bank identity is the point for a UHNI wealth product.
//
// Advisor-only front door: client login is a real, working route
// (/login/client — nothing about the client portal itself changed), but
// it isn't marketed here. This site's audience is the firm evaluating
// or buying the platform, not their end clients.
export default function LandingPage() {
  return (
    <div className="bg-ink-950 text-ink-100">
      <SiteHeader />
      <Hero />
      <Proof />
      <Capabilities />
      <WhyItMatters />
      <ClosingCta />
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
          <a href="#capabilities" className="hover:text-ink-100">What it does</a>
          <a href="#why" className="hover:text-ink-100">Why it matters</a>
          <a href="#contact" className="hover:text-ink-100">Contact</a>
        </nav>
        <div className="flex gap-3">
          <Link href="/login/advisor" className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink-100 transition hover:border-brass-500">
            Sign in
          </Link>
          <Link href="/login/advisor/signup" className="rounded-sm bg-brass-500 px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-brass-400">
            Set up your firm
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-10rem] h-[30rem] bg-[radial-gradient(ellipse_at_top,_rgba(185,139,46,0.16),_transparent_65%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass-400">Multi-entity wealth intelligence</p>
        <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl leading-tight text-ink-100 md:text-6xl">
          The wealth engine built for family offices and private client teams
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-300">
          WealthMatrix consolidates net worth across people, trusts, and holding companies,
          flags risk and compliance issues in real time, and gives every household a clear,
          auditable picture — the layered ownership structures a flat spreadsheet can&apos;t follow.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/login/advisor/signup" className="rounded-sm bg-brass-500 px-6 py-3 text-sm font-medium text-ink-950 transition hover:bg-brass-400">
            Set up your firm
          </Link>
          <Link href="/login/advisor" className="rounded-sm border border-hairline px-6 py-3 text-sm text-ink-100 transition hover:border-brass-500">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

const PROOF_POINTS = [
  { value: 'Every household', label: 'consolidated across people, trusts & holding companies' },
  { value: 'Zero guesswork', label: 'AI narrates already-computed numbers — never invents one' },
  { value: 'Row-level isolation', label: 'one adviser can never see another firm\'s data, enforced in the database itself' },
  { value: 'End to end', label: 'fact find to compliance log to client report, one platform' },
];

function Proof() {
  return (
    <section className="border-y border-hairline bg-ink-900/40 py-14">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROOF_POINTS.map((p) => (
          <div key={p.value} className="text-center">
            <p className="font-display text-xl text-brass-400">{p.value}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-300">{p.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const CAPABILITIES = [
  {
    title: 'Net worth, consolidated',
    description: 'Every person, trust, and holding company rolled up into one FX-aware view — proportional ownership attributed correctly, not flattened into a spreadsheet that can\'t follow the structure.',
  },
  {
    title: 'AI Wealth Analyst',
    description: 'Leverage, concentration, liquidity, currency exposure, and suitability drift — colour-coded, with a plain-English note on each. The numbers are always computed deterministically first; AI only ever narrates them.',
  },
  {
    title: 'Live compliance monitoring',
    description: 'Automatic breach detection against firm-defined thresholds, with an audit trail built for an FCA review and one-click exports.',
  },
  {
    title: 'Entity structure maps',
    description: 'A visual ownership graph across people and entities, with NAV and effective ownership on hover — the exact ownership chain, not an approximation.',
  },
  {
    title: 'Scenario modelling',
    description: 'Project the impact of a business sale, an inheritance, or a relocation on net worth, tax, and liquidity — before advising on it, not after.',
  },
  {
    title: 'Document intake, automated',
    description: 'Upload a fact find, ID, or bank statement — the platform reads it, fills what it safely can, and flags exactly what still needs a human.',
  },
  {
    title: 'Client call transcription',
    description: 'Live transcription and real-time suggestions during a client call, with auto-fill into the fact find afterwards.',
  },
  {
    title: 'Enterprise reporting',
    description: 'Household, entity, scenario, and adviser-performance reports — viewable in-app or exported to a clean, client-ready PDF.',
  },
  {
    title: 'Role-based access, enforced twice',
    description: 'Admins see the whole book; advisers see only their assigned households; clients see only their own — checked in the application AND at the database row level.',
  },
];

function Capabilities() {
  return (
    <section id="capabilities" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="What it does" title="Everything a wealth team actually uses" />
        <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <div key={c.title} className="border-l-2 border-brass-500/40 pl-5">
              <p className="font-mono text-xs text-brass-400">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-display text-base text-ink-100">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyItMatters() {
  return (
    <section id="why" className="border-t border-hairline bg-ink-900/40 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <SectionHeading eyebrow="Why it matters" title="Built for structures a flat platform can't follow" />
        <p className="mt-6 text-sm leading-relaxed text-ink-300">
          Family offices and private wealth teams manage net worth that lives across people, trusts,
          and layers of holding companies. A spreadsheet — or a platform designed around a single flat
          list of accounts — simply can&apos;t walk that ownership graph correctly. WealthMatrix was built
          to attribute value proportionally through the real structure, surface risk and compliance
          issues before they become findings, and give an adviser one auditable answer for
          &quot;what does this household actually own,&quot; not an approximation.
        </p>
        <div className="mt-10 grid gap-6 text-left sm:grid-cols-3">
          {[
            { title: 'For advisers', body: 'One screen per household — net worth, risk, compliance, and what to do next.' },
            { title: 'For family offices', body: 'Model trusts and holding companies exactly as they\'re structured, not flattened.' },
            { title: 'For compliance', body: 'A breach is logged and traceable the moment it crosses a threshold — no end-of-quarter surprise.' },
          ].map((a) => (
            <div key={a.title} className="rounded-sm border border-hairline bg-ink-900 p-5">
              <h4 className="font-display text-sm text-ink-100">{a.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-300">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section id="contact" className="py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <SectionHeading eyebrow="Get started" title="Bring your book onto WealthMatrix" />
        <p className="mt-6 text-sm leading-relaxed text-ink-300">
          Set up your firm in a minute — you&apos;ll be signed in as the first admin straight away.
          Questions first? Reach out and we&apos;ll walk you through it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/login/advisor/signup" className="rounded-sm bg-brass-500 px-6 py-3 text-sm font-medium text-ink-950 transition hover:bg-brass-400">
            Set up your firm
          </Link>
          <a
            href="mailto:hello@wealthmatrix.example"
            className="rounded-sm border border-hairline px-6 py-3 text-sm text-ink-100 transition hover:border-brass-500"
          >
            hello@wealthmatrix.example
          </a>
        </div>
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
          <Link href="/login/advisor" className="hover:text-ink-300">Sign in</Link>
          <Link href="/login/advisor/signup" className="hover:text-ink-300">Set up your firm</Link>
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
