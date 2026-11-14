import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useApi } from '../components/useApi.js';
import { PageHeader, Section, KeyValue } from '../components/Ui.jsx';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { TASK_FORMS } from '../tasks/index.js';
import { asList, fmtDate, fmtDateTime, humanize } from '../format.js';

const STORAGE_KEY = 'hh.tasklist.user';
const HOMECARE_PROCESSES = ['home-healthcare-dispatch', 'pharmacy-prescription-fulfillment'];
const PHYSIOS = ['physio.rahul', 'physio.meena'];

const GROUP_OPTIONS = [
  { value: 'all', label: 'All tasks', query: {}, actingUser: 'coordinator' },
  { value: 'group:coordinators', label: 'Coordinator (group coordinators)', query: { candidateGroup: 'coordinators' }, actingUser: 'coordinator' },
  { value: 'group:doctors', label: 'Doctor (group doctors)', query: { candidateGroup: 'doctors' }, actingUser: 'doctor' },
  { value: 'group:physiotherapists', label: 'Physiotherapists (group physiotherapists)', query: { candidateGroup: 'physiotherapists' }, actingUser: 'physio.rahul' },
  { value: 'group:nurses', label: 'Nurses (group nurses)', query: { candidateGroup: 'nurses' }, actingUser: 'nurse' },
];

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function resolveUser(value) {
  const g = GROUP_OPTIONS.find((o) => o.value === value);
  if (g) return g;
  if (value?.startsWith('user:')) {
    const u = value.slice(5);
    return { value, label: u, query: { assignee: u }, actingUser: u };
  }
  return GROUP_OPTIONS[0];
}

function TaskContext({ ctx }) {
  if (!ctx || Object.keys(ctx).length === 0) return null;
  const items = [
    ctx.patientName && ['Patient', `${ctx.patientName}${ctx.patientMrn ? ` (${ctx.patientMrn})` : ''}`],
    ctx.patientAddress && ['Address', ctx.patientAddress],
    ctx.patientPhone && ['Patient phone', ctx.patientPhone],
    ctx.surgeryType && ['Surgery', ctx.surgeryType],
    ctx.dischargeDate && ['Discharge date', ctx.dischargeDate],
    ctx.careDay && ['Care day', `Day ${ctx.careDay.day} · ${fmtDate(ctx.careDay.date)} · ${humanize(ctx.careDay.visitType)}`],
    ctx.session && ['Physio session', `#${ctx.session.sessionNo} · ${fmtDate(ctx.session.date)} · ${ctx.session.focus}`],
    ctx.physiotherapist && ['Physiotherapist', ctx.physiotherapist],
    ctx.assignedNurse && ['Assigned nurse', typeof ctx.assignedNurse === 'object' ? `${ctx.assignedNurse.fullName || ctx.assignedNurse.name || ''} ${ctx.assignedNurse.username ? `(${ctx.assignedNurse.username})` : ''}` : String(ctx.assignedNurse)],
    ctx.requiredSkill && ['Required skill', ctx.requiredSkill],
    ctx.riskLevel && ['Risk level', <StatusBadge value={ctx.riskLevel} />],
    asList(ctx.riskReasons).length > 0 && ['Risk reasons', asList(ctx.riskReasons).join('; ')],
    ctx.familyContactName && ['Family contact', `${ctx.familyContactName}${ctx.familyPhone ? ` · ${ctx.familyPhone}` : ''}${ctx.familyEmail ? ` · ${ctx.familyEmail}` : ''}`],
    ctx.doctorName && ['Doctor', ctx.doctorName],
  ];
  return <KeyValue items={items} />;
}

