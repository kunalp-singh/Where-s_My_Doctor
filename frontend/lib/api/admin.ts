import { apiFetch } from "./client";

export interface DoctorAdminResponse {
  id: string;
  name: string;
  email: string;
  status: "active" | "pending_approval" | "rejected";
  specialisation?: string;
  workingHours?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  slotDurationMinutes?: number;
  leaveDays?: Array<{ day: string }>;
}

export async function listAdminDoctors(): Promise<DoctorAdminResponse[]> {
  return apiFetch<DoctorAdminResponse[]>("/admin/doctors");
}

export async function createAdminDoctor(payload: {
  name: string;
  email: string;
  password?: string;
  specialisation: string;
}): Promise<DoctorAdminResponse> {
  return apiFetch<DoctorAdminResponse>("/admin/doctors", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      password: payload.password || "Password123!",
      workingHours: [],
      slotDurationMinutes: 30,
      leaveDays: [],
    }),
  });
}

export async function approveDoctor(doctorId: string): Promise<DoctorAdminResponse> {
  return apiFetch<DoctorAdminResponse>(`/admin/doctors/${doctorId}/approve`, {
    method: "POST",
  });
}

export async function rejectDoctor(doctorId: string): Promise<DoctorAdminResponse> {
  return apiFetch<DoctorAdminResponse>(`/admin/doctors/${doctorId}/reject`, {
    method: "POST",
  });
}

export async function deleteAdminDoctor(doctorId: string): Promise<void> {
  return apiFetch<void>(`/admin/doctors/${doctorId}`, {
    method: "DELETE",
  });
}

export async function addDoctorLeaveDay(doctorId: string, day: string): Promise<any> {
  return apiFetch(`/admin/doctors/${doctorId}/leave-days`, {
    method: "POST",
    body: JSON.stringify({ day }),
  });
}
