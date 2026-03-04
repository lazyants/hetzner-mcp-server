import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { hetznerRequest } from '../services/hetzner.js';
import { handleToolRequest } from '../helpers.js';
import { IdSchema, PaginationParams, LabelSelectorParam, LabelsSchema, NameFilterParam } from '../schemas/common.js';

const HealthCheckHttpSchema = z.object({
  domain: z.string().optional().describe('Domain to send in HTTP Host header'),
  path: z.string().optional().describe('HTTP path to check'),
  response: z.string().optional().describe('Expected response body'),
  status_codes: z.array(z.number().int()).optional().describe('Expected HTTP status codes'),
  tls: z.boolean().optional().describe('Whether to use HTTPS'),
});

const HealthCheckSchema = z.object({
  protocol: z.string().describe('Health check protocol: tcp, http, or https'),
  port: z.number().int().describe('Port to check'),
  interval: z.number().int().describe('Interval between checks in seconds'),
  timeout: z.number().int().describe('Timeout for a single check in seconds'),
  retries: z.number().int().describe('Number of retries before marking unhealthy'),
  http: HealthCheckHttpSchema.optional().describe('HTTP-specific health check settings'),
});

const ServiceHttpSchema = z.object({
  certificates: z.array(z.number().int()).optional().describe('Certificate IDs'),
  cookie_lifetime: z.number().int().optional().describe('Lifetime of sticky session cookie in seconds'),
  cookie_name: z.string().optional().describe('Name of the sticky session cookie'),
  redirect_http: z.boolean().optional().describe('Redirect HTTP to HTTPS'),
  sticky_sessions: z.boolean().optional().describe('Enable sticky sessions'),
});

const LbTargetSchema = z.object({
  type: z.enum(['server', 'label_selector', 'ip']).describe('Target type'),
  server: z.object({ id: z.number().int().describe('Server ID') }).optional().describe('Server target'),
  label_selector: z.object({ selector: z.string().describe('Label selector') }).optional().describe('Label selector target'),
  ip: z.object({ ip: z.string().describe('IP address') }).optional().describe('IP target'),
  use_private_ip: z.boolean().optional().describe('Use private IP for the target'),
});

const ServiceSchema = z.object({
  protocol: z.string().describe('Service protocol: tcp, http, or https'),
  listen_port: z.number().int().describe('Port the load balancer listens on'),
  destination_port: z.number().int().describe('Port traffic is forwarded to'),
  proxyprotocol: z.boolean().optional().describe('Enable PROXY protocol'),
  health_check: HealthCheckSchema.optional().describe('Health check configuration'),
  http: ServiceHttpSchema.optional().describe('HTTP-specific service settings'),
});

