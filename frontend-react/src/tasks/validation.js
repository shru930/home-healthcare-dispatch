/**
 * Client-side validation mirroring TaskService.validate(...) on the server.
 * Each validator returns an object { field: message }; empty object = valid.
 */
const TEN = /^\d{10}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const blank = (v) => v == null || String(v).trim() === '';
const oneOf = (v, allowed) => allowed.includes(v);

export function validateHealthAssessment(v) {
  const e = {};
  if (!oneOf(v.visitStatus, ['COMPLETED', 'INCOMPLETE'])) e.visitStatus = 'Select COMPLETED or INCOMPLETE';
  if (v.visitStatus === 'COMPLETED') {
    const pain = Number(v.painScore);
    if (blank(v.painScore) || !Number.isInteger(pain) || pain < 0 || pain > 10) e.painScore = 'Pain score must be a whole number between 0 and 10';
    const t = Number(v.temperature);
    if (blank(v.temperature) || Number.isNaN(t) || t < 34 || t > 43) e.temperature = 'Temperature must be between 34 and 43 °C';
  }
  if (v.visitStatus === 'INCOMPLETE' && blank(v.nurseNotes)) e.nurseNotes = 'Nurse notes are required when the visit is incomplete';
  return e;
}

export function validateDoctorReview(v) {
  const e = {};
  if (!oneOf(v.doctorDecision, ['HOME_CARE', 'URGENT_VISIT', 'READMIT'])) e.doctorDecision = 'Select a decision';
  if (blank(v.doctorNotes)) e.doctorNotes = 'Doctor notes are required';
  return e;
}

export function validatePhysioSession(v) {
  const e = {};
  if (!oneOf(v.physioStatus, ['COMPLETED', 'PATIENT_DECLINED'])) e.physioStatus = 'Select an outcome';
  return e;
}

export function validateManualNurse(v) {
  const e = {};
  const id = Number(v.selectedNurseId);
  if (blank(v.selectedNurseId) || !Number.isInteger(id) || id < 1) e.selectedNurseId = 'Select a nurse';
  if (blank(v.manualAssignmentNote)) e.manualAssignmentNote = 'A note explaining the manual assignment is required';
  return e;
}

export function validateCorrectDischarge(v) {
  const e = {};
  if (!TEN.test(String(v.patientPhone ?? '').trim())) e.patientPhone = 'Must be 10 digits';
  if (!TEN.test(String(v.familyPhone ?? '').trim())) e.familyPhone = 'Must be 10 digits';
  if (!EMAIL.test(String(v.familyEmail ?? '').trim())) e.familyEmail = 'Valid e-mail required';
  if (!DATE.test(String(v.dischargeDate ?? '').trim())) e.dischargeDate = 'Format YYYY-MM-DD';
  return e;
}

export function validateManualEmergency(v) {
  const e = {};
  if (!oneOf(v.emergencyOutcome, ['AMBULANCE_ARRANGED', 'HOSPITAL_CONTACTED', 'DOCTOR_ATTENDED'])) e.emergencyOutcome = 'Select an outcome';
  if (blank(v.emergencyNotes)) e.emergencyNotes = 'Emergency notes are required';
  return e;
}

export function validateGapReview(v) {
  const e = {};
  if (!oneOf(v.gapReviewDecision, ['ACCEPT_AND_CLOSE', 'FOLLOW_UP_BOOKED'])) e.gapReviewDecision = 'Select a decision';
  if (blank(v.reviewNotes)) e.reviewNotes = 'Review notes are required';
  return e;
}

/** Task_ApprovePlan: decision is required; notes are required only when rejecting. */
export function validateApprovePlan(v) {
  const e = {};
  if (!oneOf(v.approvalDecision, ['APPROVED', 'REJECTED'])) e.approvalDecision = 'Choose Approve or Reject';
  if (v.approvalDecision === 'REJECTED' && blank(v.approvalNotes)) e.approvalNotes = 'Please give a reason for rejecting the plan';
  return e;
}
