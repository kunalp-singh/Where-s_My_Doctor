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
  status?: string;
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
  doctorNotes?: string;
  notes?: string;
  prescriptions?: Array<{ medicationName: string; dosage: string; frequency: string; durationDays?: number }>;
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
    appointmentId?: string;
    chiefComplaint: string;
    diagnosis: string;
    notes: string;
    prescriptions: Array<{ medicationName: string; dosage: string; frequency: string; durationDays?: number }>;
  }
): Promise<DoctorNotesResponse> {
  const formattedPrescriptions = (payload.prescriptions || []).map((p) => ({
    medicationName: p.medicationName,
    dosage: p.dosage,
    frequency: p.frequency,
    durationDays: p.durationDays || 7,
  }));

  const fullPayload = {
    appointmentId,
    chiefComplaint: payload.chiefComplaint,
    diagnosis: payload.diagnosis,
    notes: payload.notes,
    prescriptions: formattedPrescriptions,
  };

  return apiFetch<DoctorNotesResponse>(`/doctors/appointments/${appointmentId}/notes`, {
    method: "POST",
    body: JSON.stringify(fullPayload),
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
