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
import { useAuth } from '../auth.jsx';

const STORAGE_KEY = 'hh.tasklist.actAs';
const HOMECARE_PROCESSES = ['home-healthcare-dispatch', 'pharmacy-prescription-fulfillment'];
const PHYSIOS = ['physio.rahul', 'physio.meena'];

/*
 * The backend already filters GET /api/tasks by role:
 *   USER  -> nurse / physio tasks ("My tasks")
 *   ADMIN -> approval / coordinator / doctor tasks ("Approvals & decisions")
 * A USER may additionally pick a nurse or physio to act as: the list is then filtered by that
 * assignee and claims are made for that person. Completions always send the logged-in username.
 */
function readActAs() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
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

function TaskDetail({ taskKey, claimAs, actingUser, nurses, onCompleted, onClaimed }) {
  const detail = useApi(() => api.task(taskKey), [taskKey]);
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const t = detail.data;
  const Form = t ? TASK_FORMS[t.elementId] : null;

  useEffect(() => setSubmitError(null), [taskKey]);

  const claim = async () => {
    setBusy('claim');
    try {
      await api.claimTask(taskKey, claimAs);
      toast.success(`Task claimed by ${claimAs}`);
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
      await api.completeTask(taskKey, variables, actingUser);
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
          <button type="button" className="btn-secondary" onClick={claim} disabled={busy === 'claim' || t.assignee === claimAs}>
            {busy === 'claim' ? 'Claiming...' : t.assignee ? `Re-assign to ${claimAs}` : `Claim as ${claimAs}`}
          </button>
        </div>
      </div>
      {t.elementId !== 'Task_ApprovePlan' && (
        <div className="rounded-lg border border-stone-200 p-3">
          <TaskContext ctx={t.context} />
        </div>
      )}
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
  const { user, isAdmin } = useAuth();
  const username = user?.username || '';
  const [actAs, setActAs] = useState(() => (isAdmin ? '' : readActAs()));
  const claimAs = actAs || username;
  const [onlyHomecare, setOnlyHomecare] = useState(true);
  const [selected, setSelected] = useState(null);
  const nurses = useApi(api.nurses, []);
  const tasks = useApi(() => api.tasks(actAs ? { assignee: actAs } : {}), [actAs], { intervalMs: 5000 });
  const [patients, setPatients] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, actAs);
    } catch {
      /* storage unavailable */
    }
    setSelected(null);
  }, [actAs]);

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

  const title = isAdmin ? 'Approvals & decisions' : 'My tasks';
  const subtitle = isAdmin
    ? 'Plan approvals, coordinator and doctor tasks waiting for an admin (refreshes every 5 s)'
    : 'Nurse and physiotherapy tasks for ward staff (refreshes every 5 s)';

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card flex flex-wrap items-end gap-4 p-4">
        {!isAdmin && (
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="tl-actas" className="label">Act as nurse / physio (optional)</label>
            <select id="tl-actas" className="input" value={actAs} onChange={(e) => setActAs(e.target.value)}>
              <option value="">All my tasks (claim as {username})</option>
              <optgroup label="Nurses">
                {(nurses.data || []).map((n) => <option key={n.username} value={n.username}>{n.fullName} ({n.username})</option>)}
              </optgroup>
              <optgroup label="Physiotherapists">
                {PHYSIOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            </select>
          </div>
        )}
        <p className="pb-2 text-sm text-stone-600">
          Signed in as <span className="font-mono font-medium text-stone-800">{username}</span>
        </p>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={onlyHomecare} onChange={(e) => setOnlyHomecare(e.target.checked)} />
          Home-care processes only
        </label>
        <button type="button" className="btn-secondary mb-0.5 ml-auto" onClick={tasks.reload}>Refresh</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Section title={`Open tasks (${rows.length})`} className="xl:col-span-2">
          <ErrorBanner error={tasks.error} onRetry={tasks.reload} />
          {tasks.loading && !tasks.data ? (
            <Spinner label="Loading tasks..." />
          ) : rows.length === 0 ? (
            <EmptyState title="No open tasks">Nothing is waiting for {actAs || (isAdmin ? 'admins' : username)}. The list refreshes automatically.</EmptyState>
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
              claimAs={claimAs}
              actingUser={username}
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
