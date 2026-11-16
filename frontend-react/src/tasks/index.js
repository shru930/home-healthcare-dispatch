import HealthAssessmentForm from './HealthAssessmentForm.jsx';
import DoctorReviewForm from './DoctorReviewForm.jsx';
import PhysioSessionForm from './PhysioSessionForm.jsx';
import ManualNurseForm from './ManualNurseForm.jsx';
import CorrectDischargeForm from './CorrectDischargeForm.jsx';
import ManualEmergencyForm from './ManualEmergencyForm.jsx';
import GapReviewForm from './GapReviewForm.jsx';
import ApprovePlanForm from './ApprovePlanForm.jsx';

/** Task-specific form per BPMN user task elementId. */
export const TASK_FORMS = {
  Task_HealthAssessment: HealthAssessmentForm,
  Task_DoctorReview: DoctorReviewForm,
  Task_PhysioSession: PhysioSessionForm,
  Task_ManualNurse: ManualNurseForm,
  Task_CorrectDischarge: CorrectDischargeForm,
  Task_ManualEmergency: ManualEmergencyForm,
  Task_GapReview: GapReviewForm,
  Task_ApprovePlan: ApprovePlanForm,
};
