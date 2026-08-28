'use client';

// Small shared input primitives for the Fact Find form's ~9 sections —
// kept intentionally plain (no form-library dependency) since every
// section just edits its own slice of local state and the whole thing
// saves as one PATCH.

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
    />
  );
}

export function TextAreaInput({ value, onChange, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
    />
  );
}

export function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brass-500"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map((opt) => (
        <button
          key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={`rounded-sm border px-3 py-1.5 text-xs ${value === opt.v ? 'border-brass-500 bg-brass-500/15 text-brass-400' : 'border-hairline text-ink-300 hover:text-ink-100'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CheckboxRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2 py-1 text-sm text-ink-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-hairline bg-ink-900 p-5">
      <p className="mb-4 text-xs uppercase tracking-wide text-brass-400">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Generic add/remove-row table for the form's many repeatable lists (income sources, assets, pensions, liabilities, insurance policies, dependents). */
export function RepeatingRows<T extends Record<string, any>>({
  rows, onChange, emptyRow, renderRow, addLabel,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  emptyRow: T;
  renderRow: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  function updateRow(i: number, patch: Partial<T>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-sm border border-hairline/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">{renderRow(row, (patch) => updateRow(i, patch))}</div>
            <button type="button" onClick={() => removeRow(i)} className="mt-1 text-xs text-rust-400 hover:text-rust-300">Remove</button>
          </div>
        </div>
      ))}
      <button
        type="button" onClick={() => onChange([...rows, emptyRow])}
        className="rounded-sm border border-dashed border-hairline px-3 py-1.5 text-xs text-ink-300 hover:border-brass-500 hover:text-brass-400"
      >
        + {addLabel}
      </button>
    </div>
  );
}
