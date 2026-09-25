export interface HealthResponse {
  service: string;
  status: 'ok';
  mode: string;
  appName: string | null;
  baseUrl: string | null;
}
