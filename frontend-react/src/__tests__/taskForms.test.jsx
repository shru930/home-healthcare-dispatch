import { render, screen, fireEvent } from '@testing-library/react';
import HealthAssessmentForm from '../tasks/HealthAssessmentForm.jsx';
import {
  validateHealthAssessment,
  validateDoctorReview,
  validateManualNurse,
  validateCorrectDischarge,
  validateGapReview,
  validateManualEmergency,
} from '../tasks/validation.js';

describe('health assessment validation', () => {
  const ok = { visitStatus: 'COMPLETED', painScore: 3, temperature: 37.2, nurseNotes: '' };

  it('accepts a valid completed assessment', () => {
    expect(validateHealthAssessment(ok)).toEqual({});
  });

  it.each([-1, 11, 4.5, ''])('rejects pain score %p', (painScore) => {
    expect(validateHealthAssessment({ ...ok, painScore }).painScore).toMatch(/0 and 10/);
  });

  it.each([0, 10])('accepts boundary pain score %p', (painScore) => {
    expect(validateHealthAssessment({ ...ok, painScore }).painScore).toBeUndefined();
  });

  it('rejects temperature outside 34-43', () => {
    expect(validateHealthAssessment({ ...ok, temperature: 33.9 }).temperature).toBeDefined();
    expect(validateHealthAssessment({ ...ok, temperature: 43.1 }).temperature).toBeDefined();
  });

  it('requires nurse notes when INCOMPLETE but not the vitals', () => {
    const e = validateHealthAssessment({ visitStatus: 'INCOMPLETE', painScore: '', temperature: '', nurseNotes: '  ' });
    expect(e.nurseNotes).toMatch(/required/);
    expect(e.painScore).toBeUndefined();
    expect(validateHealthAssessment({ visitStatus: 'INCOMPLETE', nurseNotes: 'Patient not at home' })).toEqual({});
  });
});

describe('HealthAssessmentForm', () => {
  it('blocks submit for out-of-range pain score and shows the error', () => {
    const onSubmit = vi.fn();
    render(<HealthAssessmentForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Pain score \(0-10\)/), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/between 0 and 10/)).toBeInTheDocument();
  });

  it('requires nurse notes when INCOMPLETE, then submits only status + notes', () => {
    const onSubmit = vi.fn();
    render(<HealthAssessmentForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('INCOMPLETE'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/required when the visit is incomplete/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nurse notes/), { target: { value: 'Patient was at hospital OPD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    expect(onSubmit).toHaveBeenCalledWith({ visitStatus: 'INCOMPLETE', nurseNotes: 'Patient was at hospital OPD' });
  });

  it('submits typed variables for a completed visit', () => {
    const onSubmit = vi.fn();
    render(<HealthAssessmentForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Pain score \(0-10\)/), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Temperature/), { target: { value: '38.6' } });
    fireEvent.click(screen.getByLabelText('Wound redness'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    expect(onSubmit).toHaveBeenCalledWith({
      visitStatus: 'COMPLETED',
      painScore: 8,
      temperature: 38.6,
      woundRedness: true,
      woundDischarge: false,
      swelling: false,
      nurseNotes: null,
    });
  });

  it('shows the clinical disclaimer', () => {
    render(<HealthAssessmentForm onSubmit={() => {}} />);
    expect(screen.getByText(/not a clinical diagnosis/)).toBeInTheDocument();
  });
});

describe('other task validators', () => {
  it('doctor review requires decision and notes', () => {
    expect(Object.keys(validateDoctorReview({ doctorDecision: '', doctorNotes: '' }))).toEqual(['doctorDecision', 'doctorNotes']);
    expect(validateDoctorReview({ doctorDecision: 'READMIT', doctorNotes: 'Readmit for wound debridement' })).toEqual({});
  });

  it('manual nurse requires a nurse id and a note', () => {
    expect(validateManualNurse({ selectedNurseId: '', manualAssignmentNote: '' })).toHaveProperty('selectedNurseId');
    expect(validateManualNurse({ selectedNurseId: '3', manualAssignmentNote: 'Closest available' })).toEqual({});
  });

  it('correct discharge checks 10-digit phones, e-mail and date', () => {
    const e = validateCorrectDischarge({ patientPhone: '12345', familyPhone: '98765432101', familyEmail: 'x', dischargeDate: '14/11/2026' });
    expect(Object.keys(e).sort()).toEqual(['dischargeDate', 'familyEmail', 'familyPhone', 'patientPhone']);
    expect(validateCorrectDischarge({ patientPhone: '9840012345', familyPhone: '9841012345', familyEmail: 'a@b.in', dischargeDate: '2026-11-14' })).toEqual({});
  });

  it('gap review and manual emergency require notes', () => {
    expect(validateGapReview({ gapReviewDecision: 'ACCEPT_AND_CLOSE', reviewNotes: '' })).toHaveProperty('reviewNotes');
    expect(validateManualEmergency({ emergencyOutcome: 'AMBULANCE_ARRANGED', emergencyNotes: '' })).toHaveProperty('emergencyNotes');
  });
});
