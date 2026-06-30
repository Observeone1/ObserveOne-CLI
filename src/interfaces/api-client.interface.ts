import {
  UrlMonitor,
  ApiCheck,
  Heartbeat,
  ResourceRun,
  HeartbeatPing,
  ListQueryOptions,
  PaginatedListResult,
  AlertChannel,
  StatusPage,
  Incident,
  ApiKey,
  Team,
  TeamMember,
  IncidentEvent,
  Suite,
  SuiteCiIntegration,
} from '../types/index.js';

/**
 * API Client interface
 * Abstracts HTTP communication with ObserveOne backend
 */
export interface IApiClient {
  setApiKey(apiKey: string): void;
  validateApiKey(apiKey: string): Promise<boolean>;
  validateToken(): Promise<boolean>;
  provisionHeadlessAuth(email?: string, password?: string): Promise<{ api_key: string }>;
  post(url: string, data?: unknown): Promise<unknown>;
  get(url: string): Promise<unknown>;

  // URL Monitors
  getUrlMonitors(): Promise<UrlMonitor[]>;
  listUrlMonitors(query?: ListQueryOptions): Promise<PaginatedListResult<UrlMonitor>>;
  getUrlMonitor(id: string): Promise<UrlMonitor>;
  createUrlMonitor(data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  updateUrlMonitor(id: string, data: Partial<UrlMonitor>): Promise<UrlMonitor>;
  deleteUrlMonitor(id: string): Promise<void>;
  toggleUrlMonitor(id: string): Promise<boolean>;
  toggleMuteUrlMonitor(id: string): Promise<{ alert_on_failure: boolean; message: string }>;
  getUrlMonitorRuns(id: string, limit?: number): Promise<ResourceRun[]>;

  // API Checks
  getApiChecks(): Promise<ApiCheck[]>;
  listApiChecks(query?: ListQueryOptions): Promise<PaginatedListResult<ApiCheck>>;
  getApiCheck(id: string): Promise<ApiCheck>;
  createApiCheck(data: Partial<ApiCheck>): Promise<ApiCheck>;
  updateApiCheck(id: string, data: Partial<ApiCheck>): Promise<ApiCheck>;
  deleteApiCheck(id: string): Promise<void>;
  toggleApiCheck(id: string): Promise<boolean>;
  toggleMuteApiCheck(id: string): Promise<{ alert_on_failure: boolean; message: string }>;
  getApiCheckRuns(id: string, limit?: number): Promise<ResourceRun[]>;

  // Heartbeats
  getHeartbeats(): Promise<Heartbeat[]>;
  listHeartbeats(query?: ListQueryOptions): Promise<PaginatedListResult<Heartbeat>>;
  getHeartbeat(id: string): Promise<Heartbeat>;
  createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat>;
  updateHeartbeat(id: string, data: Partial<Heartbeat>): Promise<Heartbeat>;
  deleteHeartbeat(id: string): Promise<void>;
  toggleHeartbeat(id: string): Promise<boolean>;
  toggleMuteHeartbeat(id: string): Promise<{ alert_on_failure: boolean; message: string }>;
  resetHeartbeat(id: string): Promise<Heartbeat>;
  getHeartbeatRuns(id: string, limit?: number): Promise<HeartbeatPing[]>;

  // Alert Channels
  getAlertChannels(): Promise<AlertChannel[]>;
  getAlertChannel(id: string): Promise<AlertChannel>;
  createAlertChannel(data: Partial<AlertChannel>): Promise<AlertChannel>;
  updateAlertChannel(id: string, data: Partial<AlertChannel>): Promise<AlertChannel>;
  deleteAlertChannel(id: string): Promise<void>;

  // Status Pages
  getStatusPages(): Promise<StatusPage[]>;
  getStatusPage(id: string): Promise<StatusPage>;
  createStatusPage(data: Partial<StatusPage>): Promise<StatusPage>;
  updateStatusPage(id: string, data: Partial<StatusPage>): Promise<StatusPage>;
  deleteStatusPage(id: string): Promise<void>;
  addMonitorToStatusPage(
    spId: string,
    data: { monitor_type: string; monitor_id: string; display_name: string; display_order?: number }
  ): Promise<{ id: string; status_page_id: string; monitor_id: string; [key: string]: unknown }>;
  removeMonitorFromStatusPage(spId: string, monitorId: string): Promise<void>;

  // Incidents
  getIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident>;
  createIncident(data: Partial<Incident>): Promise<Incident>;
  updateIncident(id: string, data: Partial<Incident>): Promise<Incident>;
  deleteIncident(id: string): Promise<void>;
  addIncidentComment(id: string, message: string): Promise<IncidentEvent>;
  assignIncident(id: string, userId: string | null): Promise<Incident>;

  // API Keys
  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(name: string): Promise<ApiKey>;
  deleteApiKey(id: string): Promise<{ message: string; apiKey: ApiKey }>;
  toggleApiKey(id: string): Promise<{ message: string; apiKey: ApiKey }>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeamMembers(teamId: string): Promise<TeamMember[]>;
  regenerateTeamInvite(teamId: string): Promise<{ message: string; inviteCode: string }>;
  removeTeamMember(teamId: string, userId: string): Promise<unknown>;
  updateTeamMemberRole(teamId: string, userId: string, role: string): Promise<unknown>;

  // Suites
  listSuites(): Promise<Suite[]>;
  getSuite(suiteId: string): Promise<Suite>;
  getSuiteScripts(
    suiteId: string
  ): Promise<{ suite_id: string; tests: Array<{ id: string; name: string; code: string }> }>;
  updateSuite(
    suiteId: string,
    payload: { suite_name?: string; target_url?: string }
  ): Promise<Suite>;

  // Suite extras
  toggleSuitePublic(suiteId: string, isPublic: boolean): Promise<unknown>;
  healSuite(
    suiteId: string
  ): Promise<{ suite_id: string; heals: Array<{ testId: string; healId: string }> }>;

  // Suite CI integration (headless: status / token-rotation / disconnect only;
  // install + repo selection stays in the web UI)
  getSuiteCiIntegration(suiteId: string): Promise<SuiteCiIntegration | null>;
  generateSuiteCiWebhookToken(suiteId: string): Promise<{ token: string }>;
  deleteSuiteCiIntegration(suiteId: string): Promise<void>;

  healthCheck(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }>;
  requestCliAuth(): Promise<{ request_id: string; auth_url: string }>;
  checkCliAuthStatus(requestId: string): Promise<{
    status: 'pending' | 'approved' | 'denied';
    api_key?: string;
  }>;
}
