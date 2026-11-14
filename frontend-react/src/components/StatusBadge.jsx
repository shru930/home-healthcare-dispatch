/** Maps backend status / risk / engine-state values to a colour tone. */
const TONES = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  orange: 'bg-orange-50 text-orange-800 ring-orange-600/30',
  red: 'bg-red-50 text-red-700 ring-red-600/30',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  gray: 'bg-stone-100 text-stone-600 ring-stone-500/20',
};

const DOTS = {
  green: 'bg-green-500', blue: 'bg-sky-500', amber: 'bg-amber-500', orange: 'bg-orange-500',
  red: 'bg-red-500', violet: 'bg-violet-500', gray: 'bg-stone-400',
};

const MAP = {
  // success / finished
  COMPLETED: 'green', DELIVERED: 'green', SENT: 'green', AVAILABLE: 'green', OK: 'green', LOW: 'green',
  CLOSED: 'green', RESOLVED: 'green', VERIFIED: 'green', HOME_CARE: 'green', IN_STOCK: 'green',
  // in progress / planned
  ACTIVE: 'blue', SCHEDULED: 'blue', CREATED: 'blue', DISPATCHED: 'blue', IN_CARE: 'blue', STARTING: 'blue',
  RESERVED: 'blue', PRESCRIBED: 'blue', REGISTERED: 'violet', OPEN: 'amber', ASSIGNED: 'blue', PLANNED: 'blue',
  DISCHARGED: 'violet', AUTO: 'blue', ESCALATED: 'orange',
  // warnings
  INCOMPLETE: 'amber', DELAYED: 'amber', MEDIUM: 'amber', PENDING: 'amber', PATIENT_DECLINED: 'amber',
  RESCHEDULED: 'amber', MANUAL: 'amber', URGENT_VISIT: 'orange', HIGH: 'orange', FALLBACK_STRAIGHT_LINE: 'amber',
  ON_HOLD: 'amber', AWAITING_APPROVAL: 'amber', PARTIAL: 'amber',
  // failures
  MISSED: 'red', FAILED: 'red', CRITICAL: 'red', INCIDENT: 'red', CANCELED: 'gray', CANCELLED: 'gray',
  TERMINATED: 'red', REJECTED: 'red', OUT_OF_STOCK: 'red', READMIT: 'red', FAILED_TO_START: 'red',
  UNREACHABLE: 'red', DOWN: 'red', UNAVAILABLE: 'red', FAIL: 'red', NOT_DELIVERED: 'red', READMITTED: 'red',
  // neutral
  UNKNOWN: 'gray', DISTANCE_MATRIX_API: 'green',
  // readmission risk levels used by the BPMN gateways
  NORMAL: 'green', ELEVATED: 'orange',
};

export function badgeTone(value) {
  if (value == null || value === '') return 'gray';
  const key = String(value).toUpperCase().replace(/[\s-]+/g, '_');
  if (MAP[key]) return MAP[key];
  if (key.includes('FAIL') || key.includes('ERROR') || key.includes('REJECT') || key.includes('MISSED')) return 'red';
  if (key.includes('COMPLETE') || key.includes('DONE') || key.startsWith('RESOLVED')) return 'green';
  if (key.includes('DELAY') || key.includes('ESCALAT') || key.includes('INCOMPLETE')) return 'amber';
  if (key.includes('BOOKED') || key.includes('DISPATCHED')) return 'blue';
  return 'gray';
}

export default function StatusBadge({ value, label, className = '' }) {
  const tone = badgeTone(value);
  const text = label ?? (value == null || value === '' ? '-' : String(value).replace(/_/g, ' '));
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {text}
    </span>
  );
}
