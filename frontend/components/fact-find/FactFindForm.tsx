'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { Field, TextInput, TextAreaInput, SelectInput, YesNoToggle, CheckboxRow, SectionCard, RepeatingRows } from './fields';
import type { FactFind, RiskQuestion } from '@/lib/types';

const REVIEW_PURPOSES = [
  'Annual review of current arrangements',
  'Review of existing pension plans',
  'Establish a new pension/investment plan',
  'Retirement planning review',
  'Inheritance planning review',
  'Review/establish protection arrangements',
  'Consolidate investments with a single provider',
  'Other',
];

const FREQUENCIES = [{ value: 'annual', label: 'Annual' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'one_off', label: 'One-off' }];

const SECTIONS = [
  'Purposes & Objectives', 'Personal Circumstances', 'Income & Expenditure', 'Assets', 'Liabilities',
  'Insurance', 'Investment Questions', 'Retirement Questions', 'Risk Profile', 'Declaration',
] as const;

function empty<T extends Record<string, any>>(shape: T): T { return { ...shape }; }

function defaultData(): Omit<FactFind, 'id' | 'householdId' | 'status' | 'riskScore' | 'riskCategory' | 'createdBy' | 'createdAt' | 'updatedAt' | 'completedOn' | 'signedOn'> {
  return {
    reviewPurposes: { selected: [], otherDetails: '', reviewNotes: '' },
    personalCircumstances: {
      healthStatus: 'good', healthExplain: '',
      affectsUnderstanding: false, affectsUnderstandingDetails: '',
      needsAdditionalSupport: false, additionalSupportDetails: '', additionalSupportProvided: '',
      vulnerabilityNotes: '', smoker: false,
      maritalStatus: 'single', partnerName: '', partnerDOB: '', partnerSex: '', partnerOccupation: '',
      hasWill: false, spouseCommunicationConsent: false,
      poaOverAffairs: false, poaDetails: '', isPEP: false,
      dependents: [] as { name: string; dob: string; relation: string; yearsUntilIndependent: string }[],
    },
    incomeExpenditure: {
      client: { employmentStatus: 'employed', sources: [], taxStatus: 'basic_rate', expenditure: [], notes: '' },
      partner: { employmentStatus: 'employed', sources: [], taxStatus: 'basic_rate', expenditure: [], notes: '' },
    },
    assets: { nonPension: [], pensions: [], notes: '' },
    liabilities: { items: [], notes: '' },
    insurance: { hasLifeInsurance: false, whyNot: '', policies: [], notes: '' },
    investmentQuestions: {
      hasOtherAdvisor: false, otherAdvisorDetails: '', lastReviewDate: '', specialRequirements: '',
      investmentObjectives: '', prefersPassive: false, prefersActive: false, notes: '',
      reflectsRiskAppetite: 'not_sure', withdrawalIntends: false, withdrawalType: '', withdrawalAmount: '', withdrawalWhen: '',
      expectsLumpSum: false, lumpSumSource: '', lumpSumWhen: '',
    },
    retirementQuestions: {
      minMonthlyIncomeRequirement: '', selfFullStatePension: true, selfYearsWorked: '', selfExpectedAmount: '',
      partnerFullStatePension: true, partnerYearsWorked: '', partnerExpectedAmount: '',
      pensionIntention: 'not_sure', reasoning: '',
    },
    riskCapacity: { assessmentBasis: 'personal', netWorthExclHome: '', monthlyDisposableIncome: '', withdrawalHorizon: '' },
    riskQuestionnaire: [],
    declaration: { infoAccurate: false, termsAccepted: false, completionMethod: 'face_to_face', fullName: '' },
  };
}

