import { apiFetch } from "./client";

export interface DoctorSearchResult {
  id: string;
  name: string;
  email?: string;
  specialisation: string;
  rating?: string;
  workingHours?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  slotDurationMinutes?: number;
}

export interface DoctorSlot {
  slotStart: string;
  slotEnd: string;
  available: boolean;
  status: string;
}

export interface PatientAppointmentResponse {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string;
  patientId?: string;
  status: string;
  slotStart: string;
  slotEnd: string;
  symptomSummary?: {
    urgency: string;
    chiefComplaint: string;
    followUpQuestions: string[];
  };
  visitNotes?: {
    chiefComplaint?: string;
    diagnosis?: string;
    notes?: string;
    prescriptions?: Array<{ medicationName: string; dosage: string; frequency: string }>;
  };
}

export interface BookingSession {
  sessionId: string;
  symptomsText: string;
  aiSummary: {
    urgency?: string;
    chiefComplaint?: string;
    followUpQuestions?: string[];
    recommendedSpecialisation?: string;
  };
  recommendedSpecialisation: string;
  doctorId?: string;
  appointmentId?: string;
}

function normalizeAppointmentResponse(data: any): PatientAppointmentResponse {
  const aptId = data.appointmentId || data.appointment_id || data.id;
  return {
    ...data,
    id: aptId,
    appointmentId: aptId,
  };
}

export async function transcribeAudioSymptoms(
  audioBase64: string,
  mimeType: string = "audio/webm"
): Promise<{ transcript: string }> {
  return apiFetch<{ transcript: string }>("/patients/transcribe-audio", {
    method: "POST",
    body: JSON.stringify({ audioBase64, mimeType }),
  });
}

export async function searchDoctors(query?: string): Promise<DoctorSearchResult[]> {
  const endpoint = query ? `/patients/doctors?query=${encodeURIComponent(query)}` : "/patients/doctors";
  return apiFetch<DoctorSearchResult[]>(endpoint);
}

export async function getDoctorSlots(doctorId: string, targetDate?: string): Promise<DoctorSlot[]> {
  const endpoint = targetDate
    ? `/patients/doctors/${doctorId}/slots?target_date=${targetDate}`
    : `/patients/doctors/${doctorId}/slots`;
  return apiFetch<DoctorSlot[]>(endpoint);
}

export async function createBookingSession(symptomsText: string): Promise<BookingSession> {
  return apiFetch<BookingSession>("/patients/booking-sessions", {
    method: "POST",
    body: JSON.stringify({ symptomsText }),
  });
}

export async function getBookingSession(sessionId: string): Promise<BookingSession> {
  return apiFetch<BookingSession>(`/patients/booking-sessions/${sessionId}`);
}

export async function updateBookingSession(
  sessionId: string,
  payload: { recommendedSpecialisation?: string; doctorId?: string }
): Promise<BookingSession> {
  return apiFetch<BookingSession>(`/patients/booking-sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function sessionHoldAppointment(
  sessionId: string,
  doctorId: string,
  slotStart: string
): Promise<{ appointmentId: string; holdExpiresAt?: string }> {
  return apiFetch<{ appointmentId: string; holdExpiresAt?: string }>(
    `/patients/booking-sessions/${sessionId}/hold`,
    {
      method: "POST",
      body: JSON.stringify({ doctorId, slotStart }),
    }
  );
}

export async function sessionConfirmAppointment(sessionId: string): Promise<PatientAppointmentResponse> {
  const raw = await apiFetch<any>(`/patients/booking-sessions/${sessionId}/confirm`, {
    method: "POST",
  });
  return normalizeAppointmentResponse(raw);
}

export async function holdAppointment(doctorId: string, slotStart: string, slotEnd?: string): Promise<{ appointmentId: string }> {
  return apiFetch<{ appointmentId: string }>("/patients/appointments/hold", {
    method: "POST",
    body: JSON.stringify({ doctorId, slotStart }),
  });
}

export async function confirmAppointment(appointmentId: string): Promise<PatientAppointmentResponse> {
  const raw = await apiFetch<any>(`/patients/appointments/${appointmentId}/confirm`, {
    method: "POST",
  });
  return normalizeAppointmentResponse(raw);
}

export async function cancelPatientAppointment(appointmentId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/patients/appointments/${appointmentId}/cancel`, {
    method: "POST",
  });
}

export async function submitSymptoms(appointmentId: string, symptomsText: string): Promise<any> {
  return apiFetch(`/patients/appointments/${appointmentId}/symptoms`, {
    method: "POST",
    body: JSON.stringify({ symptomsText }),
  });
}

export async function listPatientAppointments(): Promise<PatientAppointmentResponse[]> {
  const list = await apiFetch<any[]>("/patients/appointments");
  return list.map(normalizeAppointmentResponse);
}
