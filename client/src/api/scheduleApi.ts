import axiosInstance from './axiosInstance';
import { data, toParams } from './request';
import type { ApiResponse, AvailabilitySlot, Availability, Booking, BookingStatus, FreelancerProfile, TimeSlot } from '../types';

export const scheduleApi = {
  getAvailability: (freelancerId: string, params: { from?: string; to?: string } = {}) =>
    data(axiosInstance.get<ApiResponse<Availability>>(`/schedule/${freelancerId}/availability`, { params: toParams(params) })),

  /** Freelancer: weekly template (in `timezone`) and auto-confirm. */
  updateSlots: (input: { availabilitySlots: AvailabilitySlot[]; timezone?: string; autoConfirmBookings?: boolean }) =>
    data(axiosInstance.put<ApiResponse<Pick<FreelancerProfile, 'availabilitySlots' | 'timezone' | 'autoConfirmBookings'>>>('/schedule/me/slots', input)),

  getBookings: (params: { from?: string; to?: string; status?: BookingStatus[] } = {}) =>
    data(axiosInstance.get<ApiResponse<Booking[]>>('/schedule/bookings', { params: toParams(params) })),

  book: (input: { freelancerId: string; start: string; durationMinutes: number; title: string; notes?: string; gigId?: string }) =>
    data(axiosInstance.post<ApiResponse<Booking>>('/schedule/bookings', input)),

  update: (id: string, input: { status?: Exclude<BookingStatus, 'pending'>; meetingLink?: string }) =>
    data(axiosInstance.put<ApiResponse<Booking>>(`/schedule/bookings/${id}`, input)),

  /** Earliest slot free for both; `book: true` books it. */
  autoSchedule: (input: { freelancerId: string; durationMinutes: number; earliest?: string; latest?: string; book?: boolean; title?: string; notes?: string }) =>
    data(axiosInstance.post<ApiResponse<{ slot: TimeSlot; booking?: Booking }>>('/schedule/auto-schedule', input)),
};