export function FactFindForm({
  householdId, factFind, riskQuestions,
}: {
  householdId: string;
  factFind: FactFind | null;
  riskQuestions: RiskQuestion[];
}) {
  const initial = factFind ?? { ...defaultData(), status: 'draft' as const, id: '', riskScore: null, riskCategory: null, completedOn: null, signedOn: null };
  const [section, setSection] = useState<number>(0);
  const [purposes, setPurposes] = useState(initial.reviewPurposes);
  const [personal, setPersonal] = useState(initial.personalCircumstances);
  const [incomeExpenditure, setIncomeExpenditure] = useState(initial.incomeExpenditure);
  const [assets, setAssets] = useState(initial.assets);
  const [liabilities, setLiabilities] = useState(initial.liabilities);
  const [insurance, setInsurance] = useState(initial.insurance);
  const [investmentQ, setInvestmentQ] = useState(initial.investmentQuestions);
  const [retirementQ, setRetirementQ] = useState(initial.retirementQuestions);
  const [riskCapacity, setRiskCapacity] = useState(initial.riskCapacity);
  const [riskAnswers, setRiskAnswers] = useState<{ questionKey: string; selectedOption: string }[]>(initial.riskQuestionnaire ?? []);
  const [declaration, setDeclaration] = useState(initial.declaration);
  const [completedOn, setCompletedOn] = useState(initial.completedOn ?? '');
  const [riskScore, setRiskScore] = useState(initial.riskScore);
  const [riskCategory, setRiskCategory] = useState(initial.riskCategory);
  const [status, setStatus] = useState(initial.status);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [id, setId] = useState(factFind?.id ?? null);

  function buildPayload(nextStatus: 'draft' | 'completed' | undefined, effectiveCompletedOn: string) {
    return {
      status: nextStatus ?? status,
      reviewPurposes: purposes,
      personalCircumstances: personal,
      incomeExpenditure,
      assets,
      liabilities,
      insurance,
      investmentQuestions: investmentQ,
      retirementQuestions: retirementQ,
      riskCapacity,
      riskQuestionnaire: riskAnswers,
      declaration,
      completedOn: effectiveCompletedOn || undefined,
    };
  }

  async function save(nextStatus?: 'draft' | 'completed') {
    setSaving(true);
    setSaveMessage(null);
    // Marking completed without ever having set a completion date is the
    // common case (the Declaration section is easy to skip) — default it
    // to today rather than silently leaving completedOn null.
    const effectiveCompletedOn = nextStatus === 'completed' && !completedOn ? new Date().toISOString().slice(0, 10) : completedOn;
    try {
      const payload = buildPayload(nextStatus, effectiveCompletedOn);
      const saved = id
        ? await api.patch<FactFind>(`households/${householdId}/fact-finds/${id}`, payload)
        : await api.post<FactFind>(`households/${householdId}/fact-finds`, payload);
      setId(saved.id);
      setStatus(saved.status);
      setRiskScore(saved.riskScore);
      setRiskCategory(saved.riskCategory);
      setCompletedOn(saved.completedOn ?? effectiveCompletedOn);
      setSaveMessage(saved.status === 'completed' ? 'Fact find completed and saved.' : 'Draft saved.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const [meetingNotes, setMeetingNotes] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [notesExpanded, setNotesExpanded] = useState(false);

  async function parseNotes() {
    setParsing(true);
    setParseError(null);
    try {
      const res = await api.post<{ parsed: Record<string, any> | null; error: string | null }>('ai/fact-find-parse', { notes: meetingNotes });
      if (res.error || !res.parsed) {
        setParseError(res.error ?? 'Could not parse these notes.');
        return;
      }
      const p = res.parsed;
      if (p.reviewPurposes) setPurposes((prev: any) => ({ ...prev, ...p.reviewPurposes }));
      if (p.personalCircumstances) setPersonal((prev: any) => ({ ...prev, ...p.personalCircumstances }));
      if (p.incomeExpenditure) {
        setIncomeExpenditure((prev: any) => ({
          client: { ...prev.client, ...(p.incomeExpenditure.client ?? {}) },
          partner: { ...prev.partner, ...(p.incomeExpenditure.partner ?? {}) },
        }));
      }
      if (p.assets) setAssets((prev: any) => ({ ...prev, ...p.assets }));
      if (p.liabilities) setLiabilities((prev: any) => ({ ...prev, ...p.liabilities }));
      if (p.insurance) setInsurance((prev: any) => ({ ...prev, ...p.insurance }));
      if (p.investmentQuestions) setInvestmentQ((prev: any) => ({ ...prev, ...p.investmentQuestions }));
      if (p.retirementQuestions) setRetirementQ((prev: any) => ({ ...prev, ...p.retirementQuestions }));
      setGaps(Array.isArray(p.gaps) ? p.gaps : []);
      setSection(0);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse these notes.');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-4">
    <Card>
      <button type="button" onClick={() => setNotesExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs uppercase tracking-wide text-brass-400">Pre-fill from meeting notes (AI)</span>
        <span className="text-xs text-ink-500">{notesExpanded ? 'Hide' : 'Show'}</span>
      </button>
      {notesExpanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink-400">
            Paste your meeting notes or call transcript below. AI will pre-fill the sections it can from what's
            actually said — it will not guess at the Attitude-to-Risk questionnaire or invent anything not
            mentioned; anything missing gets listed below for you to follow up on.
          </p>
          <textarea
            value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} rows={8}
            placeholder="e.g. Met with the client today. They're recently retired, married to Karen (61)..."
            className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
          />
          <Button className="px-4 py-2 text-xs" onClick={parseNotes} disabled={parsing || meetingNotes.trim().length < 10}>
            {parsing ? 'Parsing…' : 'Parse & pre-fill'}
          </Button>
          {parseError && <p className="text-xs text-rust-400">{parseError}</p>}
          {gaps.length > 0 && (
            <div className="rounded-sm border border-brass-500/40 bg-brass-500/10 p-3">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-brass-400">Still needs follow-up</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-300">
                {gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
    <div className="grid grid-cols-[220px_1fr] gap-6">
      <nav className="space-y-1">
        {SECTIONS.map((s, i) => (
          <button
            key={s} onClick={() => setSection(i)}
            className={`block w-full rounded-sm px-3 py-2 text-left text-sm ${section === i ? 'bg-brass-500/15 text-brass-400' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`}
          >
            {i + 1}. {s}
          </button>
        ))}
        <div className="mt-4 border-t border-hairline pt-4">
          <Badge tone={status === 'completed' ? 'positive' : 'draft'}>{status}</Badge>
        </div>
      </nav>

      <div className="space-y-4">
        {section === 0 && (
          <SectionCard title="1. Purposes & Objectives">
            <Field label="Purpose(s) of this review">
              <div className="space-y-1">
                {REVIEW_PURPOSES.map((p) => (
                  <CheckboxRow
                    key={p} label={p}
                    checked={(purposes.selected ?? []).includes(p)}
                    onChange={(checked) => setPurposes((prev: any) => ({
                      ...prev,
                      selected: checked ? [...(prev.selected ?? []), p] : (prev.selected ?? []).filter((x: string) => x !== p),
                    }))}
                  />
                ))}
              </div>
            </Field>
            <Field label="Other — details"><TextInput value={purposes.otherDetails ?? ''} onChange={(v) => setPurposes((p: any) => ({ ...p, otherDetails: v }))} /></Field>
            <Field label="Notes (meeting date, attendees, relevant details)">
              <TextAreaInput value={purposes.reviewNotes ?? ''} onChange={(v) => setPurposes((p: any) => ({ ...p, reviewNotes: v }))} />
            </Field>
          </SectionCard>
        )}

        {section === 1 && (
          <SectionCard title="2. Personal Circumstances">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Health status">
                <SelectInput value={personal.healthStatus} onChange={(v) => setPersonal((p: any) => ({ ...p, healthStatus: v }))}
                  options={[{ value: 'good', label: 'Good' }, { value: 'bad', label: 'Bad' }, { value: 'other', label: 'Other' }]} />
              </Field>
              <Field label="If bad/other, explain"><TextInput value={personal.healthExplain} onChange={(v) => setPersonal((p: any) => ({ ...p, healthExplain: v }))} /></Field>
            </div>
            <Field label="Does anything affect their ability to understand advice, make decisions, or communicate them?">
              <YesNoToggle value={personal.affectsUnderstanding} onChange={(v) => setPersonal((p: any) => ({ ...p, affectsUnderstanding: v }))} />
            </Field>
            {personal.affectsUnderstanding && <Field label="Details"><TextInput value={personal.affectsUnderstandingDetails} onChange={(v) => setPersonal((p: any) => ({ ...p, affectsUnderstandingDetails: v }))} /></Field>}
            <Field label="Needs additional support to understand our advice?">
              <YesNoToggle value={personal.needsAdditionalSupport} onChange={(v) => setPersonal((p: any) => ({ ...p, needsAdditionalSupport: v }))} />
            </Field>
            {personal.needsAdditionalSupport && (
              <>
                <Field label="Details"><TextInput value={personal.additionalSupportDetails} onChange={(v) => setPersonal((p: any) => ({ ...p, additionalSupportDetails: v }))} /></Field>
                <Field label="Additional support provided"><TextInput value={personal.additionalSupportProvided} onChange={(v) => setPersonal((p: any) => ({ ...p, additionalSupportProvided: v }))} /></Field>
              </>
            )}
            <Field label="Vulnerability notes"><TextAreaInput value={personal.vulnerabilityNotes} onChange={(v) => setPersonal((p: any) => ({ ...p, vulnerabilityNotes: v }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Smoker?"><YesNoToggle value={personal.smoker} onChange={(v) => setPersonal((p: any) => ({ ...p, smoker: v }))} /></Field>
              <Field label="Marital status">
                <SelectInput value={personal.maritalStatus} onChange={(v) => setPersonal((p: any) => ({ ...p, maritalStatus: v }))}
                  options={['single', 'married', 'divorced', 'widowed', 'partnership'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
              </Field>
            </div>
            {(personal.maritalStatus === 'married' || personal.maritalStatus === 'partnership') && (
              <div className="grid grid-cols-2 gap-4 rounded-sm border border-hairline/60 p-3 md:grid-cols-4">
                <Field label="Partner name"><TextInput value={personal.partnerName} onChange={(v) => setPersonal((p: any) => ({ ...p, partnerName: v }))} /></Field>
                <Field label="Partner DOB"><TextInput type="date" value={personal.partnerDOB} onChange={(v) => setPersonal((p: any) => ({ ...p, partnerDOB: v }))} /></Field>
                <Field label="Partner sex"><TextInput value={personal.partnerSex} onChange={(v) => setPersonal((p: any) => ({ ...p, partnerSex: v }))} /></Field>
                <Field label="Partner occupation"><TextInput value={personal.partnerOccupation} onChange={(v) => setPersonal((p: any) => ({ ...p, partnerOccupation: v }))} /></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Has a will?"><YesNoToggle value={personal.hasWill} onChange={(v) => setPersonal((p: any) => ({ ...p, hasWill: v }))} /></Field>
              <Field label="Spouse comms consent?"><YesNoToggle value={personal.spouseCommunicationConsent} onChange={(v) => setPersonal((p: any) => ({ ...p, spouseCommunicationConsent: v }))} /></Field>
              <Field label="Anyone holds POA over their affairs?"><YesNoToggle value={personal.poaOverAffairs} onChange={(v) => setPersonal((p: any) => ({ ...p, poaOverAffairs: v }))} /></Field>
              <Field label="Politically Exposed Person?"><YesNoToggle value={personal.isPEP} onChange={(v) => setPersonal((p: any) => ({ ...p, isPEP: v }))} /></Field>
            </div>
            {personal.poaOverAffairs && <Field label="POA details"><TextInput value={personal.poaDetails} onChange={(v) => setPersonal((p: any) => ({ ...p, poaDetails: v }))} /></Field>}

            <Field label="Dependents">
              <RepeatingRows
                rows={personal.dependents ?? []}
                onChange={(rows) => setPersonal((p: any) => ({ ...p, dependents: rows }))}
                emptyRow={{ name: '', dob: '', relation: '', yearsUntilIndependent: '' }}
                addLabel="Add dependent"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.name} onChange={(v) => update({ name: v })} placeholder="Name" />
                    <TextInput type="date" value={row.dob} onChange={(v) => update({ dob: v })} />
                    <TextInput value={row.relation} onChange={(v) => update({ relation: v })} placeholder="Relation" />
                    <TextInput value={row.yearsUntilIndependent} onChange={(v) => update({ yearsUntilIndependent: v })} placeholder="Years until independent" />
                  </>
                )}
              />
            </Field>
          </SectionCard>
        )}

        {section === 2 && (
          <IncomeExpenditureSection value={incomeExpenditure} onChange={setIncomeExpenditure} />
        )}

        {section === 3 && (
          <SectionCard title="4. Assets">
            <Field label="Assets excluding pensions">
              <RepeatingRows
                rows={assets.nonPension ?? []}
                onChange={(rows) => setAssets((a: any) => ({ ...a, nonPension: rows }))}
                emptyRow={{ reference: '', type: '', ownership: 'personal', value: '', monthlyContribution: '' }}
                addLabel="Add asset"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.reference} onChange={(v) => update({ reference: v })} placeholder="Reference" />
                    <TextInput value={row.type} onChange={(v) => update({ type: v })} placeholder="Investment type" />
                    <SelectInput value={row.ownership} onChange={(v) => update({ ownership: v })} options={[{ value: 'personal', label: 'Personal' }, { value: 'joint', label: 'Jointly owned' }]} />
                    <TextInput type="number" value={row.value} onChange={(v) => update({ value: v })} placeholder="Fund value" />
                    <TextInput type="number" value={row.monthlyContribution} onChange={(v) => update({ monthlyContribution: v })} placeholder="Monthly contribution" />
                  </>
                )}
              />
            </Field>
            <Field label="Pensions">
              <RepeatingRows
                rows={assets.pensions ?? []}
                onChange={(rows) => setAssets((a: any) => ({ ...a, pensions: rows }))}
                emptyRow={{ reference: '', provider: '', type: '', ownership: 'personal', value: '', contributions: '', withdrawals: '', underManagement: false, reviewingPolicy: false }}
                addLabel="Add pension"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.reference} onChange={(v) => update({ reference: v })} placeholder="Reference" />
                    <TextInput value={row.provider} onChange={(v) => update({ provider: v })} placeholder="Provider" />
                    <TextInput value={row.type} onChange={(v) => update({ type: v })} placeholder="Type (SIPP, etc.)" />
                    <SelectInput value={row.ownership} onChange={(v) => update({ ownership: v })} options={[{ value: 'personal', label: 'Personal' }, { value: 'joint', label: 'Jointly owned' }]} />
                    <TextInput type="number" value={row.value} onChange={(v) => update({ value: v })} placeholder="Value / expected income" />
                    <TextInput type="number" value={row.contributions} onChange={(v) => update({ contributions: v })} placeholder="Gross contributions" />
                    <TextInput type="number" value={row.withdrawals} onChange={(v) => update({ withdrawals: v })} placeholder="Gross withdrawals" />
                    <label className="flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={row.underManagement} onChange={(e) => update({ underManagement: e.target.checked })} /> Under management</label>
                    <label className="flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={row.reviewingPolicy} onChange={(e) => update({ reviewingPolicy: e.target.checked })} /> Reviewing policy</label>
                  </>
                )}
              />
            </Field>
            <Field label="Notes"><TextAreaInput value={assets.notes ?? ''} onChange={(v) => setAssets((a: any) => ({ ...a, notes: v }))} /></Field>
          </SectionCard>
        )}

        {section === 4 && (
          <SectionCard title="5. Current Liabilities">
            <RepeatingRows
              rows={liabilities.items ?? []}
              onChange={(rows) => setLiabilities((l: any) => ({ ...l, items: rows }))}
              emptyRow={{ type: '', repaymentType: '', provider: '', ownership: 'personal', amountOutstanding: '', interestRate: '', monthlyRepayment: '', dealEndDate: '', mortgageEndDate: '' }}
              addLabel="Add liability"
              renderRow={(row, update) => (
                <>
                  <TextInput value={row.type} onChange={(v) => update({ type: v })} placeholder="Type (mortgage, loan...)" />
                  <TextInput value={row.repaymentType} onChange={(v) => update({ repaymentType: v })} placeholder="Repayment type" />
                  <TextInput value={row.provider} onChange={(v) => update({ provider: v })} placeholder="Product provider" />
                  <SelectInput value={row.ownership} onChange={(v) => update({ ownership: v })} options={[{ value: 'personal', label: 'Personal' }, { value: 'joint', label: 'Jointly owned' }]} />
                  <TextInput type="number" value={row.amountOutstanding} onChange={(v) => update({ amountOutstanding: v })} placeholder="Amount outstanding" />
                  <TextInput type="number" value={row.interestRate} onChange={(v) => update({ interestRate: v })} placeholder="Interest rate %" />
                  <TextInput type="number" value={row.monthlyRepayment} onChange={(v) => update({ monthlyRepayment: v })} placeholder="Monthly repayment" />
                  <TextInput type="date" value={row.dealEndDate} onChange={(v) => update({ dealEndDate: v })} placeholder="Deal end date" />
                  <TextInput type="date" value={row.mortgageEndDate} onChange={(v) => update({ mortgageEndDate: v })} placeholder="Mortgage end date" />
                </>
              )}
            />
            <Field label="Notes"><TextAreaInput value={liabilities.notes ?? ''} onChange={(v) => setLiabilities((l: any) => ({ ...l, notes: v }))} /></Field>
          </SectionCard>
        )}

        {section === 5 && (
          <SectionCard title="6. Current Insurance Policies">
            <Field label="Has life insurance?"><YesNoToggle value={insurance.hasLifeInsurance} onChange={(v) => setInsurance((i: any) => ({ ...i, hasLifeInsurance: v }))} /></Field>
            {!insurance.hasLifeInsurance && <Field label="If no, why?"><TextInput value={insurance.whyNot} onChange={(v) => setInsurance((i: any) => ({ ...i, whyNot: v }))} /></Field>}
            <Field label="Existing protection arrangements">
              <RepeatingRows
                rows={insurance.policies ?? []}
                onChange={(rows) => setInsurance((i: any) => ({ ...i, policies: rows }))}
                emptyRow={{ policyNo: '', provider: '', policyType: '', indexationType: '', ownership: 'personal', endDate: '', termYears: '', premium: '', inTrust: false }}
                addLabel="Add policy"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.policyNo} onChange={(v) => update({ policyNo: v })} placeholder="Policy no." />
                    <TextInput value={row.provider} onChange={(v) => update({ provider: v })} placeholder="Provider" />
                    <TextInput value={row.policyType} onChange={(v) => update({ policyType: v })} placeholder="Type of policy" />
                    <TextInput value={row.indexationType} onChange={(v) => update({ indexationType: v })} placeholder="Indexation type" />
                    <TextInput type="date" value={row.endDate} onChange={(v) => update({ endDate: v })} placeholder="End date" />
                    <TextInput type="number" value={row.termYears} onChange={(v) => update({ termYears: v })} placeholder="Term (years)" />
                    <TextInput type="number" value={row.premium} onChange={(v) => update({ premium: v })} placeholder="Premium" />
                    <label className="flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={row.inTrust} onChange={(e) => update({ inTrust: e.target.checked })} /> In trust</label>
                  </>
                )}
              />
            </Field>
            <Field label="Notes"><TextAreaInput value={insurance.notes ?? ''} onChange={(v) => setInsurance((i: any) => ({ ...i, notes: v }))} /></Field>
          </SectionCard>
        )}

        {section === 6 && (
          <SectionCard title="7A. Further Questions — Investments">
            <Field label="Do they currently have another financial adviser?"><YesNoToggle value={investmentQ.hasOtherAdvisor} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, hasOtherAdvisor: v }))} /></Field>
            {investmentQ.hasOtherAdvisor && (
              <>
                <Field label="Which investments, and details"><TextInput value={investmentQ.otherAdvisorDetails} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, otherAdvisorDetails: v }))} /></Field>
                <Field label="Last reviewed"><TextInput type="date" value={investmentQ.lastReviewDate} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, lastReviewDate: v }))} /></Field>
              </>
            )}
            <Field label="Special requirements for the types of investments held"><TextInput value={investmentQ.specialRequirements} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, specialRequirements: v }))} /></Field>
            <Field label="Investment objectives, and why"><TextAreaInput value={investmentQ.investmentObjectives} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, investmentObjectives: v }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prefers a passive portfolio?"><YesNoToggle value={investmentQ.prefersPassive} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, prefersPassive: v }))} /></Field>
              <Field label="Prefers an active portfolio?"><YesNoToggle value={investmentQ.prefersActive} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, prefersActive: v }))} /></Field>
            </div>
            <Field label="Notes"><TextAreaInput value={investmentQ.notes} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, notes: v }))} /></Field>
            <Field label="Do current investments reflect their risk appetite and objectives?">
              <SelectInput value={investmentQ.reflectsRiskAppetite} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, reflectsRiskAppetite: v }))}
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_sure', label: 'Not sure' }]} />
            </Field>
            <Field label="Intend to withdraw funds from investments?"><YesNoToggle value={investmentQ.withdrawalIntends} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, withdrawalIntends: v }))} /></Field>
            {investmentQ.withdrawalIntends && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Withdrawal type"><TextInput value={investmentQ.withdrawalType} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, withdrawalType: v }))} /></Field>
                <Field label="How much?"><TextInput value={investmentQ.withdrawalAmount} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, withdrawalAmount: v }))} /></Field>
                <Field label="When?"><TextInput value={investmentQ.withdrawalWhen} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, withdrawalWhen: v }))} /></Field>
              </div>
            )}
            <Field label="Expecting a lump sum (inheritance, business/property sale, etc.)?"><YesNoToggle value={investmentQ.expectsLumpSum} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, expectsLumpSum: v }))} /></Field>
            {investmentQ.expectsLumpSum && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Source / how much"><TextInput value={investmentQ.lumpSumSource} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, lumpSumSource: v }))} /></Field>
                <Field label="When (if known)"><TextInput value={investmentQ.lumpSumWhen} onChange={(v) => setInvestmentQ((q: any) => ({ ...q, lumpSumWhen: v }))} /></Field>
              </div>
            )}
          </SectionCard>
        )}

        {section === 7 && (
          <SectionCard title="7B. Further Questions — Retirement">
            <Field label="Minimum monthly income requirement in retirement (excl. mortgage)"><TextInput type="number" value={retirementQ.minMonthlyIncomeRequirement} onChange={(v) => setRetirementQ((q: any) => ({ ...q, minMonthlyIncomeRequirement: v }))} /></Field>
            <div className="grid grid-cols-3 gap-4 rounded-sm border border-hairline/60 p-3">
              <Field label="Client: full state pension?"><YesNoToggle value={retirementQ.selfFullStatePension} onChange={(v) => setRetirementQ((q: any) => ({ ...q, selfFullStatePension: v }))} /></Field>
              <Field label="Years worked (est.)"><TextInput value={retirementQ.selfYearsWorked} onChange={(v) => setRetirementQ((q: any) => ({ ...q, selfYearsWorked: v }))} /></Field>
              <Field label="Expected amount"><TextInput value={retirementQ.selfExpectedAmount} onChange={(v) => setRetirementQ((q: any) => ({ ...q, selfExpectedAmount: v }))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-sm border border-hairline/60 p-3">
              <Field label="Partner: full state pension?"><YesNoToggle value={retirementQ.partnerFullStatePension} onChange={(v) => setRetirementQ((q: any) => ({ ...q, partnerFullStatePension: v }))} /></Field>
              <Field label="Years worked (est.)"><TextInput value={retirementQ.partnerYearsWorked} onChange={(v) => setRetirementQ((q: any) => ({ ...q, partnerYearsWorked: v }))} /></Field>
              <Field label="Expected amount"><TextInput value={retirementQ.partnerExpectedAmount} onChange={(v) => setRetirementQ((q: any) => ({ ...q, partnerExpectedAmount: v }))} /></Field>
            </div>
            <Field label="Pension drawdown intention">
              <SelectInput value={retirementQ.pensionIntention} onChange={(v) => setRetirementQ((q: any) => ({ ...q, pensionIntention: v }))}
                options={[
                  { value: 'drawdown', label: 'Flexi-access drawdown' }, { value: 'annuity', label: 'Purchase an annuity' },
                  { value: 'combination', label: 'Combination of both' }, { value: 'none', label: "Don't expect to need to draw" },
                  { value: 'not_sure', label: 'Not sure' },
                ]} />
            </Field>
            <Field label="Reasoning"><TextAreaInput value={retirementQ.reasoning} onChange={(v) => setRetirementQ((q: any) => ({ ...q, reasoning: v }))} /></Field>
          </SectionCard>
        )}

        {section === 8 && (
          <RiskProfileSection
            riskCapacity={riskCapacity} setRiskCapacity={setRiskCapacity}
            riskQuestions={riskQuestions} riskAnswers={riskAnswers} setRiskAnswers={setRiskAnswers}
            riskScore={riskScore} riskCategory={riskCategory}
          />
        )}

        {section === 9 && (
          <SectionCard title="9. Declaration">
            <CheckboxRow checked={declaration.infoAccurate} onChange={(v) => setDeclaration((d: any) => ({ ...d, infoAccurate: v }))} label="The client confirms the information provided is an accurate reflection of their current circumstances." />
            <CheckboxRow checked={declaration.termsAccepted} onChange={(v) => setDeclaration((d: any) => ({ ...d, termsAccepted: v }))} label="The client confirms they have read and understood the firm's Terms & Conditions." />
            <Field label="How was this fact find completed?">
              <SelectInput value={declaration.completionMethod} onChange={(v) => setDeclaration((d: any) => ({ ...d, completionMethod: v }))}
                options={[{ value: 'online', label: 'Online' }, { value: 'phone_exec', label: 'Phone — account executive' }, { value: 'phone_adviser', label: 'Phone — adviser' }, { value: 'face_to_face', label: 'Face-to-face' }]} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name"><TextInput value={declaration.fullName} onChange={(v) => setDeclaration((d: any) => ({ ...d, fullName: v }))} /></Field>
              <Field label="Completed on"><TextInput type="date" value={completedOn} onChange={setCompletedOn} /></Field>
            </div>
          </SectionCard>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" className="px-4 py-2 text-xs" onClick={() => save('draft')} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
            <Button className="px-4 py-2 text-xs" onClick={() => save('completed')} disabled={saving}>Mark completed</Button>
            {saveMessage && <span className="text-xs text-ink-400">{saveMessage}</span>}
          </div>
        </Card>
      </div>
    </div>
    </div>
  );
}

function IncomeExpenditureSection({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  function updatePerson(who: 'client' | 'partner', patch: any) {
    onChange({ ...value, [who]: { ...value[who], ...patch } });
  }
  return (
    <>
      {(['client', 'partner'] as const).map((who) => {
        const person = value[who];
        return (
          <SectionCard key={who} title={`3. Income & Expenditure — ${who === 'client' ? 'Client' : 'Partner'}`}>
            <Field label="Employment status">
              <SelectInput value={person.employmentStatus} onChange={(v) => updatePerson(who, { employmentStatus: v })}
                options={[{ value: 'employed', label: 'Employed' }, { value: 'self_employed', label: 'Self-employed' }, { value: 'unemployed', label: 'Unemployed' }, { value: 'retired', label: 'Retired' }]} />
            </Field>
            <Field label="Income sources">
              <RepeatingRows
                rows={person.sources ?? []}
                onChange={(rows) => updatePerson(who, { sources: rows })}
                emptyRow={{ source: '', grossAmount: '', netAmount: '', frequency: 'monthly', startDate: '' }}
                addLabel="Add income source"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.source} onChange={(v) => update({ source: v })} placeholder="Source" />
                    <TextInput type="number" value={row.grossAmount} onChange={(v) => update({ grossAmount: v })} placeholder="Gross amount" />
                    <TextInput type="number" value={row.netAmount} onChange={(v) => update({ netAmount: v })} placeholder="Net amount" />
                    <SelectInput value={row.frequency} onChange={(v) => update({ frequency: v })} options={FREQUENCIES} />
                    <TextInput type="date" value={row.startDate} onChange={(v) => update({ startDate: v })} placeholder="Start date" />
                  </>
                )}
              />
            </Field>
            <Field label="Tax status">
              <SelectInput value={person.taxStatus} onChange={(v) => updatePerson(who, { taxStatus: v })}
                options={[{ value: 'non_tax', label: 'Non-tax payer' }, { value: 'basic_rate', label: 'Basic rate' }, { value: 'higher_rate', label: 'Higher rate' }, { value: 'additional_rate', label: 'Additional rate' }]} />
            </Field>
            <Field label="Monthly expenditure">
              <RepeatingRows
                rows={person.expenditure ?? []}
                onChange={(rows) => updatePerson(who, { expenditure: rows })}
                emptyRow={{ description: '', amount: '', frequency: 'monthly', startDate: '' }}
                addLabel="Add expenditure item"
                renderRow={(row, update) => (
                  <>
                    <TextInput value={row.description} onChange={(v) => update({ description: v })} placeholder="Description" />
                    <TextInput type="number" value={row.amount} onChange={(v) => update({ amount: v })} placeholder="Amount" />
                    <SelectInput value={row.frequency} onChange={(v) => update({ frequency: v })} options={FREQUENCIES} />
                  </>
                )}
              />
            </Field>
            <Field label="Notes"><TextAreaInput value={person.notes ?? ''} onChange={(v) => updatePerson(who, { notes: v })} /></Field>
          </SectionCard>
        );
      })}
    </>
  );
}