export function registerLoadBalancerTools(server: McpServer): void {
  server.registerTool(
    'hetzner_list_load_balancers',
    {
      title: 'List Load Balancers',
      description: 'List all load balancers in the project, with optional filtering by name or labels.',
      inputSchema: z.object({
        ...NameFilterParam,
        ...LabelSelectorParam,
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/load_balancers', undefined, params))
  );

  server.registerTool(
    'hetzner_get_load_balancer',
    {
      title: 'Get Load Balancer',
      description: 'Get details of a specific load balancer by its ID.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', `/load_balancers/${params.id}`))
  );

  server.registerTool(
    'hetzner_create_load_balancer',
    {
      title: 'Create Load Balancer',
      description: 'Create a new load balancer with the specified type, location, and optional targets and services.',
      inputSchema: z.object({
        name: z.string().describe('Name of the load balancer'),
        load_balancer_type: z.string().describe('Load balancer type name or ID'),
        location: z.string().optional().describe('Location name (e.g. "fsn1"), mutually exclusive with network_zone'),
        network_zone: z.string().optional().describe('Network zone (e.g. "eu-central"), mutually exclusive with location'),
        algorithm: z.object({
          type: z.enum(['round_robin', 'least_connections']).describe('Algorithm type'),
        }).optional().describe('Load balancing algorithm'),
        targets: z.array(LbTargetSchema).optional().describe('Array of targets'),
        services: z.array(ServiceSchema).optional().describe('Array of services'),
        labels: LabelsSchema,
        network: z.number().int().optional().describe('Network ID to attach to'),
        public_interface: z.boolean().optional().describe('Enable the public interface'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('POST', '/load_balancers', params))
  );

  server.registerTool(
    'hetzner_update_load_balancer',
    {
      title: 'Update Load Balancer',
      description: 'Update a load balancer name or labels.',
      inputSchema: z.object({
        id: IdSchema,
        name: z.string().optional().describe('New name for the load balancer'),
        labels: LabelsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/load_balancers/${id}`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_load_balancer',
    {
      title: 'Delete Load Balancer',
      description: 'Permanently delete a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('DELETE', `/load_balancers/${params.id}`))
  );

  server.registerTool(
    'hetzner_add_lb_target',
    {
      title: 'Add Load Balancer Target',
      description: 'Add a target (server, label selector, or IP) to a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        type: z.enum(['server', 'label_selector', 'ip']).describe('Target type'),
        server: z.object({ id: z.number().int().describe('Server ID') }).optional().describe('Server target'),
        label_selector: z.object({ selector: z.string().describe('Label selector') }).optional().describe('Label selector target'),
        ip: z.object({ ip: z.string().describe('IP address') }).optional().describe('IP target'),
        use_private_ip: z.boolean().optional().describe('Use private IP for the target'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/add_target`, body);
    })
  );

  server.registerTool(
    'hetzner_remove_lb_target',
    {
      title: 'Remove Load Balancer Target',
      description: 'Remove a target from a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        type: z.enum(['server', 'label_selector', 'ip']).describe('Target type'),
        server: z.object({ id: z.number().int().describe('Server ID') }).optional().describe('Server target'),
        label_selector: z.object({ selector: z.string().describe('Label selector') }).optional().describe('Label selector target'),
        ip: z.object({ ip: z.string().describe('IP address') }).optional().describe('IP target'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/remove_target`, body);
    })
  );

  server.registerTool(
    'hetzner_add_lb_service',
    {
      title: 'Add Load Balancer Service',
      description: 'Add a service (port listener with forwarding rules) to a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        protocol: z.string().describe('Service protocol: tcp, http, or https'),
        listen_port: z.number().int().describe('Port the load balancer listens on'),
        destination_port: z.number().int().describe('Port traffic is forwarded to'),
        proxyprotocol: z.boolean().optional().describe('Enable PROXY protocol'),
        health_check: HealthCheckSchema.optional().describe('Health check configuration'),
        http: ServiceHttpSchema.optional().describe('HTTP-specific service settings'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/add_service`, body);
    })
  );

  server.registerTool(
    'hetzner_update_lb_service',
    {
      title: 'Update Load Balancer Service',
      description: 'Update an existing service on a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        protocol: z.string().describe('Service protocol: tcp, http, or https'),
        listen_port: z.number().int().describe('Port the load balancer listens on'),
        destination_port: z.number().int().describe('Port traffic is forwarded to'),
        proxyprotocol: z.boolean().optional().describe('Enable PROXY protocol'),
        health_check: HealthCheckSchema.optional().describe('Health check configuration'),
        http: ServiceHttpSchema.optional().describe('HTTP-specific service settings'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('PUT', `/load_balancers/${id}/actions/update_service`, body);
    })
  );

  server.registerTool(
    'hetzner_delete_lb_service',
    {
      title: 'Delete Load Balancer Service',
      description: 'Remove a service from a load balancer by its listen port.',
      inputSchema: z.object({
        id: IdSchema,
        listen_port: z.number().int().describe('Listen port of the service to delete'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/delete_service`, body);
    })
  );

  server.registerTool(
    'hetzner_change_lb_algorithm',
    {
      title: 'Change Load Balancer Algorithm',
      description: 'Change the balancing algorithm of a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        type: z.enum(['round_robin', 'least_connections']).describe('Algorithm type'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/change_algorithm`, body);
    })
  );

  server.registerTool(
    'hetzner_change_lb_type',
    {
      title: 'Change Load Balancer Type',
      description: 'Change the type (plan) of a load balancer.',
      inputSchema: z.object({
        id: IdSchema,
        load_balancer_type: z.string().describe('New load balancer type name or ID'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/change_type`, body);
    })
  );

  server.registerTool(
    'hetzner_attach_lb_to_network',
    {
      title: 'Attach Load Balancer to Network',
      description: 'Attach a load balancer to a network.',
      inputSchema: z.object({
        id: IdSchema,
        network: z.number().int().describe('Network ID to attach to'),
        ip: z.string().optional().describe('IP address to assign in the network'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/attach_to_network`, body);
    })
  );

  server.registerTool(
    'hetzner_detach_lb_from_network',
    {
      title: 'Detach Load Balancer from Network',
      description: 'Detach a load balancer from a network.',
      inputSchema: z.object({
        id: IdSchema,
        network: z.number().int().describe('Network ID to detach from'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...body } = params;
      return hetznerRequest('POST', `/load_balancers/${id}/actions/detach_from_network`, body);
    })
  );

  server.registerTool(
    'hetzner_get_lb_metrics',
    {
      title: 'Get Load Balancer Metrics',
      description: 'Get metrics for a load balancer over a specified time range.',
      inputSchema: z.object({
        id: IdSchema,
        type: z.string().describe('Metric type, e.g. "open_connections", "connections_per_second", "requests_per_second", "bandwidth.in", "bandwidth.out"'),
        start: z.string().describe('Start of the time range in ISO 8601 format'),
        end: z.string().describe('End of the time range in ISO 8601 format'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => {
      const { id, ...queryParams } = params;
      return hetznerRequest('GET', `/load_balancers/${id}/metrics`, undefined, queryParams);
    })
  );

  server.registerTool(
    'hetzner_list_lb_types',
    {
      title: 'List Load Balancer Types',
      description: 'List all available load balancer types with pricing and limits.',
      inputSchema: z.object({
        name: z.string().optional().describe('Filter by type name'),
        ...PaginationParams,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    handleToolRequest(async (params) => hetznerRequest('GET', '/load_balancer_types', undefined, params))
  );
}
