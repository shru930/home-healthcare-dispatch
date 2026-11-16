import { render, screen, fireEvent } from '@testing-library/react';
import ApprovePlanForm from '../tasks/ApprovePlanForm.jsx';
import { TASK_FORMS } from '../tasks/index.js';
import { validateApprovePlan } from '../tasks/validation.js';

const context = {
  patientName: 'Lakshmi R',
  patientMrn: 'MRN-1001',
  surgeryType: 'Total knee replacement',
  dischargeDate: '2026-11-16',
  requestedBy: 'ward.user',
  prescriptions: [{ medication: 'Paracetamol 500mg', dosage: '1 tab twice daily', quantity: 14, controlled: false, doctorApproved: true }],
  physioSessions: [{ dayNumber: 2, focus: 'Gait training' }],
};

describe('approve plan validation', () => {
  it('requires a decision', () => {
    expect(validateApprovePlan({ approvalDecision: '' })).toHaveProperty('approvalDecision');
  });
  it('requires notes when REJECTED', () => {
    expect(validateApprovePlan({ approvalDecision: 'REJECTED', approvalNotes: '  ' })).toHaveProperty('approvalNotes');
    expect(validateApprovePlan({ approvalDecision: 'REJECTED', approvalNotes: 'Missing doctor sign-off' })).toEqual({});
  });
  it('notes are optional when APPROVED', () => {
    expect(validateApprovePlan({ approvalDecision: 'APPROVED', approvalNotes: '' })).toEqual({});
  });
});

describe('ApprovePlanForm', () => {
  it('is registered for Task_ApprovePlan', () => {
    expect(TASK_FORMS.Task_ApprovePlan).toBe(ApprovePlanForm);
  });

  it('shows the request details', () => {
    render(<ApprovePlanForm context={context} onSubmit={() => {}} />);
    expect(screen.getByText('Lakshmi R (MRN-1001)')).toBeInTheDocument();
    expect(screen.getByText('Total knee replacement')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getByText(/Gait training/)).toBeInTheDocument();
    expect(screen.getByText('ward.user')).toBeInTheDocument();
  });

  it('approves without notes', () => {
    const onSubmit = vi.fn();
    render(<ApprovePlanForm context={context} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onSubmit).toHaveBeenCalledWith({ approvalDecision: 'APPROVED', approvalNotes: null });
  });

  it('blocks reject until notes are given', () => {
    const onSubmit = vi.fn();
    render(<ApprovePlanForm context={context} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/reason for rejecting/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Add wound-care nurse first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onSubmit).toHaveBeenCalledWith({ approvalDecision: 'REJECTED', approvalNotes: 'Add wound-care nurse first' });
  });
});
