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
    PostgrestVersion: "14.5"
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
          discharged_at: string | null
          encounter_id: string | null
          expected_discharge_date: string | null
          id: string
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
          discharged_at?: string | null
          encounter_id?: string | null
          expected_discharge_date?: string | null
          id?: string
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
          discharged_at?: string | null
          encounter_id?: string | null
          expected_discharge_date?: string | null
          id?: string
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
          id: string
          logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_name?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_name?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type: string | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          encounter_id: string | null
          id: string
          notes: string | null
          patient_id: string | null
          provider_id: string | null
          reason: string | null
          scheduled_at: string
          status: string | null
          time_range: unknown
          updated_at: string | null
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          provider_id?: string | null
          reason?: string | null
          scheduled_at: string
          status?: string | null
          time_range?: unknown
          updated_at?: string | null
        }
        Update: {
          appointment_type?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          provider_id?: string | null
          reason?: string | null
          scheduled_at?: string
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
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      beds: {
        Row: {
          bed_number: string
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          ward_id: string | null
        }
        Insert: {
          bed_number: string
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          ward_id?: string | null
        }
        Update: {
          bed_number?: string
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
          note_type: string
        }
        Insert: {
          admission_id?: string | null
          authored_at?: string | null
          authored_by?: string | null
          content?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          note_type: string
        }
        Update: {
          admission_id?: string | null
          authored_at?: string | null
          authored_by?: string | null
          content?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          note_type?: string
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
      encounter_amendments: {
        Row: {
          amendment_text: string
          created_at: string | null
          created_by: string | null
          encounter_id: string
          id: string
          reason_for_amendment: string | null
          updated_at: string | null
        }
        Insert: {
          amendment_text: string
          created_at?: string | null
          created_by?: string | null
          encounter_id: string
          id?: string
          reason_for_amendment?: string | null
          updated_at?: string | null
        }
        Update: {
          amendment_text?: string
          created_at?: string | null
          created_by?: string | null
          encounter_id?: string
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
          encounter_id: string
          icd11_code: string
          icd11_title: string
          icd11_uri: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          diagnosis_type?: string | null
          encounter_id: string
          icd11_code: string
          icd11_title: string
          icd11_uri?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          diagnosis_type?: string | null
          encounter_id?: string
          icd11_code?: string
          icd11_title?: string
          icd11_uri?: string | null
          id?: string
          notes?: string | null
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
          encounter_id: string
          id: string
          indicator_code: string
          tagged_at: string | null
          tagged_by: string | null
        }
        Insert: {
          encounter_id: string
          id?: string
          indicator_code: string
          tagged_at?: string | null
          tagged_by?: string | null
        }
        Update: {
          encounter_id?: string
          id?: string
          indicator_code?: string
          tagged_at?: string | null
          tagged_by?: string | null
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
          encounter_id: string
          entered_at: string
          id: string
          left_at: string | null
          room_id: string | null
        }
        Insert: {
          encounter_id: string
          entered_at?: string
          id?: string
          left_at?: string | null
          room_id?: string | null
        }
        Update: {
          encounter_id?: string
          entered_at?: string
          id?: string
          left_at?: string | null
          room_id?: string | null
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
          created_at: string | null
          created_by: string | null
          current_room_id: string | null
          diagnoses: Json | null
          encounter_type: string | null
          from_room: string | null
          history: Json | null
          id: string
          insurance_coverage_percentage: number | null
          insurance_covered: number | null
          insurance_provider_id: string | null
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
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          diagnoses?: Json | null
          encounter_type?: string | null
          from_room?: string | null
          history?: Json | null
          id: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_provider_id?: string | null
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
          created_at?: string | null
          created_by?: string | null
          current_room_id?: string | null
          diagnoses?: Json | null
          encounter_type?: string | null
          from_room?: string | null
          history?: Json | null
          id?: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number | null
          insurance_provider_id?: string | null
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
        ]
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
          code: string
          title: string
          uri: string | null
          validated_at: string | null
        }
        Insert: {
          code: string
          title: string
          uri?: string | null
          validated_at?: string | null
        }
        Update: {
          code?: string
          title?: string
          uri?: string | null
          validated_at?: string | null
        }
        Relationships: []
      }
      insurance_providers: {
        Row: {
          code: string
          coverage_percentage: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          coverage_percentage?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          coverage_percentage?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
          item_type: string
          quantity: number | null
          source_id: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          insurance_covered_amount?: number | null
          invoice_id?: string | null
          item_type: string
          quantity?: number | null
          source_id?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          encounter_id?: string | null
          id?: string
          insurance_covered_amount?: number | null
          invoice_id?: string | null
          item_type?: string
          quantity?: number | null
          source_id?: string | null
          unit_price?: number | null
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
          amount: number
          created_at: string | null
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string | null
          received_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          received_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          received_by?: string | null
          reference?: string | null
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
          name: string
          price: number
          target_room_id: string | null
          updated_at: string
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
          name: string
          price?: number
          target_room_id?: string | null
          updated_at?: string
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
          name?: string
          price?: number
          target_room_id?: string | null
          updated_at?: string
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
      moh_indicator_definitions: {
        Row: {
          criteria_type: string | null
          criteria_value: string | null
          description: string | null
          form_number: string
          id: string
          indicator_code: string
        }
        Insert: {
          criteria_type?: string | null
          criteria_value?: string | null
          description?: string | null
          form_number: string
          id?: string
          indicator_code: string
        }
        Update: {
          criteria_type?: string | null
          criteria_value?: string | null
          description?: string | null
          form_number?: string
          id?: string
          indicator_code?: string
        }
        Relationships: []
      }
      moh_indicators: {
        Row: {
          category: string
          code: string
          created_at: string | null
          data_type: string
          description: string
          id: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          data_type?: string
          description: string
          id?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          data_type?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      moh_monthly_aggregates: {
        Row: {
          computed_at: string | null
          id: string
          indicator_code: string
          period_month: string
          value: number
        }
        Insert: {
          computed_at?: string | null
          id?: string
          indicator_code: string
          period_month: string
          value?: number
        }
        Update: {
          computed_at?: string | null
          id?: string
          indicator_code?: string
          period_month?: string
          value?: number
        }
        Relationships: []
      }
      moh_report_corrections: {
        Row: {
          adjusted_value: number
          created_at: string | null
          created_by: string | null
          id: string
          indicator_code: string
          period_month: string
          reason: string
        }
        Insert: {
          adjusted_value: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          indicator_code: string
          period_month: string
          reason: string
        }
        Update: {
          adjusted_value?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          indicator_code?: string
          period_month?: string
          reason?: string
        }
        Relationships: []
      }
      moh_report_line_items: {
        Row: {
          column_label: string | null
          id: string
          indicator_code: string | null
          row_label: string
          section: string | null
          sort_order: number
          template_id: string | null
        }
        Insert: {
          column_label?: string | null
          id?: string
          indicator_code?: string | null
          row_label: string
          section?: string | null
          sort_order?: number
          template_id?: string | null
        }
        Update: {
          column_label?: string | null
          id?: string
          indicator_code?: string | null
          row_label?: string
          section?: string | null
          sort_order?: number
          template_id?: string | null
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
          period_month: string
          prepared_at: string | null
          prepared_by: string | null
          received_by: string | null
          status: string
          template_id: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          export_url?: string | null
          id?: string
          period_month: string
          prepared_at?: string | null
          prepared_by?: string | null
          received_by?: string | null
          status?: string
          template_id: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          export_url?: string | null
          id?: string
          period_month?: string
          prepared_at?: string | null
          prepared_by?: string | null
          received_by?: string | null
          status?: string
          template_id?: string
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
          form_code: string
          id: string
          title: string
          version: string
        }
        Insert: {
          form_code: string
          id?: string
          title: string
          version: string
        }
        Update: {
          form_code?: string
          id?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      patient_registrations_legacy: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          address_line1: string | null
          address_line2: string | null
          amount_paid: number
          cause_of_death: string | null
          city: string | null
          country: string | null
          county: string | null
          created_at: string
          created_by: string | null
          current_room_id: string | null
          date_of_birth: string | null
          date_of_death: string | null
          diagnoses: Json
          dob_known: boolean | null
          education_level: string | null
          email: string | null
          estimated_age: number | null
          family_name: string | null
          file_number: string | null
          first_name: string | null
          from_room: string | null
          history: Json
          id: string
          insurance_coverage_percentage: number | null
          insurance_covered: number
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
          patient_due: number
          patient_name: string
          payment_method: string | null
          payment_mode: string
          payment_reference: string | null
          payment_status: string
          phone: string | null
          postal_code: string | null
          relationships: Json | null
          religion: string | null
          sex: string | null
          status: string
          subtotal: number
          tests: Json
          updated_at: string
          vitals: Json
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          address_line1?: string | null
          address_line2?: string | null
          amount_paid?: number
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          diagnoses?: Json
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          from_room?: string | null
          history?: Json
          id?: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number
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
          patient_due?: number
          patient_name: string
          payment_method?: string | null
          payment_mode: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          status?: string
          subtotal?: number
          tests?: Json
          updated_at?: string
          vitals?: Json
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          address_line1?: string | null
          address_line2?: string | null
          amount_paid?: number
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          current_room_id?: string | null
          date_of_birth?: string | null
          date_of_death?: string | null
          diagnoses?: Json
          dob_known?: boolean | null
          education_level?: string | null
          email?: string | null
          estimated_age?: number | null
          family_name?: string | null
          file_number?: string | null
          first_name?: string | null
          from_room?: string | null
          history?: Json
          id?: string
          insurance_coverage_percentage?: number | null
          insurance_covered?: number
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
          patient_due?: number
          patient_name?: string
          payment_method?: string | null
          payment_mode?: string
          payment_reference?: string | null
          payment_status?: string
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          status?: string
          subtotal?: number
          tests?: Json
          updated_at?: string
          vitals?: Json
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
          cause_of_death: string | null
          city: string | null
          country: string | null
          county: string | null
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
          is_deceased: boolean | null
          marital_status: string | null
          middle_name: string | null
          nationality: string | null
          next_of_kin: Json | null
          occupation: string | null
          patient_name: string | null
          phone: string | null
          postal_code: string | null
          relationships: Json | null
          religion: string | null
          sex: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
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
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          occupation?: string | null
          patient_name?: string | null
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          cause_of_death?: string | null
          city?: string | null
          country?: string | null
          county?: string | null
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
          is_deceased?: boolean | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: Json | null
          occupation?: string | null
          patient_name?: string | null
          phone?: string | null
          postal_code?: string | null
          relationships?: Json | null
          religion?: string | null
          sex?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          dosage: string | null
          drug_name: string
          duration: string | null
          frequency: string | null
          id: string
          notes: string | null
          quantity: number
          registration_id: string
          status: string
          stock_item_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_name: string
          duration?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          registration_id: string
          status?: string
          stock_item_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_name?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          registration_id?: string
          status?: string
          stock_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_orders: {
        Row: {
          catalog_id: string | null
          clinical_indication: string | null
          created_at: string | null
          encounter_id: string | null
          id: string
          ordered_at: string | null
          ordered_by: string | null
          patient_id: string | null
          priority: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          catalog_id?: string | null
          clinical_indication?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          ordered_at?: string | null
          ordered_by?: string | null
          patient_id?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          catalog_id?: string | null
          clinical_indication?: string | null
          created_at?: string | null
          encounter_id?: string | null
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
          indicator_code: string
          room_id: string
        }
        Insert: {
          indicator_code: string
          room_id: string
        }
        Update: {
          indicator_code?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_indicator_map_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
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
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          cash_price: number | null
          category: string | null
          created_at: string
          current_quantity: number
          id: string
          insurance_price: number | null
          kind: string
          name: string
          notes: string | null
          reorder_level: number
          unit: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          cash_price?: number | null
          category?: string | null
          created_at?: string
          current_quantity?: number
          id?: string
          insurance_price?: number | null
          kind?: string
          name: string
          notes?: string | null
          reorder_level?: number
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          cash_price?: number | null
          category?: string | null
          created_at?: string
          current_quantity?: number
          id?: string
          insurance_price?: number | null
          kind?: string
          name?: string
          notes?: string | null
          reorder_level?: number
          unit?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
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
          patient_id: string | null
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
        ]
      }
    }
    Functions: {
      accrue_daily_bed_charges: { Args: never; Returns: undefined }
      can_access_room: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      dashboard_admitted_opd_trend: {
        Args: { p_start: string; p_end: string }
        Returns: { day: string; admitted_count: number; opd_count: number }[]
      }
      dashboard_emergency_referrals: {
        Args: { p_start: string; p_end: string }
        Returns: { emergency_count: number; referrals_in: number; referrals_out: number }[]
      }
      dashboard_opd_attendance: {
        Args: { p_start: string; p_end: string }
        Returns: { age_band: string; attendance_count: number }[]
      }
      dashboard_top_diseases: {
        Args: { p_start: string; p_end: string }
        Returns: { age_band: string; icd11_title: string; disease_count: number }[]
      }
      get_return_room: { Args: { p_encounter_id: string }; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { allowed_roles: string[] }; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      refresh_moh_aggregates: {
        Args: { target_month: string }
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
      ],
      machine_log_type: ["maintenance", "service", "calibration"],
    },
  },
} as const
