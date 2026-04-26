export type Agency = {
  agency_id: string;
  email: string;
  name: string;
};

export type Guide = {
  id: string;
  name: string;
  lastname: string;
  agency_id: string;
  bonus_points: number;
  removed?: boolean;
};

export type Guest = {
  id?: string;
  name: string;
  date_of_birth: string;
  age?: number;
  city: string;
  phone: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  errors?: string[];
};

export type GuestList = {
  id: string;
  booking_id: string;
  source: string;
  created_at: string;
  updated_at: string;
  guests: Guest[];
  guide_ids?: string[];
};
