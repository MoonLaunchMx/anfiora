export interface AdminEvent {
  id: string
  name: string
  created_at: string
  guest_count: number
  party_count: number
  total_count: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  event_count: number
  guest_count: number
  party_count: number
  total_count: number
  last_sign_in: string | null
  events: AdminEvent[]
  banned: boolean
}

export interface GlobalStats {
  total_users: number
  free_users: number
  pro_users: number
  agency_users: number
  total_events: number
  total_guests: number
  confirmed: number
  pending: number
  declined: number
  new_users_7d: number
  new_events_7d: number
}

export interface AuditEntry {
  id: string
  event_id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface EventOption {
  id: string
  name: string
}
