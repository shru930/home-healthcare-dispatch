import { Link } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, EmptyState, Notice, CLINICAL_DISCLAIMER } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDate, fmtDateTime, humanize } from '../format.js';

export const DAY_COLORS = {
  COMPLETED: 'border-green-300 bg-green-50',
  SCHEDULED: 'border-sky-300 bg-sky-50',
  INCOMPLETE: 'border-amber-300 bg-amber-50',
  MISSED: 'border-red-300 bg-red-50',
  CANCELLED: 'border-stone-300 bg-stone-100',
};

function groupByPlan(visits) {
  const groups = new Map();
  visits.forEach((v) => {
    const g = groups.get(v.carePlanId) || { carePlanId: v.carePlanId, patientName: v.patientName, visits: [] };
    g.visits.push(v);
    groups.set(v.carePlanId, g);
  });
  return [...groups.values()].map((g) => ({ ...g, visits: g.visits.sort((a, b) => a.dayNumber - b.dayNumber) }));
}

export function SevenDay({ visits, dayKey = 'dayNumber', dateKey = 'visitDate', nurseKey = 'nurseName', typeKey = 'visitType' }) {
  const byDay = new Map(visits.map((v) => [v[dayKey], v]));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
        const v = byDay.get(day);
        return (
          <div key={day} data-testid={`day-${day}`} className={`rounded-lg border p-2 text-xs ${v ? DAY_COLORS[v.status] || 'border-stone-200 bg-white' : 'border-dashed border-stone-200 bg-white'}`}>
            <p className="font-semibold text-stone-700">Day {day}</p>
            {v ? (
              <>
                <p className="text-stone-500">{fmtDate(v[dateKey])}</p>
                <p className="truncate text-stone-600" title={v[typeKey]}>{humanize(v[typeKey])}</p>
                <p className="truncate text-stone-600" title={v[nurseKey]}>{v[nurseKey] || 'No nurse'}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge value={v.status} />
                  {v.riskLevel && <StatusBadge value={v.riskLevel} label={`risk ${v.riskLevel}`} />}
                </div>
              </>
            ) : (
              <p className="text-stone-400">Not scheduled yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const yes = (b) => (b ? <span className="font-medium text-red-700">Yes</span> : <span className="text-stone-400">No</span>);

export default function Visits() {
  const visits = useApi(() => api.visits(), [], { intervalMs: 10000 });
  const assessments = useApi(api.assessments, [], { intervalMs: 10000 });
  const groups = groupByPlan(visits.data || []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home-care visits"
        subtitle="7-day visit schedule per care plan and nurse health assessments"
        actions={
          <Link to="/tasks" className="btn-primary">
            Submit assessment (Tasklist)
          </Link>
        }
      />
      <Section title="7-day schedules">
        <ErrorBanner error={visits.error} onRetry={visits.reload} />
        {visits.loading && !visits.data ? (
          <Spinner />
        ) : groups.length === 0 ? (
          <EmptyState title="No visits scheduled">Visits are created day by day by the workflow after a nurse is assigned.</EmptyState>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.carePlanId}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold text-stone-800">{g.patientName}</h3>
                  <span className="text-xs text-stone-400">Care plan #{g.carePlanId}</span>
                  <span className="text-xs text-stone-500">
                    {g.visits.filter((v) => v.status === 'COMPLETED').length} of 7 completed
                  </span>
                </div>
                <SevenDay visits={g.visits} />
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Health assessments">
        <div className="mb-3">
          <Notice kind="warning">{CLINICAL_DISCLAIMER}</Notice>
        </div>
        <ErrorBanner error={assessments.error} onRetry={assessments.reload} />
        {assessments.loading && !assessments.data ? (
          <Spinner />
        ) : (
          <DataTable
            rows={assessments.data || []}
            empty="No assessments submitted"
            emptyHint="Nurses submit assessments from the Tasklist (Home visit and health assessment)."
            columns={[
              { key: 'patientName', header: 'Patient' },
              { key: 'dayNumber', header: 'Day' },
              { key: 'painScore', header: 'Pain (0-10)', render: (r) => <span className="tabular-nums">{r.painScore ?? '-'}</span> },
              { key: 'temperature', header: 'Temp (°C)', render: (r) => <span className="tabular-nums">{r.temperature ?? '-'}</span> },
              { key: 'woundRedness', header: 'Redness', render: (r) => yes(r.woundRedness) },
              { key: 'woundDischarge', header: 'Discharge', render: (r) => yes(r.woundDischarge) },
              { key: 'swelling', header: 'Swelling', render: (r) => yes(r.swelling) },
              { key: 'riskLevel', header: 'Risk', render: (r) => <StatusBadge value={r.riskLevel} /> },
              { key: 'riskReasons', header: 'Reasons', render: (r) => <span className="text-xs">{r.riskReasons || '-'}</span> },
              { key: 'assessedAt', header: 'Assessed', render: (r) => fmtDateTime(r.assessedAt) },
            ]}
          />
        )}
      </Section>
    </div>
  );
}
