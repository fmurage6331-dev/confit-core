export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admissions: {
        Row: {
          admission_reason: string | null
          admission_type: string | null
          admitted_at: string | null
          admitting_doctor: string | null
          bed_id: string | null
          created_at: string | null
          created_by: string | null
          discharge_reason: string | null
          discharged_at: string | null
          encounter_id: string | null
          expected_discharge_date: string | null
          id: string
          notes: string | null
          patient_id: string | null
          status: string | null
          updated_at: string | null
          ward_id: string | null
        }
        Insert: {
          admission_reason?: string | null
          admission_type?: string | null
          admitted_at?: string | null
          admitting_doctor?: string | null
          bed_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discharge_reason?: string | null
          discharged_at?: string | null
          encounter_id?: string | null
          expected_discharge_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          status?: string | null
          updated_at?: string | null
          ward_id?: string | null
        }
        Update: {
          admission_reason?: string | null
          admission_type?: string | null
          admitted_at?: string | null
          admitting_doctor?: string | null
          bed_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discharge_reason?: string | null
          discharged_at?: string | null
          encounter_id?: string | null
          expected_discharge_date?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          status?: string | null
          updated_at?: string | null
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "admissions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          app_name: string
          facility_address: string | null
          facility_county: string | null
          facility_email: string | null
          facility_kmhfl_code: string | null
          facility_level: string | null
          facility_name: string | null
          facility_phone: string | null
          facility_sha_id: string | null
          facility_sha_provider_no: string | null
          id: string
          logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_name?: string
          facility_address?: string | null
          facility_county?: string | null
          facility_email?: string | null
          facility_kmhfl_code?: string | null
          facility_level?: string | null
          facility_name?: string | null
          facility_phone?: string | null
          facility_sha_id?: string | null
          facility_sha_provider_no?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_name?: string
          facility_address?: string | null
          facility_county?: string | null
          facility_email?: string | null
          facility_kmhfl_code?: string | null
          facility_level?: string | null
          facility_name?: string | null
          facility_phone?: string | null
          facility_sha_id?: string | null
          facility_sha_provider_no?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_number: string | null
          appointment_type: string | null
          cancellation_reason: string | null
          checked_in_at: string | null
          clinician_name: string | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          encounter_id: string | null
          id: string
          max_patients: number | null
          notes: string | null
          patient_id: string | null
          provider_id: string | null
          reason: string | null
          room_id: string | null
          scheduled_at: string
          session: string | null
          status: string | null
          time_range: unknown
          updated_at: string | null
        }
        Insert: {
          appointment_number?: string | null
          appointment_type?: string | null
          cancellation_reason?: string | null
          checked_in_at?: string | null
          clinician_name?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          encounter_id?: string | null
          id?: string
          max_patients?: number | null
          notes?: string | null
          patient_id?: string | null
          provider_id?: string | null
          reason?: string | null
          room_id?: string | null
          scheduled_at: string
          session?: string | null
          status?: string | null
          time_range?: unknown
          updated_at?: string | null
        }
        Update: {
          appointment_number?: string | null
          appointment_type?: string | null
          cancellation_reason?: string | null
          checked_in_at?: string | null
          clinician_name?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          encounter_id?: string | null
          id?: string
          max_patients?: number | null
          notes?: string | null
          patient_id?: string | null
          provider_id?: string | null
          reason?: string | null
          room_id?: string | null
          scheduled_at?: string
          session?: string | null
          status?: string | null
          time_range?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_archive_runs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          newest_row: string | null
          oldest_row: string | null
          rows_archived: number | null
          run_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          newest_row?: string | null
          oldest_row?: string | null
          rows_archived?: number | null
          run_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          newest_row?: string | null
          oldest_row?: string | null
          rows_archived?: number | null
          run_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log_archive: {
        Row: {
          action: string | null
          archived_at: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          archived_at?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          archived_at?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      beds: {
        Row: {
          bed_number: string | null
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          ward_id: string | null
        }
        Insert: {
          bed_number?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          ward_id?: string | null
        }
        Update: {
          bed_number?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          admission_id: string | null
          authored_at: string | null
          authored_by: string | null
          content: string | null
          created_at: string | null
          encounter_id: string | null
          id: string
          note_type: string | null
          updated_at: string | null
        }
        Insert: {
          admission_id?: string | null
          authored_at?: string | null
          authored_by?: string | null
          content?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          note_type?: string | null
          updated_at?: string | null
        }
        Update: {
          admission_id?: string | null
          authored_at?: string | null
          authored_by?: string | null
          content?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          note_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_otps: {
        Row: {
          consent_type: string | null
          created_at: string | null
          delivery_status: string | null
          encounter_id: string | null
          expires_at: string | null
          id: string
          otp_hash: string | null
          override_reason: string | null
          patient_id: string | null
          phone: string | null
          receptionist_user_id: string | null
          updated_at: string | null
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          consent_type?: string | null
          created_at?: string | null
          delivery_status?: string | null
          encounter_id?: string | null
          expires_at?: string | null
          id?: string
          otp_hash?: string | null
          override_reason?: string | null
          patient_id?: string | null
          phone?: string | null
          receptionist_user_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          consent_type?: string | null
          created_at?: string | null
          delivery_status?: string | null
          encounter_id?: string | null
          expires_at?: string | null
          id?: string
          otp_hash?: string | null
          override_reason?: string | null
          patient_id?: string | null
          phone?: string | null
          receptionist_user_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_otps_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "consent_otps_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_otps_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_otps_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      contracted_prices: {
        Row: {
          contracted_price: number | null
          created_at: string | null
          created_by: string | null
          id: string
          insurance_provider_id: string | null
          item_id: string | null
          item_type: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          contracted_price?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurance_provider_id?: string | null
          item_id?: string | null
          item_type?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          contracted_price?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurance_provider_id?: string | null
          item_id?: string | null
          item_type?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracted_prices_insurance_provider_id_fkey"
            columns: ["insurance_provider_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          delivery_date: string
          expiry_date: string | null
          id: string
          invoice_number: string | null
          item_name: string
          notes: string | null
          quantity: number
          received_by: string | null
          stock_item_id: string | null
          supplier: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          expiry_date?: string | null
          id?: string
          invoice_number?: string | null
          item_name: string
          notes?: string | null
          quantity: number
          received_by?: string | null
          stock_item_id?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          expiry_date?: string | null
          id?: string
          invoice_number?: string | null
          item_name?: string
          notes?: string | null
          quantity?: number
          received_by?: string | null
          stock_item_id?: string | null
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dha_outbound_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          encounter_id: string | null
          error_message: string | null
          id: string
          insurer_type: string | null
          last_attempted_at: string | null
          patient_id: string | null
          payload: Json | null
          queue_type: string | null
          response: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          encounter_id?: string | null
          error_message?: string | null
          id?: string
          insurer_type?: string | null
          last_attempted_at?: string | null
          patient_id?: string | null
          payload?: Json | null
          queue_type?: string | null
          response?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          encounter_id?: string | null
          error_message?: string | null
          id?: string
          insurer_type?: string | null
          last_attempted_at?: string | null
          patient_id?: string | null
          payload?: Json | null
          queue_type?: string | null
          response?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dha_outbound_queue_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "dha_outbound_queue_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dha_outbound_queue_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dha_outbound_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      dialysis_sessions: {
        Row: {
          access_site: string | null
          access_type: string | null
          admission_id: string | null
          anticoagulation_type: string | null
          blood_flow_rate: number | null
          complications: string[] | null
          created_at: string | null
          dialysate_flow_rate: number | null
          edema_grade: string | null
          encounter_id: string | null
          end_time: string | null
          heparin_bolus: number | null
          heparin_maintenance: number | null
          id: string
          machine_id: string | null
          nurse_notes: string | null
          patient_id: string
          performed_by: string | null
          post_bp_diastolic: number | null
          post_bp_systolic: number | null
          post_heart_rate: number | null
          post_weight_kg: number | null
          pre_bp_diastolic: number | null
          pre_bp_systolic: number | null
          pre_heart_rate: number | null
          pre_weight_kg: number | null
          room_id: string | null
          session_date: string
          start_time: string | null
          status: string | null
          uf_achieved: number | null
          uf_goal: number | null
          updated_at: string | null
        }
        Insert: {
          access_site?: string | null
          access_type?: string | null
          admission_id?: string | null
          anticoagulation_type?: string | null
          blood_flow_rate?: number | null
          complications?: string[] | null
          created_at?: string | null
          dialysate_flow_rate?: number | null
          edema_grade?: string | null
          encounter_id?: string | null
          end_time?: string | null
          heparin_bolus?: number | null
          heparin_maintenance?: number | null
          id?: string
          machine_id?: string | null
          nurse_notes?: string | null
          patient_id: string
          performed_by?: string | null
          post_bp_diastolic?: number | null
          post_bp_systolic?: number | null
          post_heart_rate?: number | null
          post_weight_kg?: number | null
          pre_bp_diastolic?: number | null
          pre_bp_systolic?: number | null
          pre_heart_rate?: number | null
          pre_weight_kg?: number | null
          room_id?: string | null
          session_date?: string
          start_time?: string | null
          status?: string | null
          uf_achieved?: number | null
          uf_goal?: number | null
          updated_at?: string | null
        }
        Update: {
          access_site?: string | null
          access_type?: string | null
          admission_id?: string | null
          anticoagulation_type?: string | null
          blood_flow_rate?: number | null
          complications?: string[] | null
          created_at?: string | null
          dialysate_flow_rate?: number | null
          edema_grade?: string | null
          encounter_id?: string | null
          end_time?: string | null
          heparin_bolus?: number | null
          heparin_maintenance?: number | null
          id?: string
          machine_id?: string | null
          nurse_notes?: string | null
          patient_id?: string
          performed_by?: string | null
          post_bp_diastolic?: number | null
          post_bp_systolic?: number | null
          post_heart_rate?: number | null
          post_weight_kg?: number | null
          pre_bp_diastolic?: number | null
          pre_bp_systolic?: number | null
          pre_heart_rate?: number | null
          pre_weight_kg?: number | null
          room_id?: string | null
          session_date?: string
          start_time?: string | null
          status?: string | null
          uf_achieved?: number | null
          uf_goal?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dialysis_sessions_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "dialysis_sessions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialysis_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_amendments: {
        Row: {
          amendment_text: string | null
          created_at: string | null
          created_by: string | null
          encounter_id: string | null
          id: string
          reason_for_amendment: string | null
          updated_at: string | null
        }
        Insert: {
          amendment_text?: string | null
          created_at?: string | null
          created_by?: string | null
          encounter_id?: string | null
          id?: string
          reason_for_amendment?: string | null
          updated_at?: string | null
        }
        Update: {
          amendment_text?: string | null
          created_at?: string | null
          created_by?: string | null
          encounter_id?: string | null
          id?: string
          reason_for_amendment?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_amendments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_amendments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_amendments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_diagnoses: {
        Row: {
          created_at: string | null
          created_by: string | null
          diagnosis_type: string | null
          encounter_id: string | null
          icd11_code: string | null
          icd11_title: string | null
          icd11_uri: string | null
          id: string
          notes: string | null
          sequence: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          diagnosis_type?: string | null
          encounter_id?: string | null
          icd11_code?: string | null
          icd11_title?: string | null
          icd11_uri?: string | null
          id?: string
          notes?: string | null
          sequence?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          diagnosis_type?: string | null
          encounter_id?: string | null
          icd11_code?: string | null
          icd11_title?: string | null
          icd11_uri?: string | null
          id?: string
          notes?: string | null
          sequence?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_indicator_tags: {
        Row: {
          created_at: string | null
          encounter_id: string | null
          id: string
          indicator_code: string | null
          tagged_at: string | null
          tagged_by: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          indicator_code?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          indicator_code?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_indicator_tags_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_indicator_tags_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_indicator_tags_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_room_visits: {
        Row: {
          created_at: string | null
          encounter_id: string | null
          entered_at: string | null
          id: string
          left_at: string | null
          room_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encounter_id?: string | null
          entered_at?: string | null
          id?: string
          left_at?: string | null
          room_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encounter_id?: string | null
          entered_at?: string | null
          id?: string
          left_at?: string | null
          room_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_room_visits_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_room_visits_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_room_visits_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_room_visits_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          amount_paid: number | null
          claim_amount: number | null
          claim_approved_at: string | null
          claim_number: string | null
          claim_resolved_at: string | null
          claim_status: string | null
          claim_submitted_at: string | null
          created_at: string | null
          created_by: string | null
          current_room_id: string | null
          diagnoses: Json | null
          encounter_type: string | null
          from_room: string | null
          history: Json | null
          id: string
          insurance_clearance_status: string | null
          insurance_coverage_percentage: number | null
          insurance_covered: number | null
          insurance_policy_number: string | null
          insurance_provider_id: string | null
          insurer_type: string | null
          is_emergency: boolean | null
          next_room_id: string | null
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          patient_due: number | null
          patient_id: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_reference: string | null
          payment_status: string | null
          preauth_number: string | null
          referral_direction: string | null
          referral_out_facility: string | null
          referral_out_reason: string | null
          sha_benefit_package_id: string | null
          sha_fund_type: string | null
          sha_notification_number: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          subtotal: number | null
          tests: Json | null
          updated_at: string | null
          vitals: Json | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount_paid?: number | null
          claim_amount?: number | null
          claim_approved_at?: string | null
          claim_number?: string | null
          claim_resolved_at?: string | null
          claim_status?: string | null
          claim_submitted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          diagnoses?: Json | null
          encounter_type?: string | null
          from_room?: string | null
          history?: Json | null
          id?: string
          insurance_clearance_status?: string | null
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_policy_number?: string | null
          insurance_provider_id?: string | null
          insurer_type?: string | null
          is_emergency?: boolean | null
          next_room_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          patient_due?: number | null
          patient_id?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          preauth_number?: string | null
          referral_direction?: string | null
          referral_out_facility?: string | null
          referral_out_reason?: string | null
          sha_benefit_package_id?: string | null
          sha_fund_type?: string | null
          sha_notification_number?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          subtotal?: number | null
          tests?: Json | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount_paid?: number | null
          claim_amount?: number | null
          claim_approved_at?: string | null
          claim_number?: string | null
          claim_resolved_at?: string | null
          claim_status?: string | null
          claim_submitted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          diagnoses?: Json | null
          encounter_type?: string | null
          from_room?: string | null
          history?: Json | null
          id?: string
          insurance_clearance_status?: string | null
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_policy_number?: string | null
          insurance_provider_id?: string | null
          insurer_type?: string | null
          is_emergency?: boolean | null
          next_room_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          patient_due?: number | null
          patient_id?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          preauth_number?: string | null
          referral_direction?: string | null
          referral_out_facility?: string | null
          referral_out_reason?: string | null
          sha_benefit_package_id?: string | null
          sha_fund_type?: string | null
          sha_notification_number?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          subtotal?: number | null
          tests?: Json | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_insurance_provider_id_fkey"
            columns: ["insurance_provider_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_next_room_id_fkey"
            columns: ["next_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_sha_benefit_package_id_fkey"
            columns: ["sha_benefit_package_id"]
            isOneToOne: false
            referencedRelation: "sha_benefit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_of_care: {
        Row: {
          created_at: string | null
          encounter_id: string | null
          episode_type: string | null
          id: string
          patient_id: string | null
          period_end: string | null
          period_start: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encounter_id?: string | null
          episode_type?: string | null
          id?: string
          patient_id?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encounter_id?: string | null
          episode_type?: string | null
          id?: string
          patient_id?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_of_care_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "episode_of_care_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_of_care_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_of_care_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_features: {
        Row: {
          description: string | null
          feature_key: string
          min_level: number
        }
        Insert: {
          description?: string | null
          feature_key: string
          min_level: number
        }
        Update: {
          description?: string | null
          feature_key?: string
          min_level?: number
        }
        Relationships: []
      }
      fund_utilizations: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          updated_at: string
          util_date: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          util_date?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          util_date?: string
        }
        Relationships: []
      }
      icd11_codes: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          uri: string | null
          validated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          uri?: string | null
          validated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          uri?: string | null
          validated_at?: string | null
        }
        Relationships: []
      }
      icu_hourly_charts: {
        Row: {
          admission_id: string
          blood_in: number | null
          bp_diastolic: number | null
          bp_systolic: number | null
          created_at: string | null
          drain_out: number | null
          ett_depth: string | null
          ett_size: string | null
          fio2: number | null
          gcs_eye: number | null
          gcs_motor: number | null
          gcs_verbal: number | null
          heart_rate: number | null
          id: string
          iv_fluid_in: number | null
          iv_lines: string | null
          ngt: boolean | null
          nursing_notes: string | null
          oral_in: number | null
          other_out: number | null
          peep: number | null
          rass_score: number | null
          recorded_at: string
          recorded_by: string | null
          respiratory_rate: number | null
          sedation_dose: string | null
          sedation_drug: string | null
          spo2: number | null
          temperature_c: number | null
          tidal_volume: number | null
          updated_at: string | null
          urinary_catheter: boolean | null
          urine_out: number | null
          vent_mode: string | null
          vent_rate: number | null
        }
        Insert: {
          admission_id: string
          blood_in?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string | null
          drain_out?: number | null
          ett_depth?: string | null
          ett_size?: string | null
          fio2?: number | null
          gcs_eye?: number | null
          gcs_motor?: number | null
          gcs_verbal?: number | null
          heart_rate?: number | null
          id?: string
          iv_fluid_in?: number | null
          iv_lines?: string | null
          ngt?: boolean | null
          nursing_notes?: string | null
          oral_in?: number | null
          other_out?: number | null
          peep?: number | null
          rass_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate?: number | null
          sedation_dose?: string | null
          sedation_drug?: string | null
          spo2?: number | null
          temperature_c?: number | null
          tidal_volume?: number | null
          updated_at?: string | null
          urinary_catheter?: boolean | null
          urine_out?: number | null
          vent_mode?: string | null
          vent_rate?: number | null
        }
        Update: {
          admission_id?: string
          blood_in?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string | null
          drain_out?: number | null
          ett_depth?: string | null
          ett_size?: string | null
          fio2?: number | null
          gcs_eye?: number | null
          gcs_motor?: number | null
          gcs_verbal?: number | null
          heart_rate?: number | null
          id?: string
          iv_fluid_in?: number | null
          iv_lines?: string | null
          ngt?: boolean | null
          nursing_notes?: string | null
          oral_in?: number | null
          other_out?: number | null
          peep?: number | null
          rass_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate?: number | null
          sedation_dose?: string | null
          sedation_drug?: string | null
          spo2?: number | null
          temperature_c?: number | null
          tidal_volume?: number | null
          updated_at?: string | null
          urinary_catheter?: boolean | null
          urine_out?: number | null
          vent_mode?: string | null
          vent_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "icu_hourly_charts_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_benefit_categories: {
        Row: {
          category: string
          coverage_percentage: number
          created_at: string
          id: string
          limit_amount: number
          plan_id: string
          requires_preauth: boolean
        }
        Insert: {
          category: string
          coverage_percentage?: number
          created_at?: string
          id?: string
          limit_amount?: number
          plan_id: string
          requires_preauth?: boolean
        }
        Update: {
          category?: string
          coverage_percentage?: number
          created_at?: string
          id?: string
          limit_amount?: number
          plan_id?: string
          requires_preauth?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "insurance_benefit_categories_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_benefit_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_benefit_plans: {
        Row: {
          benefit_period: string
          created_at: string
          created_by: string | null
          id: string
          insurer_id: string
          is_active: boolean
          plan_name: string
          updated_at: string
        }
        Insert: {
          benefit_period?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id: string
          is_active?: boolean
          plan_name: string
          updated_at?: string
        }
        Update: {
          benefit_period?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string
          is_active?: boolean
          plan_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_benefit_plans_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_providers: {
        Row: {
          code: string
          coverage_percentage: number
          coverage_rule: string | null
          created_at: string
          created_by: string | null
          id: string
          insurer_type: string | null
          is_active: boolean
          name: string
          per_visit_limit: number | null
          updated_at: string
        }
        Insert: {
          code: string
          coverage_percentage?: number
          coverage_rule?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_type?: string | null
          is_active?: boolean
          name: string
          per_visit_limit?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          coverage_percentage?: number
          coverage_rule?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_type?: string | null
          is_active?: boolean
          name?: string
          per_visit_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          encounter_id: string | null
          id: string
          insurance_covered_amount: number | null
          invoice_id: string | null
          item_type: string | null
          quantity: number | null
          source_id: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          insurance_covered_amount?: number | null
          invoice_id?: string | null
          item_type?: string | null
          quantity?: number | null
          source_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          insurance_covered_amount?: number | null
          invoice_id?: string | null
          item_type?: string | null
          quantity?: number | null
          source_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "invoice_line_items_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string | null
          received_by: string | null
          reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          received_by?: string | null
          reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          received_by?: string | null
          reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          balance: number | null
          created_at: string | null
          created_by: string | null
          discount: number | null
          encounter_id: string | null
          id: string
          insurance_covered: number | null
          invoice_number: string | null
          patient_id: string | null
          status: string | null
          subtotal: number | null
          total_due: number | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          encounter_id?: string | null
          id?: string
          insurance_covered?: number | null
          invoice_number?: string | null
          patient_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_due?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          discount?: number | null
          encounter_id?: string | null
          id?: string
          insurance_covered?: number | null
          invoice_number?: string | null
          patient_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_due?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "invoices_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          admission_id: string | null
          catalog_id: string | null
          clinical_indication: string | null
          collected_at: string | null
          created_at: string | null
          decline_reason: string | null
          encounter_id: string | null
          encounter_type: string | null
          id: string
          instructions: string | null
          is_critical: boolean | null
          order_number: string | null
          ordered_at: string | null
          ordered_by: string | null
          patient_id: string | null
          priority: string | null
          requested_by_room_id: string | null
          specimen_type: string | null
          status: string | null
          test_name: string | null
          updated_at: string | null
        }
        Insert: {
          admission_id?: string | null
          catalog_id?: string | null
          clinical_indication?: string | null
          collected_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          id?: string
          instructions?: string | null
          is_critical?: boolean | null
          order_number?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          patient_id?: string | null
          priority?: string | null
          requested_by_room_id?: string | null
          specimen_type?: string | null
          status?: string | null
          test_name?: string | null
          updated_at?: string | null
        }
        Update: {
          admission_id?: string | null
          catalog_id?: string | null
          clinical_indication?: string | null
          collected_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          id?: string
          instructions?: string | null
          is_critical?: boolean | null
          order_number?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          patient_id?: string | null
          priority?: string | null
          requested_by_room_id?: string | null
          specimen_type?: string | null
          status?: string | null
          test_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "lab_test_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "lab_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_requested_by_room_id_fkey"
            columns: ["requested_by_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string | null
          id: string
          is_critical: boolean | null
          lab_order_id: string | null
          notes: string | null
          order_id: string | null
          performed_by: string | null
          reference_range: string | null
          reported_at: string | null
          result: Json | null
          result_value: string | null
          unit: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_critical?: boolean | null
          lab_order_id?: string | null
          notes?: string | null
          order_id?: string | null
          performed_by?: string | null
          reference_range?: string | null
          reported_at?: string | null
          result?: Json | null
          result_value?: string | null
          unit?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_critical?: boolean | null
          lab_order_id?: string | null
          notes?: string | null
          order_id?: string | null
          performed_by?: string | null
          reference_range?: string | null
          reported_at?: string | null
          result?: Json | null
          result_value?: string | null
          unit?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_catalog: {
        Row: {
          cash_price: number | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          insurance_price: number | null
          is_active: boolean
          kind: string
          loinc_code: string | null
          name: string
          parameters: Json | null
          price: number
          sha_tariff_code: string | null
          target_room_id: string | null
          updated_at: string
          who_edl: boolean | null
        }
        Insert: {
          cash_price?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_price?: number | null
          is_active?: boolean
          kind?: string
          loinc_code?: string | null
          name: string
          parameters?: Json | null
          price?: number
          sha_tariff_code?: string | null
          target_room_id?: string | null
          updated_at?: string
          who_edl?: boolean | null
        }
        Update: {
          cash_price?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_price?: number | null
          is_active?: boolean
          kind?: string
          loinc_code?: string | null
          name?: string
          parameters?: Json | null
          price?: number
          sha_tariff_code?: string | null
          target_room_id?: string | null
          updated_at?: string
          who_edl?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_catalog_target_room_id_fkey"
            columns: ["target_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          age: number
          created_at: string
          created_by: string | null
          id: string
          is_medical_camp: boolean
          is_positive: boolean
          lab_number: string
          notes: string | null
          patient_name: string
          registration_id: string | null
          registration_number: string
          result: string | null
          sent_at: string | null
          sent_to_room: string | null
          test_date: string
          test_name: string
          updated_at: string
        }
        Insert: {
          age: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_medical_camp?: boolean
          is_positive?: boolean
          lab_number: string
          notes?: string | null
          patient_name: string
          registration_id?: string | null
          registration_number: string
          result?: string | null
          sent_at?: string | null
          sent_to_room?: string | null
          test_date?: string
          test_name: string
          updated_at?: string
        }
        Update: {
          age?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_medical_camp?: boolean
          is_positive?: boolean
          lab_number?: string
          notes?: string | null
          patient_name?: string
          registration_id?: string | null
          registration_number?: string
          result?: string | null
          sent_at?: string | null
          sent_to_room?: string | null
          test_date?: string
          test_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      machine_logs: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          log_date: string
          log_type: Database["public"]["Enums"]["machine_log_type"]
          machine_id: string
          next_due_date: string | null
          performed_by: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          log_date?: string
          log_type: Database["public"]["Enums"]["machine_log_type"]
          machine_id: string
          next_due_date?: string | null
          performed_by?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          log_date?: string
          log_type?: Database["public"]["Enums"]["machine_log_type"]
          machine_id?: string
          next_due_date?: string | null
          performed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          kind: string | null
          location: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string | null
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string | null
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_administrations: {
        Row: {
          administered_at: string | null
          administered_by: string | null
          administered_by_name: string | null
          admission_id: string | null
          created_at: string | null
          dose_given: string | null
          encounter_id: string | null
          id: string
          notes: string | null
          prescription_id: string | null
          route: string | null
          updated_at: string | null
        }
        Insert: {
          administered_at?: string | null
          administered_by?: string | null
          administered_by_name?: string | null
          admission_id?: string | null
          created_at?: string | null
          dose_given?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          prescription_id?: string | null
          route?: string | null
          updated_at?: string | null
        }
        Update: {
          administered_at?: string | null
          administered_by?: string | null
          administered_by_name?: string | null
          admission_id?: string | null
          created_at?: string | null
          dose_given?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          prescription_id?: string | null
          route?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_administrations_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "medication_administrations_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      moh_705_disease_mappings: {
        Row: {
          created_at: string | null
          disease_name: string | null
          icd11_chapter_block: string | null
          id: string
          keyword_pattern: string | null
          requires_deceased_status: boolean | null
          requires_lab_confirmation: boolean | null
          row_number: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disease_name?: string | null
          icd11_chapter_block?: string | null
          id?: string
          keyword_pattern?: string | null
          requires_deceased_status?: boolean | null
          requires_lab_confirmation?: boolean | null
          row_number?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disease_name?: string | null
          icd11_chapter_block?: string | null
          id?: string
          keyword_pattern?: string | null
          requires_deceased_status?: boolean | null
          requires_lab_confirmation?: boolean | null
          row_number?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      moh_indicator_definitions: {
        Row: {
          created_at: string | null
          criteria_type: string | null
          criteria_value: string | null
          description: string | null
          form_number: string | null
          id: string
          indicator_code: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria_type?: string | null
          criteria_value?: string | null
          description?: string | null
          form_number?: string | null
          id?: string
          indicator_code?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria_type?: string | null
          criteria_value?: string | null
          description?: string | null
          form_number?: string | null
          id?: string
          indicator_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      moh_indicators: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          data_type: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      moh_monthly_aggregates: {
        Row: {
          computed_at: string | null
          created_at: string | null
          id: string
          indicator_code: string | null
          period_month: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          computed_at?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          period_month?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          computed_at?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          period_month?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      moh_report_corrections: {
        Row: {
          adjusted_value: number | null
          created_at: string | null
          created_by: string | null
          id: string
          indicator_code: string | null
          period_month: string | null
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          adjusted_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          indicator_code?: string | null
          period_month?: string | null
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          adjusted_value?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          indicator_code?: string | null
          period_month?: string | null
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      moh_report_line_items: {
        Row: {
          column_label: string | null
          created_at: string | null
          id: string
          indicator_code: string | null
          row_label: string | null
          section: string | null
          sort_order: number | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          column_label?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          row_label?: string | null
          section?: string | null
          sort_order?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          column_label?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          row_label?: string | null
          section?: string | null
          sort_order?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moh_report_line_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "moh_report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      moh_report_submissions: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string | null
          export_url: string | null
          id: string
          period_month: string | null
          prepared_at: string | null
          prepared_by: string | null
          received_by: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          export_url?: string | null
          id?: string
          period_month?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          received_by?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          export_url?: string | null
          id?: string
          period_month?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          received_by?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moh_report_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "moh_report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      moh_report_templates: {
        Row: {
          created_at: string | null
          form_code: string | null
          id: string
          title: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          form_code?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          form_code?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      moh_weekly_aggregates: {
        Row: {
          computed_at: string | null
          created_at: string | null
          id: string
          indicator_code: string | null
          updated_at: string | null
          value: number | null
          week_start: string | null
        }
        Insert: {
          computed_at?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          updated_at?: string | null
          value?: number | null
          week_start?: string | null
        }
        Update: {
          computed_at?: string | null
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          updated_at?: string | null
          value?: number | null
          week_start?: string | null
        }
        Relationships: []
      }
      mortuary_records: {
        Row: {
          admitted_to_mortuary_at: string | null
          age_years: number | null
          cause_of_death: string | null
          created_at: string | null
          created_by: string | null
          daily_storage_rate: number | null
          date_of_death: string | null
          deceased_name: string | null
          encounter_id: string | null
          id: string
          intake_type: string | null
          invoice_id: string | null
          national_id: string | null
          next_of_kin_name: string | null
          next_of_kin_national_id: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          notes: string | null
          ob_number: string | null
          patient_id: string | null
          police_statement_url: string | null
          police_station: string | null
          received_by: string | null
          reference_number: string | null
          release_notes: string | null
          released_at: string | null
          released_to: string | null
          released_to_name: string | null
          released_to_relationship: string | null
          sex: string | null
          source: string | null
          status: string | null
          storage_location: string | null
          total_storage_charges: number | null
          updated_at: string | null
        }
        Insert: {
          admitted_to_mortuary_at?: string | null
          age_years?: number | null
          cause_of_death?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_storage_rate?: number | null
          date_of_death?: string | null
          deceased_name?: string | null
          encounter_id?: string | null
          id?: string
          intake_type?: string | null
          invoice_id?: string | null
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_national_id?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          ob_number?: string | null
          patient_id?: string | null
          police_statement_url?: string | null
          police_station?: string | null
          received_by?: string | null
          reference_number?: string | null
          release_notes?: string | null
          released_at?: string | null
          released_to?: string | null
          released_to_name?: string | null
          released_to_relationship?: string | null
          sex?: string | null
          source?: string | null
          status?: string | null
          storage_location?: string | null
          total_storage_charges?: number | null
          updated_at?: string | null
        }
        Update: {
          admitted_to_mortuary_at?: string | null
          age_years?: number | null
          cause_of_death?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_storage_rate?: number | null
          date_of_death?: string | null
          deceased_name?: string | null
          encounter_id?: string | null
          id?: string
          intake_type?: string | null
          invoice_id?: string | null
          national_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_national_id?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          notes?: string | null
          ob_number?: string | null
          patient_id?: string | null
          police_statement_url?: string | null
          police_station?: string | null
          received_by?: string | null
          reference_number?: string | null
          release_notes?: string | null
          released_at?: string | null
          released_to?: string | null
          released_to_name?: string | null
          released_to_relationship?: string | null
          sex?: string | null
          source?: string | null
          status?: string | null
          storage_location?: string | null
          total_storage_charges?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mortuary_records_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "mortuary_records_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortuary_records_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortuary_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "mortuary_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortuary_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_benefit_balances: {
        Row: {
          benefit_year: number
          category: string
          created_at: string
          id: string
          last_verified_at: string | null
          last_verified_by: string | null
          limit_amount: number
          manually_entered_used_elsewhere: number
          patient_id: string
          plan_id: string
          policy_number: string | null
          updated_at: string
          used_at_this_facility: number
        }
        Insert: {
          benefit_year?: number
          category: string
          created_at?: string
          id?: string
          last_verified_at?: string | null
          last_verified_by?: string | null
          limit_amount?: number
          manually_entered_used_elsewhere?: number
          patient_id: string
          plan_id: string
          policy_number?: string | null
          updated_at?: string
          used_at_this_facility?: number
        }
        Update: {
          benefit_year?: number
          category?: string
          created_at?: string
          id?: string
          last_verified_at?: string | null
          last_verified_by?: string | null
          limit_amount?: number
          manually_entered_used_elsewhere?: number
          patient_id?: string
          plan_id?: string
          policy_number?: string | null
          updated_at?: string
          used_at_this_facility?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_benefit_balances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_benefit_balances_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_benefit_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          consent_type: string | null
          consented: boolean | null
          consented_at: string | null
          consented_by: string | null
          created_at: string | null
          created_by: string | null
          encounter_id: string | null
          hie_data_sharing_consented: boolean | null
          id: string
          notes: string | null
          patient_id: string | null
          updated_at: string | null
          witness_name: string | null
        }
        Insert: {
          consent_type?: string | null
          consented?: boolean | null
          consented_at?: string | null
          consented_by?: string | null
          created_at?: string | null
          created_by?: string | null
          encounter_id?: string | null
          hie_data_sharing_consented?: boolean | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          updated_at?: string | null
          witness_name?: string | null
        }
        Update: {
          consent_type?: string | null
          consented?: boolean | null
          consented_at?: string | null
          consented_by?: string | null
          created_at?: string | null
          created_by?: string | null
          encounter_id?: string | null
          hie_data_sharing_consented?: boolean | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          updated_at?: string | null
          witness_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "patient_consents_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_registrations_legacy: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          address_line1: string | null
          address_line2: string | null
          amount_paid: number | null
          cause_of_death: string | null
          city: string | null
          country: string | null
          county: string | null
          created_at: string | null
          created_by: string | null
          current_room_id: string | null
          date_of_birth: string | null
          date_of_death: string | null
          diagnoses: Json | null
          dob_known: boolean | null
          education_level: string | null
          email: string | null
          estimated_age: number | null
          family_name: string | null
          file_number: string | null
          first_name: string | null
          from_room: string | null
          history: Json | null
          id: string
          insurance_coverage_percentage: number | null
          insurance_covered: number | null
          insurance_provider_id: string | null
          is_deceased: boolean | null
          marital_status: string | null
          middle_name: string | null
          nationality: string | null
          next_of_kin: Json | null
          next_room_id: string | null
          notes: string | null
          occupation: string | null
          paid_at: string | null
          paid_by: string | null
          patient_due: number | null
          patient_name: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_reference: string | null
          payment_status: string | null
          phone: string | null
          postal_code: string | null
          relationships: Json | null
          religion: string | null
          sex: string | null
          status: string | null
          subtotal: number | null
          tests: Json | null
          updated_at: string | null
          vitals: Json | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          address_line1?: string | null
          address_line2?: string | null
          amount_paid?: number | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          diagnoses?: Json | null
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          from_room?: string | null
          history?: Json | null
          id?: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_provider_id?: string | null
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          next_room_id?: string | null
          notes?: string | null
          occupation?: string | null
          paid_at?: string | null
          paid_by?: string | null
          patient_due?: number | null
          patient_name?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          status?: string | null
          subtotal?: number | null
          tests?: Json | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          address_line1?: string | null
          address_line2?: string | null
          amount_paid?: number | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          diagnoses?: Json | null
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          from_room?: string | null
          history?: Json | null
          id?: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_provider_id?: string | null
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          next_room_id?: string | null
          notes?: string | null
          occupation?: string | null
          paid_at?: string | null
          paid_by?: string | null
          patient_due?: number | null
          patient_name?: string | null
          payment_method?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          status?: string | null
          subtotal?: number | null
          tests?: Json | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_registrations_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_registrations_insurance_provider_id_fkey"
            columns: ["insurance_provider_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_registrations_next_room_id_fkey"
            columns: ["next_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          allergies: Json | null
          blood_group: string | null
          cause_of_death: string | null
          city: string | null
          country: string | null
          county: string | null
          cr_number: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          date_of_death: string | null
          dob_known: boolean | null
          education_level: string | null
          email: string | null
          estimated_age: number | null
          family_name: string | null
          file_number: string | null
          first_name: string | null
          id: string
          identity_verified: boolean | null
          identity_verified_at: string | null
          identity_verified_by: string | null
          is_deceased: boolean | null
          marital_status: string | null
          middle_name: string | null
          national_id: string | null
          national_id_type: string | null
          nationality: string | null
          next_of_kin: Json | null
          occupation: string | null
          patient_name: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          relationships: Json | null
          religion: string | null
          sex: string | null
          sha_fund_type: string | null
          sha_last_verified_at: string | null
          sha_member_number: string | null
          sha_membership_checked_at: string | null
          sha_membership_status: string | null
          sha_membership_verified_at: string | null
          sha_principal_member_number: string | null
          sha_relationship_to_principal: string | null
          sha_scheme_code: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: Json | null
          blood_group?: string | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          cr_number?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          id?: string
          identity_verified?: boolean | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          national_id?: string | null
          national_id_type?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          occupation?: string | null
          patient_name?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          sha_fund_type?: string | null
          sha_last_verified_at?: string | null
          sha_member_number?: string | null
          sha_membership_checked_at?: string | null
          sha_membership_status?: string | null
          sha_membership_verified_at?: string | null
          sha_principal_member_number?: string | null
          sha_relationship_to_principal?: string | null
          sha_scheme_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: Json | null
          blood_group?: string | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          cr_number?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          id?: string
          identity_verified?: boolean | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          national_id?: string | null
          national_id_type?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          occupation?: string | null
          patient_name?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          sha_fund_type?: string | null
          sha_last_verified_at?: string | null
          sha_member_number?: string | null
          sha_membership_checked_at?: string | null
          sha_membership_status?: string | null
          sha_membership_verified_at?: string | null
          sha_principal_member_number?: string | null
          sha_relationship_to_principal?: string | null
          sha_scheme_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          admission_id: string | null
          created_at: string
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          dispensed_by_name: string | null
          dispensed_from_store_id: string | null
          dosage: string | null
          drug_name: string
          duration: string | null
          encounter_id: string | null
          encounter_type: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_id: string | null
          medication_name: string | null
          notes: string | null
          prescribed_by_name: string | null
          quantity: number
          registration_id: string
          status: string
          stock_item_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          admission_id?: string | null
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          dispensed_from_store_id?: string | null
          dosage?: string | null
          drug_name: string
          duration?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_id?: string | null
          medication_name?: string | null
          notes?: string | null
          prescribed_by_name?: string | null
          quantity?: number
          registration_id: string
          status?: string
          stock_item_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          admission_id?: string | null
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dispensed_by_name?: string | null
          dispensed_from_store_id?: string | null
          dosage?: string | null
          drug_name?: string
          duration?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_id?: string | null
          medication_name?: string | null
          notes?: string | null
          prescribed_by_name?: string | null
          quantity?: number
          registration_id?: string
          status?: string
          stock_item_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_dispensed_from_store_id_fkey"
            columns: ["dispensed_from_store_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          council_expiry_date: string | null
          council_full_name: string | null
          council_qualification: string | null
          council_registration_number: string | null
          council_status: string | null
          council_type: string | null
          council_verified: boolean | null
          council_verified_at: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          council_expiry_date?: string | null
          council_full_name?: string | null
          council_qualification?: string | null
          council_registration_number?: string | null
          council_status?: string | null
          council_type?: string | null
          council_verified?: boolean | null
          council_verified_at?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          council_expiry_date?: string | null
          council_full_name?: string | null
          council_qualification?: string | null
          council_registration_number?: string | null
          council_status?: string | null
          council_type?: string | null
          council_verified?: boolean | null
          council_verified_at?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      radiology_orders: {
        Row: {
          admission_id: string | null
          catalog_id: string | null
          clinical_indication: string | null
          created_at: string | null
          encounter_id: string | null
          encounter_type: string | null
          id: string
          ordered_at: string | null
          ordered_by: string | null
          patient_id: string | null
          priority: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admission_id?: string | null
          catalog_id?: string | null
          clinical_indication?: string | null
          created_at?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          id?: string
          ordered_at?: string | null
          ordered_by?: string | null
          patient_id?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admission_id?: string | null
          catalog_id?: string | null
          clinical_indication?: string | null
          created_at?: string | null
          encounter_id?: string | null
          encounter_type?: string | null
          id?: string
          ordered_at?: string | null
          ordered_by?: string | null
          patient_id?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_orders_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "lab_test_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "radiology_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_results: {
        Row: {
          created_at: string | null
          findings: string | null
          id: string
          image_paths: Json | null
          impression: string | null
          order_id: string | null
          radiologist: string | null
          reported_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          findings?: string | null
          id?: string
          image_paths?: Json | null
          impression?: string | null
          order_id?: string | null
          radiologist?: string | null
          reported_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          findings?: string | null
          id?: string
          image_paths?: Json | null
          impression?: string | null
          order_id?: string | null
          radiologist?: string | null
          reported_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "radiology_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      room_indicator_map: {
        Row: {
          created_at: string | null
          id: string
          indicator_code: string | null
          room_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          room_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          indicator_code?: string | null
          room_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_indicator_map_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_benefit_packages: {
        Row: {
          annual_limit: number | null
          can_combine_with: string[] | null
          code: string | null
          created_at: string | null
          daily_limit: number | null
          facility_levels: string[] | null
          fund_type: string | null
          id: string
          is_active: boolean | null
          name: string | null
          notes: string | null
          per_visit_limit: number | null
          requires_preauth: boolean | null
          updated_at: string | null
        }
        Insert: {
          annual_limit?: number | null
          can_combine_with?: string[] | null
          code?: string | null
          created_at?: string | null
          daily_limit?: number | null
          facility_levels?: string[] | null
          fund_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          per_visit_limit?: number | null
          requires_preauth?: boolean | null
          updated_at?: string | null
        }
        Update: {
          annual_limit?: number | null
          can_combine_with?: string[] | null
          code?: string | null
          created_at?: string | null
          daily_limit?: number | null
          facility_levels?: string[] | null
          fund_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          per_visit_limit?: number | null
          requires_preauth?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sha_claim_items: {
        Row: {
          amount: number | null
          claim_id: string | null
          created_at: string | null
          description: string | null
          id: string
          intervention_code: string | null
          invoice_line_item_id: string | null
          is_included: boolean | null
          item_type: string | null
          quantity: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          claim_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          intervention_code?: string | null
          invoice_line_item_id?: string | null
          is_included?: boolean | null
          item_type?: string | null
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          claim_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          intervention_code?: string | null
          invoice_line_item_id?: string | null
          is_included?: boolean | null
          item_type?: string | null
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_claim_items_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "sha_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claim_items_invoice_line_item_id_fkey"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_claim_packages: {
        Row: {
          claim_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          package_code: string | null
          package_id: string | null
          updated_at: string | null
        }
        Insert: {
          claim_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          package_code?: string | null
          package_id?: string | null
          updated_at?: string | null
        }
        Update: {
          claim_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          package_code?: string | null
          package_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_claim_packages_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "sha_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claim_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sha_benefit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_claims: {
        Row: {
          acknowledged_at: string | null
          approved_amount: number | null
          claim_number: string | null
          claim_subtype: string | null
          claim_type: string | null
          consent_token: string | null
          cr_number_at_claim: string | null
          cr_number_missing: boolean | null
          created_at: string | null
          dha_claim_id: string | null
          encounter_id: string | null
          fhir_built_at: string | null
          fhir_bundle: Json | null
          fund_type: string | null
          id: string
          notes: string | null
          otp_verified: boolean | null
          otp_verified_at: string | null
          patient_id: string | null
          preauth_approved_at: string | null
          preauth_id: string | null
          preauth_notes: string | null
          preauth_number: string | null
          preauth_requested_at: string | null
          preauth_status: string | null
          preauth_submitted_at: string | null
          rejected_amount: number | null
          rejection_reason: string | null
          resolved_at: string | null
          sha_member_missing: boolean | null
          sha_member_no_at_claim: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          approved_amount?: number | null
          claim_number?: string | null
          claim_subtype?: string | null
          claim_type?: string | null
          consent_token?: string | null
          cr_number_at_claim?: string | null
          cr_number_missing?: boolean | null
          created_at?: string | null
          dha_claim_id?: string | null
          encounter_id?: string | null
          fhir_built_at?: string | null
          fhir_bundle?: Json | null
          fund_type?: string | null
          id?: string
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          patient_id?: string | null
          preauth_approved_at?: string | null
          preauth_id?: string | null
          preauth_notes?: string | null
          preauth_number?: string | null
          preauth_requested_at?: string | null
          preauth_status?: string | null
          preauth_submitted_at?: string | null
          rejected_amount?: number | null
          rejection_reason?: string | null
          resolved_at?: string | null
          sha_member_missing?: boolean | null
          sha_member_no_at_claim?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          approved_amount?: number | null
          claim_number?: string | null
          claim_subtype?: string | null
          claim_type?: string | null
          consent_token?: string | null
          cr_number_at_claim?: string | null
          cr_number_missing?: boolean | null
          created_at?: string | null
          dha_claim_id?: string | null
          encounter_id?: string | null
          fhir_built_at?: string | null
          fhir_bundle?: Json | null
          fund_type?: string | null
          id?: string
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          patient_id?: string | null
          preauth_approved_at?: string | null
          preauth_id?: string | null
          preauth_notes?: string | null
          preauth_number?: string | null
          preauth_requested_at?: string | null
          preauth_status?: string | null
          preauth_submitted_at?: string | null
          rejected_amount?: number | null
          rejection_reason?: string | null
          resolved_at?: string | null
          sha_member_missing?: boolean | null
          sha_member_no_at_claim?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_claims_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "sha_claims_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claims_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_tariffs: {
        Row: {
          created_at: string | null
          effective_date_end: string | null
          effective_date_start: string | null
          fund_type: string | null
          id: string
          service_code: string | null
          service_description: string | null
          tariff_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date_end?: string | null
          effective_date_start?: string | null
          fund_type?: string | null
          id?: string
          service_code?: string | null
          service_description?: string | null
          tariff_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date_end?: string | null
          effective_date_start?: string | null
          fund_type?: string | null
          id?: string
          service_code?: string | null
          service_description?: string | null
          tariff_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shr_transmission_log: {
        Row: {
          created_at: string | null
          encounter_id: string | null
          error_message: string | null
          id: string
          patient_id: string | null
          payload_summary: string | null
          queue_id: string | null
          response_code: string | null
          status: string | null
          transmission_type: string | null
          transmitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encounter_id?: string | null
          error_message?: string | null
          id?: string
          patient_id?: string | null
          payload_summary?: string | null
          queue_id?: string | null
          response_code?: string | null
          status?: string | null
          transmission_type?: string | null
          transmitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encounter_id?: string | null
          error_message?: string | null
          id?: string
          patient_id?: string | null
          payload_summary?: string | null
          queue_id?: string | null
          response_code?: string | null
          status?: string | null
          transmission_type?: string | null
          transmitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          buy_price: number | null
          cash_price: number | null
          category: string | null
          created_at: string
          current_quantity: number
          id: string
          insurance_price: number | null
          kind: string
          name: string
          nlmis_code: string | null
          notes: string | null
          reorder_level: number
          strength: string | null
          strength_unit: string | null
          unit: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          buy_price?: number | null
          cash_price?: number | null
          category?: string | null
          created_at?: string
          current_quantity?: number
          id?: string
          insurance_price?: number | null
          kind?: string
          name: string
          nlmis_code?: string | null
          notes?: string | null
          reorder_level?: number
          strength?: string | null
          strength_unit?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          buy_price?: number | null
          cash_price?: number | null
          category?: string | null
          created_at?: string
          current_quantity?: number
          id?: string
          insurance_price?: number | null
          kind?: string
          name?: string
          nlmis_code?: string | null
          notes?: string | null
          reorder_level?: number
          strength?: string | null
          strength_unit?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_location_access: {
        Row: {
          can_approve: boolean | null
          can_issue: boolean | null
          can_receive: boolean | null
          can_request: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          location_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          can_approve?: boolean | null
          can_issue?: boolean | null
          can_receive?: boolean | null
          can_request?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          can_approve?: boolean | null
          can_issue?: boolean | null
          can_receive?: boolean | null
          can_request?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_location_access_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_location_balances: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          location_id: string | null
          quantity: number | null
          stock_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          quantity?: number | null
          stock_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          quantity?: number | null
          stock_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_location_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_location_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_main_store: boolean | null
          location_type: string | null
          name: string
          room_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_main_store?: boolean | null
          location_type?: string | null
          name: string
          room_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_main_store?: boolean | null
          location_type?: string | null
          name?: string
          room_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          change: number
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          reason: string
        }
        Insert: {
          change: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          reason: string
        }
        Update: {
          change?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          quantity: number
          stock_item_id: string | null
          transfer_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          quantity: number
          stock_item_id?: string | null
          transfer_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          quantity?: number
          stock_item_id?: string | null
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          from_location_id: string | null
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          requested_at: string | null
          requested_by: string | null
          status: string | null
          to_location_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          to_location_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          to_location_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_usage: {
        Row: {
          created_at: string | null
          encounter_id: string | null
          id: string
          item_id: string | null
          location_id: string | null
          notes: string | null
          quantity: number | null
          reason: string | null
          updated_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          notes?: string | null
          quantity?: number | null
          reason?: string | null
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          item_id?: string | null
          location_id?: string | null
          notes?: string | null
          quantity?: number | null
          reason?: string | null
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      test_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          parameters: Json
          test_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          parameters?: Json
          test_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          parameters?: Json
          test_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_room_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_room_access_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ward_transfers: {
        Row: {
          admission_id: string
          created_at: string
          encounter_id: string | null
          from_bed_id: string | null
          from_ward_id: string | null
          id: string
          to_bed_id: string
          to_ward_id: string
          transfer_notes: string | null
          transfer_reason: string | null
          transferred_at: string
          transferred_by: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          encounter_id?: string | null
          from_bed_id?: string | null
          from_ward_id?: string | null
          id?: string
          to_bed_id: string
          to_ward_id: string
          transfer_notes?: string | null
          transfer_reason?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          encounter_id?: string | null
          from_bed_id?: string | null
          from_ward_id?: string | null
          id?: string
          to_bed_id?: string
          to_ward_id?: string
          transfer_notes?: string | null
          transfer_reason?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ward_transfers_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "ward_transfers_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_from_bed_id_fkey"
            columns: ["from_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_from_ward_id_fkey"
            columns: ["from_ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_to_bed_id_fkey"
            columns: ["to_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ward_transfers_to_ward_id_fkey"
            columns: ["to_ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          capacity: number | null
          created_at: string | null
          daily_rate: number | null
          floor: string | null
          gender_restriction: string | null
          id: string
          is_active: boolean | null
          name: string
          section: string | null
          ward_type: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          daily_rate?: number | null
          floor?: string | null
          gender_restriction?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          section?: string | null
          ward_type?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          daily_rate?: number | null
          floor?: string | null
          gender_restriction?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          section?: string | null
          ward_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      appointments_view: {
        Row: {
          appointment_number: string | null
          cancellation_reason: string | null
          checked_in_at: string | null
          clinician_name: string | null
          encounter_id: string | null
          file_number: string | null
          id: string | null
          max_patients: number | null
          notes: string | null
          patient_id: string | null
          patient_name: string | null
          phone: string | null
          reason: string | null
          room_id: string | null
          room_kind: string | null
          room_name: string | null
          scheduled_at: string | null
          session: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_patient_census: {
        Row: {
          cash_count: number | null
          corporate_count: number | null
          emergency_count: number | null
          free_count: number | null
          insurance_count: number | null
          patient_count: number | null
          private_insurance_count: number | null
          room_kind: string | null
          room_name: string | null
          sha_phf_count: number | null
          sha_shif_count: number | null
          sha_total_count: number | null
          visit_date: string | null
        }
        Relationships: []
      }
      encounter_records_summary: {
        Row: {
          balance: number | null
          discharge_note_count: number | null
          doctor_note_count: number | null
          encounter_date: string | null
          encounter_id: string | null
          encounter_status: string | null
          invoice_id: string | null
          invoice_status: string | null
          lab_test_count: number | null
          patient_id: string | null
          patient_name: string | null
          prescription_count: number | null
          radiology_order_count: number | null
          total_due: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_registrations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          address_line1: string | null
          address_line2: string | null
          amount_paid: number | null
          cause_of_death: string | null
          city: string | null
          claim_number: string | null
          claim_resolved_at: string | null
          claim_status: string | null
          claim_submitted_at: string | null
          country: string | null
          county: string | null
          created_at: string | null
          created_by: string | null
          current_room_id: string | null
          date_of_birth: string | null
          date_of_death: string | null
          diagnoses: Json | null
          dob_known: boolean | null
          education_level: string | null
          email: string | null
          estimated_age: number | null
          family_name: string | null
          file_number: string | null
          first_name: string | null
          from_room: string | null
          history: Json | null
          id: string | null
          identity_verified: boolean | null
          identity_verified_at: string | null
          insurance_clearance_status: string | null
          insurance_coverage_percentage: number | null
          insurance_covered: number | null
          insurance_policy_number: string | null
          insurance_provider_id: string | null
          insurer_type: string | null
          is_deceased: boolean | null
          is_emergency: boolean | null
          marital_status: string | null
          middle_name: string | null
          national_id: string | null
          national_id_type: string | null
          nationality: string | null
          next_of_kin: Json | null
          next_room_id: string | null
          notes: string | null
          occupation: string | null
          paid_at: string | null
          paid_by: string | null
          patient_due: number | null
          patient_id: string | null
          patient_name: string | null
          payment_method: string | null
          payment_mode: string | null
          payment_reference: string | null
          payment_status: string | null
          phone: string | null
          postal_code: string | null
          preauth_number: string | null
          referral_direction: string | null
          referral_out_facility: string | null
          referral_out_reason: string | null
          relationships: Json | null
          religion: string | null
          sex: string | null
          sha_benefit_package_id: string | null
          sha_fund_type: string | null
          sha_member_number: string | null
          sha_membership_status: string | null
          sha_membership_verified_at: string | null
          sha_notification_number: string | null
          sha_relationship_to_principal: string | null
          status: string | null
          subtotal: number | null
          tests: Json | null
          updated_at: string | null
          vitals: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_current_room_id_fkey"
            columns: ["current_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_insurance_provider_id_fkey"
            columns: ["insurance_provider_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_next_room_id_fkey"
            columns: ["next_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_sha_benefit_package_id_fkey"
            columns: ["sha_benefit_package_id"]
            isOneToOne: false
            referencedRelation: "sha_benefit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_store_balances_view: {
        Row: {
          category: string | null
          id: string | null
          is_main_store: boolean | null
          item_id: string | null
          item_name: string | null
          kind: string | null
          location_id: string | null
          location_name: string | null
          location_type: string | null
          nlmis_code: string | null
          quantity: number | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_location_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_location_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_store_usage_view: {
        Row: {
          category: string | null
          created_at: string | null
          encounter_id: string | null
          id: string | null
          item_id: string | null
          item_name: string | null
          kind: string | null
          location_id: string | null
          location_name: string | null
          notes: string | null
          quantity: number | null
          reason: string | null
          unit: string | null
          used_at: string | null
          used_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter_records_summary"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "patient_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_usage_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accrue_daily_bed_charges: { Args: never; Returns: undefined }
      accrue_daily_mortuary_charges: { Args: never; Returns: undefined }
      archive_old_audit_logs: { Args: never; Returns: undefined }
      build_fhir_claim: { Args: { p_claim_id: string }; Returns: Json }
      can_access_room: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      create_encounter_from_appointment: {
        Args: { p_appointment_id: string }
        Returns: string
      }
      create_external_mortuary_invoice: {
        Args: { p_created_by?: string; p_record_id: string }
        Returns: string
      }
      dashboard_admitted_opd_trend: {
        Args: { p_end: string; p_start: string }
        Returns: {
          admitted_count: number
          day: string
          opd_count: number
        }[]
      }
      dashboard_emergency_referrals: {
        Args: { p_end: string; p_start: string }
        Returns: {
          emergency_count: number
          referrals_in: number
          referrals_out: number
        }[]
      }
      dashboard_opd_attendance: {
        Args: { p_end: string; p_start: string }
        Returns: {
          age_band: string
          attendance_count: number
        }[]
      }
      dashboard_top_diseases: {
        Args: { p_end: string; p_start: string }
        Returns: {
          age_band: string
          disease_count: number
          icd11_title: string
        }[]
      }
      generate_fhir_encounter: {
        Args: { p_encounter_id: string }
        Returns: Json
      }
      get_contracted_price: {
        Args: {
          p_insurance_provider_id: string
          p_item_id: string
          p_item_type: string
        }
        Returns: number
      }
      get_moh_705_report: {
        Args: { p_end_date: string; p_form_type?: string; p_start_date: string }
        Returns: {
          disease_name: string
          female_cases: number
          icd11_code: string
          male_cases: number
          row_number: number
          total_cases: number
        }[]
      }
      get_return_room: { Args: { p_encounter_id: string }; Returns: string }
      get_user_display_name: { Args: { p_user_id: string }; Returns: string }
      grant_stock_location_access: {
        Args: {
          allow_approve?: boolean
          allow_issue?: boolean
          allow_receive?: boolean
          allow_request?: boolean
          allow_view?: boolean
          target_location_id: string
          target_user_id: string
        }
        Returns: undefined
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { allowed_roles: string[] }; Returns: boolean }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      log_break_glass_access: {
        Args: {
          p_accessed_by: string
          p_accessor_email: string
          p_justification: string
          p_patient_id: string
        }
        Returns: undefined
      }
      receive_stock_to_location: {
        Args: {
          note?: string
          received_quantity: number
          target_item_id: string
          target_location_id: string
        }
        Returns: undefined
      }
      receive_stock_to_location_system: {
        Args: {
          actor?: string
          note?: string
          received_quantity: number
          target_item_id: string
          target_location_id: string
        }
        Returns: undefined
      }
      record_stock_usage: {
        Args: {
          note?: string
          source_location_id: string
          target_encounter_id?: string
          target_item_id: string
          usage_reason?: string
          used_quantity: number
        }
        Returns: undefined
      }
      refresh_moh_642_monthly_aggregates: {
        Args: { target_month: string }
        Returns: undefined
      }
      refresh_moh_707_monthly_aggregates: {
        Args: { target_month: string }
        Returns: undefined
      }
      refresh_moh_aggregates: {
        Args: { target_month: string }
        Returns: undefined
      }
      refresh_moh_monthly_aggregates: {
        Args: { target_month: string }
        Returns: undefined
      }
      refresh_moh_weekly_aggregates: {
        Args: { target_week_start: string }
        Returns: undefined
      }
      send_lab_result_to_room: {
        Args: { p_encounter_id: string; p_room_id: string }
        Returns: string
      }
      send_lab_results_to_requesting_room: {
        Args: { p_encounter_id: string }
        Returns: string
      }
      send_radiology_result_to_room: {
        Args: { p_encounter_id: string; p_room_id: string }
        Returns: string
      }
      send_radiology_results_to_requesting_room: {
        Args: { p_encounter_id: string }
        Returns: string
      }
      transfer_stock_between_locations: {
        Args: {
          destination_location_id: string
          note?: string
          source_location_id: string
          target_item_id: string
          transfer_quantity: number
        }
        Returns: undefined
      }
      user_can_access_stock_location: {
        Args: { _location_id: string; _permission?: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _perm: string; _user: string }
        Returns: boolean
      }
      validate_and_get_icd11: {
        Args: { search_code: string }
        Returns: {
          p_code: string
          p_is_cached: boolean
          p_title: string
          p_uri: string
        }[]
      }
      verify_patient_identity: {
        Args: {
          p_id_type: string
          p_national_id: string
          p_patient_id: string
          p_verified_by: string
        }
        Returns: Json
      }
      verify_practitioner: {
        Args: {
          p_council_type: string
          p_profile_id: string
          p_registration_number: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "accountant"
        | "lab_tech"
        | "records_officer"
        | "doctor"
        | "clinical_officer"
        | "nurse"
        | "radiologist"
        | "pharmacist"
        | "mortician"
        | "receptionist"
        | "triage_nurse"
        | "nutritionist"
        | "physiotherapist"
        | "dental_officer"
        | "hts_counsellor"
        | "insurance_agent"
        | "system_admin"
        | "store_keeper"
        | "director"
      machine_log_type: "maintenance" | "service" | "calibration"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "staff",
        "accountant",
        "lab_tech",
        "records_officer",
        "doctor",
        "clinical_officer",
        "nurse",
        "radiologist",
        "pharmacist",
        "mortician",
        "receptionist",
        "triage_nurse",
        "nutritionist",
        "physiotherapist",
        "dental_officer",
        "hts_counsellor",
        "insurance_agent",
        "system_admin",
        "store_keeper",
        "director",
      ],
      machine_log_type: ["maintenance", "service", "calibration"],
    },
  },
} as const
