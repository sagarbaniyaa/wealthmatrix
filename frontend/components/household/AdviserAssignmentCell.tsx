'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Adviser { id: string; email: string }
interface Assignment { id: string; adviserId: string; householdId: string }

// Admin-only control: shows which advisers are assigned to this
// household (adviser_household_assignment — the table that actually
// gates what an adviser can see, per HouseholdService.findAllForUser)
// and lets an admin add/remove assignments inline.
export function AdviserAssignmentCell({
  householdId, advisers, assignments,
}: { householdId: string; advisers: Adviser[]; assignments: Assignment[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const assigned = assignments.filter((a) => a.householdId === householdId);
  const unassignedAdvisers = advisers.filter((a) => !assigned.some((asn) => asn.adviserId === a.id));

  async function assign(adviserId: string) {
    if (!adviserId) return;
    setPending(true);
    try {
      await api.post('adviser-assignments', { adviserId, householdId });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function unassign(assignmentId: string) {
    setPending(true);
    try {
      await api.delete(`adviser-assignments/${assignmentId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const adviserEmail = (id: string) => advisers.find((a) => a.id === id)?.email ?? id;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((a) => (
        <span key={a.id} className="inline-flex items-center gap-1 rounded-sm bg-ink-700 px-2 py-0.5 text-xs text-ink-100">
          {adviserEmail(a.adviserId)}
          <button onClick={() => unassign(a.id)} disabled={pending} className="text-ink-500 hover:text-rust-400">×</button>
        </span>
      ))}
      {unassignedAdvisers.length > 0 && (
        <select
          value=""
          disabled={pending}
          onChange={(e) => assign(e.target.value)}
          className="rounded-sm border border-hairline bg-ink-800 px-2 py-1 text-xs text-ink-300"
        >
          <option value="">+ Assign…</option>
          {unassignedAdvisers.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
      )}
    </div>
  );
}