function TaskDetail({ taskKey, actingUser, nurses, onCompleted, onClaimed }) {
  const detail = useApi(() => api.task(taskKey), [taskKey]);
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const t = detail.data;
  const Form = t ? TASK_FORMS[t.elementId] : null;

  useEffect(() => setSubmitError(null), [taskKey]);

  const claim = async () => {
    if (!actingUser.trim()) {
      toast.error('Enter the user to act as before claiming');
      return;
    }
    setBusy('claim');
    try {
      await api.claimTask(taskKey, actingUser.trim());
      toast.success(`Task claimed by ${actingUser.trim()}`);
      detail.reload();
      onClaimed();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const complete = async (variables) => {
    setBusy('complete');
    setSubmitError(null);
    try {
      await api.completeTask(taskKey, variables, actingUser.trim() || null);
      toast.success(`"${t.name}" completed`);
      onCompleted();
    } catch (e) {
      setSubmitError(e);
    } finally {
      setBusy(null);
    }
  };

  if (detail.loading && !t) return <Spinner label="Loading task..." />;
  if (detail.error) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  if (!t) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">{t.name}</h2>
          <p className="text-xs text-stone-500">
            <span className="font-mono">{t.elementId}</span> · task <span className="font-mono">{t.userTaskKey}</span> · process{' '}
            <Link className="font-mono font-semibold text-brand-700 hover:text-brand-900" to={`/tracker/${t.processInstanceKey}`}>{t.processInstanceKey}</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">Assignee: <span className="font-medium text-stone-700">{t.assignee || 'unassigned'}</span></span>
          <button type="button" className="btn-secondary" onClick={claim} disabled={busy === 'claim' || t.assignee === actingUser.trim()}>
            {busy === 'claim' ? 'Claiming...' : t.assignee ? `Re-assign to ${actingUser || '...'}` : 'Claim'}
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 p-3">
        <TaskContext ctx={t.context} />
      </div>
      <ErrorBanner error={submitError} />
      {Form ? (
        <Form key={taskKey} task={t} context={t.context || {}} nurses={nurses} onSubmit={complete} submitting={busy === 'complete'} />
      ) : (
        <EmptyState title="No custom form for this task type">
          Element <span className="font-mono">{t.elementId}</span> is not part of the home-care workflow forms.
        </EmptyState>
      )}
    </div>
  );
}

export default function Tasklist() {
  const [userValue, setUserValue] = useState(readStored);
  const user = resolveUser(userValue);
  const [actingUser, setActingUser] = useState(user.actingUser);
  const [onlyHomecare, setOnlyHomecare] = useState(true);
  const [selected, setSelected] = useState(null);
  const nurses = useApi(api.nurses, []);
  const tasks = useApi(() => api.tasks(user.query), [userValue], { intervalMs: 5000 });
  const [patients, setPatients] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, userValue);
    } catch {
      /* storage unavailable */
    }
    setActingUser(resolveUser(userValue).actingUser);
    setSelected(null);
  }, [userValue]);

  const rows = useMemo(
    () => (tasks.data || []).filter((t) => !onlyHomecare || HOMECARE_PROCESSES.includes(t.processDefinitionId)),
    [tasks.data, onlyHomecare],
  );

  // Patient names come from the task context; fetch each task's details once.
  useEffect(() => {
    rows.forEach((t) => {
      if (requested.current.has(t.userTaskKey)) return;
      requested.current.add(t.userTaskKey);
      api.task(t.userTaskKey)
        .then((d) => setPatients((p) => ({ ...p, [t.userTaskKey]: d.context?.patientName || '-' })))
        .catch(() => setPatients((p) => ({ ...p, [t.userTaskKey]: '-' })));
    });
  }, [rows]);

  useEffect(() => {
    if (selected && tasks.data && !tasks.data.some((t) => t.userTaskKey === selected)) setSelected(null);
  }, [tasks.data, selected]);

  const nurseOptions = (nurses.data || []).map((n) => ({ value: `user:${n.username}`, label: `${n.fullName} (${n.username})` }));

  return (
    <div className="space-y-6">
      <PageHeader title="Tasklist" subtitle="Camunda user tasks for coordinators, doctors, nurses and physiotherapists (refreshes every 5 s)" />
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="tl-user" className="label">View tasks for</label>
          <select id="tl-user" className="input" value={userValue} onChange={(e) => setUserValue(e.target.value)}>
            {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <optgroup label="Nurses (assignee)">
              {nurseOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Physiotherapists (assignee)">
              {PHYSIOS.map((p) => <option key={p} value={`user:${p}`}>{p}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="w-48">
          <label htmlFor="tl-acting" className="label">Acting as (claim / complete)</label>
          <input id="tl-acting" className="input font-mono" value={actingUser} onChange={(e) => setActingUser(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={onlyHomecare} onChange={(e) => setOnlyHomecare(e.target.checked)} />
          Home-care processes only
        </label>
        <button type="button" className="btn-secondary mb-0.5" onClick={tasks.reload}>Refresh</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Section title={`Open tasks (${rows.length})`} className="xl:col-span-2">
          <ErrorBanner error={tasks.error} onRetry={tasks.reload} />
          {tasks.loading && !tasks.data ? (
            <Spinner label="Loading tasks..." />
          ) : rows.length === 0 ? (
            <EmptyState title="No open tasks">Nothing is waiting for {user.label}. The list refreshes automatically.</EmptyState>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
              {rows.map((t) => (
                <li key={t.userTaskKey}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.userTaskKey)}
                    className={`w-full px-3 py-2.5 text-left transition hover:bg-brand-50/60 ${selected === t.userTaskKey ? 'bg-brand-50 ring-2 ring-inset ring-brand-600/40' : 'bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-stone-800">{t.name}</p>
                      <span className="whitespace-nowrap text-xs text-stone-400">{fmtDateTime(t.creationDate)}</span>
                    </div>
                    <p className="text-sm text-stone-600">{patients[t.userTaskKey] ?? '...'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span>Assignee: <span className="font-mono">{t.assignee || '-'}</span></span>
                      <span>Groups: {asList(t.candidateGroups).join(', ') || '-'}</span>
                      <span className="font-mono">PI {t.processInstanceKey}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section className="xl:col-span-3">
          {selected ? (
            <TaskDetail
              taskKey={selected}
              actingUser={actingUser}
              nurses={nurses.data || []}
              onClaimed={tasks.reload}
              onCompleted={() => {
                setSelected(null);
                tasks.reload();
              }}
            />
          ) : (
            <EmptyState title="Select a task">Choose a task on the left to see its context and form.</EmptyState>
          )}
        </Section>
      </div>
    </div>
  );
}
