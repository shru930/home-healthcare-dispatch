import { validateDischarge, buildDischargePayload } from '../components/DischargeForm.jsx';
import { validatePatient, samplePatient } from '../components/PatientForm.jsx';

const base = {
  surgeryType: 'Knee replacement',
  surgeryDate: '2026-11-10',
  dischargeDate: '2026-11-14',
  hospital: 'Apollo',
  doctorName: 'Dr. R',
  doctorEmail: 'dr@example.com',
  requiredSkill: 'WOUND_CARE',
  physioSessions: [{ dayNumber: 2, focus: 'ROM' }],
  prescriptions: [{ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true }],
  timerOverrides: { visitWindow: 'PT30S', physioWindow: '' },
};

describe('discharge form', () => {
  it('accepts a valid request and builds the payload with only non-empty timers', () => {
    expect(validateDischarge(base)).toEqual({});
    const p = buildDischargePayload(base);
    expect(p.timerOverrides).toEqual({ visitWindow: 'PT30S' });
    expect(p.physioSessions).toEqual([{ dayNumber: 2, focus: 'ROM' }]);
    expect(p.prescriptions[0]).toEqual({ medication: 'Paracetamol 500mg', dosage: '1 tab', quantity: 10, controlled: false, doctorApproved: true });
  });

  it('omits timerOverrides entirely when none are set', () => {
    expect(buildDischargePayload({ ...base, timerOverrides: {} })).not.toHaveProperty('timerOverrides');
  });

  it('flags array item errors, missing prescriptions and bad durations', () => {
    const e = validateDischarge({
      ...base,
      physioSessions: [{ dayNumber: 9, focus: '' }],
      prescriptions: [],
      timerOverrides: { visitWindow: '30 seconds' },
    });
    expect(e['physio.0.dayNumber']).toBeDefined();
    expect(e['physio.0.focus']).toBeDefined();
    expect(e.prescriptions).toBeDefined();
    expect(e['timer.visitWindow']).toBeDefined();
  });

  it('sample patient passes patient validation', () => {
    expect(validatePatient(samplePatient(1731580000000))).toEqual({});
  });
});
