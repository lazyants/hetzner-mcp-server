import { HetznerAction } from './common.js';

export interface LbHealthCheck {
  protocol: string;
  port: number;
  interval: number;
  timeout: number;
  retries: number;
  http?: {
    domain?: string;
    path?: string;
    response?: string;
    status_codes?: number[];
    tls?: boolean;
  };
}

export interface LbService {
  protocol: string;
  listen_port: number;
  destination_port: number;
  proxyprotocol: boolean;
  health_check: LbHealthCheck;
  http?: {
    certificates?: number[];
    cookie_lifetime?: number;
    cookie_name?: string;
    redirect_http?: boolean;
    sticky_sessions?: boolean;
    timeout_idle?: number;
  };
}

export interface LbTarget {
  type: string;
  server?: { id: number };
  label_selector?: { selector: string };
  ip?: { ip: string };
  use_private_ip?: boolean;
  health_status?: { listen_port: number; status: string }[];
}

export interface LoadBalancer {
  id: number;
  name: string;
  public_net: { enabled: boolean; ipv4: { ip: string }; ipv6: { ip: string } };
  private_net: { network: number; ip: string }[];
  location: { id: number; name: string; city: string; country: string };
  load_balancer_type: { id: number; name: string; description: string };
  protection: { delete: boolean };
  labels: Record<string, string>;
  targets: LbTarget[];
  services: LbService[];
  algorithm: { type: string };
  outgoing_traffic: number | null;
  ingoing_traffic: number | null;
  included_traffic: number;
  created: string;
}

export interface LoadBalancerListResponse {
  load_balancers: LoadBalancer[];
  meta: { pagination: { page: number; per_page: number; previous_page: number | null; next_page: number | null; last_page: number; total_entries: number } };
}

export interface LoadBalancerResponse {
  load_balancer: LoadBalancer;
}

export interface LoadBalancerCreateResponse {
  load_balancer: LoadBalancer;
  action: HetznerAction;
}

export interface LoadBalancerActionResponse {
  action: HetznerAction;
}

export interface LoadBalancerMetricsResponse {
  metrics: {
    start: string;
    end: string;
    step: number;
    time_series: Record<string, { values: [number, string][] }>;
  };
}

export interface LoadBalancerType {
  id: number;
  name: string;
  description: string;
  max_connections: number;
  max_services: number;
  max_targets: number;
  max_assigned_certificates: number;
  prices: { location: string; price_monthly: { net: string; gross: string }; price_hourly: { net: string; gross: string } }[];
}

export interface LoadBalancerTypeListResponse {
  load_balancer_types: LoadBalancerType[];
}
