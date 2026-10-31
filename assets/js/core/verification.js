import { ApiError } from './config.js';

export const VERIFICATION_STATUSES = Object.freeze(['Pending', 'Resubmission requested', 'Approved', 'Rejected', 'Expired']);

// New clients send a revision and application ID; older demo callers remain compatible.
export function checkVerificationRevision(row, input) {
  for (const key of ['expected_revision', 'verification_id']) {
    if (input[key] === undefined) continue;
    if (!Number.isInteger(input[key]) || input[key] < (key === 'verification_id' ? 1 : 0)) throw new ApiError('VALIDATION', 'Check the verification revision.', { [key]: 'Use a valid whole number.' });
  }
  if ((input.verification_id !== undefined && input.verification_id !== row?.id) || (input.expected_revision !== undefined && input.expected_revision !== (row?.revision || 0))) throw new ApiError('CONFLICT', 'This verification has changed. Reload it before continuing.');
}

export function verificationEvent(row, action, user, at, reason = '') {
  return { action, at, actor_id: user?.id ?? null, actor_name: user?.full_name || null, actor_role: user?.role || null, document_type: row.document_type, file_name: row.file_name, submission_number: row.submission_number || 1, deadline_at: row.deadline_at, ...(reason ? { reason } : {}) };
}

export function preserveVerificationHistory(row, resident) {
  row.history ||= [];
  row.submission_number ||= row.file_name ? 1 : 0;
  // Preserve only evidence already present in legacy records, never fabricate a submission.
  if (!row.history.length && row.file_name && Number.isFinite(Date.parse(row.submitted_at))) row.history.push(verificationEvent(row, 'Submitted', { ...resident, role: 'resident' }, row.submitted_at));
}

export function appendVerificationEvent(row, action, user, at, reason) {
  row.history.push(verificationEvent(row, action, user, at, reason));
  row.revision = (row.revision || 0) + 1;
  row.updated_at = at;
}
