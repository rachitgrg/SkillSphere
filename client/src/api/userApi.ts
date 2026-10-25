import axiosInstance from './axiosInstance';
import { data } from './request';
import type {
  Address,
  ApiResponse,
  ClientProfile,
  FreelancerProfile,
  GeoPoint,
  MeResponse,
  PublicClientProfile,
  PublicFreelancerProfile,
  User,
} from '../types';

export interface UpdateMeInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  address?: Address;
  location?: GeoPoint;
}

export type FreelancerProfileInput = Partial<
  Pick<
    FreelancerProfile,
    | 'title'
    | 'headline'
    | 'skills'
    | 'portfolio'
    | 'certifications'
    | 'workExperience'
    | 'education'
    | 'hourlyRate'
    | 'availability'
    | 'availabilitySlots'
    | 'languages'
    | 'socialLinks'
    | 'milestonePricing'
  >
> & { location?: GeoPoint };

export type ClientProfileInput = Partial<
  Pick<ClientProfile, 'companyName' | 'companyWebsite' | 'companySize' | 'industry' | 'description'>
>;

export const userApi = {
  getMe: () => data(axiosInstance.get<ApiResponse<MeResponse>>('/users/me')),

  updateMe: (input: UpdateMeInput) => data(axiosInstance.put<ApiResponse<User>>('/users/me', input)),

  getFreelancerProfile: (userId: string) =>
    data(axiosInstance.get<ApiResponse<PublicFreelancerProfile>>(`/users/freelancers/${userId}`)),

  updateFreelancerProfile: (input: FreelancerProfileInput) =>
    data(axiosInstance.put<ApiResponse<FreelancerProfile>>('/users/freelancers/me', input)),

  getClientProfile: (userId: string) =>
    data(axiosInstance.get<ApiResponse<PublicClientProfile>>(`/users/clients/${userId}`)),

  updateClientProfile: (input: ClientProfileInput) =>
    data(axiosInstance.put<ApiResponse<ClientProfile>>('/users/clients/me', input)),
};
