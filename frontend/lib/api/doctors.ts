import { apiFetch } from "./client";

export interface DoctorAppointmentItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName?: string;
  status: string;
  slotStart: string;
  slotEnd: string;
  urgency?: string;
  chiefComplaint?: string;
}

export interface DoctorNotesResponse {
  appointmentId: string;
  patientName: string;
  symptomsText?: string;
  aiPreVisitSummary?: {
    urgency?: string;
    chief_complaint?: string;
    chiefComplaint?: string;
    follow_up_questions?: string[];
    followUpQuestions?: string[];
    recommended_specialisation?: string;
    recommendedSpecialisation?: string;
  };
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  prescriptions?: Array<{ medicationName: string; dosage: string; frequency: string }>;
}

export interface WorkingHourItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DoctorSchedule {
  doctorId: string;
  specialisation: string;
  workingHours: WorkingHourItem[];
  slotDurationMinutes: number;
  leaveDays: Array<{ day: string }>;
}

function normalizeDoctorAppointmentItem(item: any): DoctorAppointmentItem {
  const aptId = item.appointmentId || item.appointment_id || item.id;
  return {
    ...item,
    id: aptId,
    appointmentId: aptId,
  };
}

export async function listDoctorAppointments(): Promise<DoctorAppointmentItem[]> {
  const list = await apiFetch<any[]>("/doctors/appointments");
  return list.map(normalizeDoctorAppointmentItem);
}

export async function getVisitDetail(appointmentId: string): Promise<DoctorNotesResponse> {
  return apiFetch<DoctorNotesResponse>(`/doctors/appointments/${appointmentId}`);
}

export async function submitVisitNotes(
  appointmentId: string,
  payload: {
    chiefComplaint: string;
    diagnosis: string;
    notes: string;
    prescriptions: Array<{ medicationName: string; dosage: string; frequency: string }>;
  }
): Promise<DoctorNotesResponse> {
  return apiFetch<DoctorNotesResponse>(`/doctors/appointments/${appointmentId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDoctorSchedule(): Promise<DoctorSchedule> {
  return apiFetch<DoctorSchedule>("/doctors/schedule");
}

export async function updateDoctorSchedule(payload: {
  workingHours?: WorkingHourItem[];
  slotDurationMinutes?: number;
}): Promise<DoctorSchedule> {
  return apiFetch<DoctorSchedule>("/doctors/schedule", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
