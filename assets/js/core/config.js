/** Browser-only demo configuration. No real credentials or personal data. */
export const DEMO_MODE = true;
export const Config = Object.freeze({
  DEMO_MODE,
  schema_version: 1,
  storage_key: 'barangay-connect:data:v1',
  session_key: 'barangay-connect:session:v1',
  timezone: 'Asia/Manila',
  demo_time: '2026-10-04T14:20:00+08:00',
  roles: Object.freeze(['secretary', 'responder', 'rescuer', 'resident']),
});

export class ApiError extends Error {
  constructor(code, message, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
  }
}

// Store.now() owns the shared demo clock; Laravel later supplies server time.
export function zonedISO(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new ApiError('VALIDATION', 'Choose a valid date.');
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');
}
export const delay = () => new Promise(resolve => setTimeout(resolve, 150 + Math.floor(Math.random() * 201)));
export const copy = value => JSON.parse(JSON.stringify(value));
export default Config;
