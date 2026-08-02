/** Record shapes as stored by the API (see infra/lambda_function.py). */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationStatus = 'new' | 'reviewed' | 'contacted' | 'rejected';
export type UserRole = 'owner' | 'staff';

export interface ReviewSubmission {
  rating: number;
  headline: string;
  review: string;
  name: string;
  credit: string;
  email: string;
  relationship: string;
  location: string;
  service: string;
  /** false = private feedback; the approve action must stay disabled */
  consent: boolean;
}

export interface ReviewDisplay {
  quote: string;
  attribution: string;
  location: string;
  service: string;
  initials: string;
  rating: number;
  order?: number;
}

export interface AdminReview {
  id: string;
  createdAt: string;
  status: ReviewStatus;
  submission: ReviewSubmission;
  display: ReviewDisplay;
  moderation?: { decidedAt?: string; decidedBy?: string; note?: string };
  source?: { ip?: string; userAgent?: string };
}

export interface StaffPhoto {
  key?: string;
  url: string;
  w?: number;
  h?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  isFounder: boolean;
  active: boolean;
  order: number;
  photo?: StaffPhoto | null;
  credentials?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplicationValues {
  name: string;
  email: string;
  phone: string;
  dob: string;
  street: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  position: string;
  wage: string;
  rightToWork: string;
  references: string;
}

export interface AdminApplication {
  id: string;
  createdAt: string;
  status: ApplicationStatus;
  values: ApplicationValues;
  resume?: { key?: string; filename?: string; size?: number; contentType?: string } | null;
  source?: { ip?: string; userAgent?: string };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
}
