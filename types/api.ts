import type { Guest, GuestList, Guide } from "@/types/domain";

export type OkResponse = { ok?: boolean };
export type IdResponse = { id?: string };

export type GuideAssignmentResponse = {
  detail: string;
  assignment_id: string;
  booking_id: string;
  guide_id: string;
  guide_name: string;
  guide_lastname: string;
  created_at: string;
};

export type GuestListByBookingResponse = { guest_list: GuestList };

export type GuestListPreviewResponse = {
  booking_id: string;
  preview_id?: string;
  guests: Guest[];
  errors: string[];
  guest_list?: GuestList;
};

export type GuestListNewConfirmResponse = {
  success?: boolean;
  preview_mode?: boolean;
  booking_id?: string;
  preview_id?: string;
  message?: string;
  errors?: Array<string | { message?: string; detail?: string; row?: number; col?: number; column?: string; severity?: string; [key: string]: unknown }>;
  guests?: Array<Guest & { errors?: string[]; row?: number }>;
  guest_list_id?: string;
  guest_list?: GuestList;
  detail?: string;
  [key: string]: unknown;
};

export type GuestListModifyResponse = { detail: string; guest_list: GuestList };
export type GuestListDeleteResponse = { detail: string };

export type GuidesResponse = { guides: Guide[] };
export type GuidesAdminResponse = Record<string, Guide[]>;

export type GuideDeleteResponse = { detail: string };

export type AgencyInfo = { agency_id: string; email: string; name: string | null };
export type AgencyListResponse = { agencies: AgencyInfo[] };

export type ChangeAgencyEmailResponse = { agency_id: string; old_email: string; new_email: string };
export type ChangeAgencyNameResponse = { agency_id: string; old_name: string | null; new_name: string };
export type RemoveAgencyResponse = { agency_id: string; email: string; agency_name: string | null; detail: string };
