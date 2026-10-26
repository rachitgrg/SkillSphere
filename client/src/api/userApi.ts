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

export interface PortfolioItemInput {
  title: string;
  description: string;
  url?: string;
  technologies?: string[];
  /** Uploaded to Cloudinary (multipart). */
  images?: File[];
  /** Used instead of files when uploads are not configured. */
  imageUrls?: string[];
}

const multipart = (fields: Record<string, string | undefined>, files: [string, File[]][]) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
  for (const [key, list] of files) for (const file of list) form.append(key, file);
  return form;
};

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

  uploadAvatar: (file: File) => data(axiosInstance.post<ApiResponse<User>>('/users/me/avatar', multipart({}, [['avatar', [file]]]))),

  uploadResume: (file: File) =>
    data(axiosInstance.post<ApiResponse<FreelancerProfile>>('/users/freelancers/me/resume', multipart({}, [['resume', [file]]]))),

  deleteResume: () => data(axiosInstance.delete<ApiResponse<FreelancerProfile>>('/users/freelancers/me/resume')),

  /** Multipart when files are attached, JSON (image URLs) otherwise. */
  addPortfolioItem: ({ images = [], imageUrls, technologies, ...fields }: PortfolioItemInput) =>
    data(
      axiosInstance.post<ApiResponse<FreelancerProfile>>(
        '/users/freelancers/me/portfolio',
        images.length
          ? multipart({ ...fields, technologies: technologies?.join(',') }, [['images', images]])
          : { ...fields, technologies, imageUrls }
      )
    ),

  deletePortfolioItem: (itemId: string) =>
    data(axiosInstance.delete<ApiResponse<FreelancerProfile>>(`/users/freelancers/me/portfolio/${itemId}`)),

  requestVerification: (documents: File[], message?: string) =>
    data(
      axiosInstance.post<ApiResponse<FreelancerProfile>>(
        '/users/freelancers/me/verification-request',
        multipart({ message }, [['documents', documents]])
      )
    ),
};
