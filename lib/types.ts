export type Patient = {
  id: string;
  name: string;
  dob_or_age: string | null;
  sex: string | null;
  notes: string | null;
  created_at: string;
};

export type Complaint = {
  id: string;
  encounter_id: string;
  symptom_text: string;
  symptom_tag: string | null;
  severity: string | null;
  complaint_date: string;
};

export type Prescription = {
  id: string;
  encounter_id: string;
  medicine: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  rx_date: string;
};

export type Finding = {
  id: string;
  investigation_id: string;
  key: string | null;
  value: string | null;
  unit: string | null;
  abnormal_flag: boolean | null;
  impression_text: string | null;
  confirmed_by_user: boolean;
};

export type Investigation = {
  id: string;
  encounter_id: string;
  name: string;
  ordered_date: string;
  pdf_path: string | null;
  extraction_status: string;
  findings: Finding[];
};

export type Encounter = {
  id: string;
  patient_id: string;
  date: string;
  type: string;
  notes: string | null;
  complaints: Complaint[];
  prescriptions: Prescription[];
  investigations: Investigation[];
};

// Sentinel value for the "no medicine advised" option on prescriptions.
export const NO_MEDICINE = "No medicine advised";