function RiskProfileSection({
  riskCapacity, setRiskCapacity, riskQuestions, riskAnswers, setRiskAnswers, riskScore, riskCategory,
}: {
  riskCapacity: any; setRiskCapacity: (v: any) => void;
  riskQuestions: RiskQuestion[];
  riskAnswers: { questionKey: string; selectedOption: string }[];
  setRiskAnswers: (v: { questionKey: string; selectedOption: string }[]) => void;
  riskScore: number | null; riskCategory: string | null;
}) {
  function select(questionKey: string, selectedOption: string) {
    const rest = riskAnswers.filter((a) => a.questionKey !== questionKey);
    setRiskAnswers([...rest, { questionKey, selectedOption }]);
  }
  const answered = riskAnswers.length;

  return (
    <SectionCard title="8. Risk Profile">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Assessment basis">
          <SelectInput value={riskCapacity.assessmentBasis} onChange={(v) => setRiskCapacity((c: any) => ({ ...c, assessmentBasis: v }))}
            options={[{ value: 'personal', label: 'Personal' }, { value: 'household', label: 'Household' }]} />
        </Field>
        <Field label="Net worth excl. principal home"><TextInput type="number" value={riskCapacity.netWorthExclHome} onChange={(v) => setRiskCapacity((c: any) => ({ ...c, netWorthExclHome: v }))} /></Field>
        <Field label="Monthly disposable income"><TextInput type="number" value={riskCapacity.monthlyDisposableIncome} onChange={(v) => setRiskCapacity((c: any) => ({ ...c, monthlyDisposableIncome: v }))} /></Field>
        <Field label="When will funds be withdrawn?"><TextInput value={riskCapacity.withdrawalHorizon} onChange={(v) => setRiskCapacity((c: any) => ({ ...c, withdrawalHorizon: v }))} /></Field>
      </div>

      <div className="border-t border-hairline pt-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Attitude to risk — {answered} of {riskQuestions.length} answered</p>
        <div className="space-y-5">
          {riskQuestions.map((q) => {
            const current = riskAnswers.find((a) => a.questionKey === q.key)?.selectedOption;
            return (
              <div key={q.key}>
                <p className="mb-2 text-sm text-ink-100">{q.prompt}</p>
                <div className="space-y-1.5">
                  {q.options.map((o) => (
                    <label key={o.key} className={`flex cursor-pointer items-start gap-2 rounded-sm border p-2 text-xs ${current === o.key ? 'border-brass-500 bg-brass-500/10' : 'border-hairline/60'}`}>
                      <input type="radio" className="mt-0.5" name={q.key} checked={current === o.key} onChange={() => select(q.key, o.key)} />
                      <span className="text-ink-300">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {riskScore !== null && (
        <div className="flex items-center gap-4 border-t border-hairline pt-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-300">ATR score</p>
            <p className="figure text-lg text-ink-100">{riskScore}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-300">Category</p>
            <Badge tone="info">{riskCategory?.replace('_', ' ')}</Badge>
          </div>
          <p className="text-xs text-ink-500">Recomputed on save — WealthMatrix's own transparent ATR scoring, not a licensed methodology.</p>
        </div>
      )}
    </SectionCard>
  );
}
