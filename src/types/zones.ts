import { HetznerAction } from './common.js';

// Zone record types supported by Hetzner DNS (see hcloud-go/zone_rrset.go).
export const ZONE_RRSET_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'HINFO', 'HTTPS', 'MX', 'NS', 'PTR', 'RP', 'SOA', 'SRV', 'SVCB', 'TLSA', 'TXT'] as const;
export type ZoneRRSetType = typeof ZONE_RRSET_TYPES[number];

export type ZoneMode = 'primary' | 'secondary';

export interface ZonePrimaryNameserver {
  address: string;
  port: number;
  tsig_algorithm: string;
  tsig_key: string;
}

export interface ZoneAuthoritativeNameservers {
  assigned: string[];
  delegated: string[];
  delegation_last_check: string;
  delegation_status: string;
}

export interface Zone {
  id: number;
  name: string;
  created: string;
  ttl: number;
  mode: ZoneMode;
  primary_nameservers: ZonePrimaryNameserver[];
  protection: { delete: boolean };
  labels: Record<string, string>;
  authoritative_nameservers: ZoneAuthoritativeNameservers;
  registrar: string;
  status: string;
  record_count: number;
}

export interface ZoneListResponse {
  zones: Zone[];
  meta: { pagination: { page: number; per_page: number; previous_page: number | null; next_page: number | null; last_page: number; total_entries: number } };
}

export interface ZoneResponse {
  zone: Zone;
}

export interface ZoneCreateResponse {
  zone: Zone;
  action: HetznerAction;
}

export interface ZoneActionResponse {
  action: HetznerAction;
}

export interface ZoneExportZonefileResponse {
  zonefile: string;
}

export interface ZoneRRSetRecord {
  value: string;
  comment?: string;
}

export interface ZoneRRSet {
  id: string;
  name: string;
  type: ZoneRRSetType;
  ttl: number | null;
  labels: Record<string, string>;
  protection: { change: boolean };
  records: ZoneRRSetRecord[];
  zone: number;
}

export interface ZoneRRSetListResponse {
  rrsets: ZoneRRSet[];
  meta: { pagination: { page: number; per_page: number; previous_page: number | null; next_page: number | null; last_page: number; total_entries: number } };
}

export interface ZoneRRSetResponse {
  rrset: ZoneRRSet;
}

export interface ZoneRRSetCreateResponse {
  rrset: ZoneRRSet;
  action: HetznerAction;
}
