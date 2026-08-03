/** Record shapes as stored by the API (see infra/lambda_function.py). */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationStatus = 'new' | 'reviewed' | 'contacted' | 'rejected';
export type UserRole = 'owner' | 'staff';

/**
 * Who wrote the review. The server stamps this on every record it hands back,
 * defaulting to 'family' — records predating the field (the four imported
 * samples) therefore keep behaving exactly as they always did.
 */
export type ReviewAudience = 'family' | 'staff';

export interface ReviewSubmission {
  rating: number;
  headline: string;
  review: string;
  /** family only */
  name?: string;
  /** family only */
  credit?: string;
  email: string;
  relationship: string;
  /** family only */
  location?: string;
  /** family only */
  service?: string;
  /**
   * STAFF ONLY — the reviewer's real full name. Collected so the owner knows
   * who wrote it; it is admin-only and never leaves the admin API. The public
   * endpoint publishes the server-derived `display.attribution` instead.
   */
  fullName?: string;
  /** staff only — true publishes as "Anonymous team member" */
  anonymous?: boolean;
  /** staff only — e.g. "Lead RBT" */
  role?: string;
  /** staff only — e.g. "2 years" */
  tenure?: string;
  /** false = private feedback; the approve action must stay disabled */
  consent: boolean;
}

export interface ReviewDisplay {
  quote: string;
  attribution: string;
  /** family only */
  location?: string;
  /** family only */
  service?: string;
  /** staff only */
  role?: string;
  /** staff only */
  tenure?: string;
  /** staff only */
  relationship?: string;
  initials: string;
  rating: number;
  order?: number;
}

export interface AdminReview {
  id: string;
  createdAt: string;
  status: ReviewStatus;
  /** absent on records written before team reviews existed — read it through
   *  `audienceOf()` in screens/Reviews.tsx, never directly */
  audience?: ReviewAudience;
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
