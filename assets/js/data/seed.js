/** Exact fictional demo identities; ids are documented in DATA-MODEL.md. */
export function createSeed() {
  const user = (id, full_name, email, role, household_id = null) => ({
    id, full_name, email, contact_number: '', password: 'demo1234', barangay_id: 1,
    household_id, is_resident: role === 'resident', is_secretary: role === 'secretary',
    is_tanod: role === 'tanod', is_captain: role === 'captain',
    is_responder: role === 'responder', is_rescuer: role === 'rescuer', created_at: '2026-10-04T08:00:00+08:00',
  });
  const alert = (id, alert_type, location_label, victim_count, status, created_at, extra = {}) => ({
    id, barangay_id: 1, resident_id: null, household_id: null, acknowledged_by: null,
    assigned_responder_id: null, assigned_rescuer_id: null, alert_type, description: '',
    location_label, map_x: 60, map_y: 54, victim_count, photo_name: '', status,
    created_at, acknowledged_at: null, resolved_at: null, ...extra,
  });
  return {
    version: 1, revision: 0, updated_at: '2026-10-04T14:20:00+08:00',
    barangays: [
      { id: 1, name: 'Barangay Sampaguita', map_image: 'assets/img/map-sampaguita.svg' },
      { id: 2, name: 'Barangay Dalisay', map_image: 'assets/img/map-dalisay.svg' },
      { id: 3, name: 'Barangay Pag-asa', map_image: 'assets/img/map-pag-asa.svg' },
    ],
    users: [user(1, 'Ana Reyes', 'ana.reyes@example.com', 'secretary'), user(2, 'Carlo Mendoza', 'carlo.mendoza@example.com', 'responder'), user(3, 'Ramon Bautista', 'ramon.bautista@example.com', 'rescuer'), user(4, 'Maria Santos', 'maria.santos@example.com', 'resident', 1), user(5, 'Jose Dela Cruz', 'jose.dela.cruz@example.com', 'resident', 2), user(6, 'Luis Garcia', 'luis.garcia@example.com', 'tanod'), user(7, 'Roberto Aquino', 'roberto.aquino@example.com', 'captain')],
    households: [{ id: 1, barangay_id: 1, address: '14 Riverside Street', map_x: 67, map_y: 53 }, { id: 2, barangay_id: 1, address: '8 Mabini Street', map_x: 43, map_y: 44 }],
    verify_residency: [
      { id: 1, user_id: 4, document_type: 'Proof of residence', file_name: 'maria-proof-of-residence.pdf', review_status: 'Approved', submitted_at: '2026-10-01T09:00:00+08:00', deadline_at: '2026-10-08T09:00:00+08:00', reviewed_by: 1, reviewed_at: '2026-10-02T10:00:00+08:00', rejection_reason: '' },
      { id: 2, user_id: 5, document_type: 'Proof of residence', file_name: 'jose-proof-of-residence.pdf', review_status: 'Pending', submitted_at: '2026-10-04T09:00:00+08:00', deadline_at: '2026-10-11T09:00:00+08:00', reviewed_by: null, reviewed_at: null, rejection_reason: '' },
    ],
    facilities: [{ id: 1, type: 'EvacuationCenter', name: 'Sampaguita Elementary School', address: 'School Road, Barangay Sampaguita', capacity: 250, contact: '', barangay_id: 1, map_x: 35, map_y: 25 }, { id: 2, type: 'Hospital', name: 'Dalisay District Hospital', address: 'Hospital Road', capacity: null, contact: '(02) 8000-0000', barangay_id: null, map_x: 77, map_y: 22 }],
    emergency_alerts: [
      alert(1042, 'Flood', 'Riverside Street', 2, 'Pending', '2026-10-04T14:10:00+08:00', { resident_id: 4, household_id: 1, map_x: 67, map_y: 53, description: 'Floodwater is rising along Riverside Street. Two residents need evacuation assistance.' }),
      alert(1038, 'Other', 'Mabini Street', 1, 'Rescue in progress', '2026-10-04T13:45:00+08:00', { description: 'Fallen tree obstructing Mabini Street.', acknowledged_by: 1, acknowledged_at: '2026-10-04T13:47:00+08:00', assigned_responder_id: 2, assigned_rescuer_id: 3, map_x: 43, map_y: 44 }),
      alert(1031, 'Landslide', 'Hillside Road', null, 'Resolved', '2026-10-03T16:15:00+08:00', { acknowledged_by: 1, acknowledged_at: '2026-10-03T16:20:00+08:00', assigned_responder_id: 2, assigned_rescuer_id: 3, resolved_at: '2026-10-03T17:00:00+08:00', map_x: 22, map_y: 65 }),
    ],
    alert_responses: [{ id: 1, alert_id: 1038, responder_id: 2, response_type: 'Assessment', response_status: 'Completed', notes: 'Site assessed. Extraction and transport requested.', responded_at: '2026-10-04T13:50:00+08:00' }, { id: 2, alert_id: 1031, responder_id: 2, response_type: 'Assessment', response_status: 'Completed', notes: 'Landslide area assessed.', responded_at: '2026-10-03T16:25:00+08:00' }],
    rescues: [{ id: 1, alert_id: 1038, rescuer_id: 3, facility_id: 1, rescue_status: 'In progress', notes: 'Transport to Sampaguita Elementary School is in progress.', rescued_at: '2026-10-04T14:00:00+08:00' }, { id: 2, alert_id: 1031, rescuer_id: 3, facility_id: 1, rescue_status: 'Completed', notes: 'Residents transported to the evacuation center.', rescued_at: '2026-10-03T16:45:00+08:00' }],
    announcements: [{ id: 1, barangay_id: 1, posted_by: 1, title: 'Typhoon advisory: evacuation centers open at 6:00 PM', content: 'Evacuation centers open at 6:00 PM. Prepare essential supplies and follow barangay advisories.', created_at: '2026-10-04T12:00:00+08:00' }, { id: 2, barangay_id: 1, posted_by: 1, title: 'Barangay assembly this Saturday', content: 'Residents are invited to the barangay assembly this Saturday.', created_at: '2026-10-04T10:00:00+08:00' }],
    community_feedback: [{ id: 1, resident_id: 5, barangay_id: 1, type: 'complaint', created_at: '2026-10-04T11:00:00+08:00', category: 'Drainage', description: 'Blocked drainage near Mabini Street', location: '8 Mabini Street', status: 'Pending', assigned_tanod_id: null, rating: null, comment: '' }, { id: 2, resident_id: 4, barangay_id: 1, type: 'suggestion', created_at: '2026-10-04T10:30:00+08:00', category: 'Preparedness', description: 'Add emergency supply reminders to barangay advisories.', location: 'Riverside Street', status: 'Pending', assigned_tanod_id: null, rating: null, comment: '' }, { id: 3, resident_id: 4, barangay_id: 1, type: 'general', created_at: '2026-10-04T10:00:00+08:00', category: '', description: '', location: '', status: null, assigned_tanod_id: null, rating: 4, comment: 'The evacuation information is easy to follow.' }],
    notifications: [{ id: 1, user_id: 1, kind: 'alert_new', text: 'New Flood alert · A-1042 · Riverside Street', link: 'official-alert.html?id=1042', is_read: false, created_at: '2026-10-04T14:10:00+08:00' }, { id: 2, user_id: 1, kind: 'verification', text: 'Jose Dela Cruz submitted proof of residence.', link: 'official-verification.html?id=2', is_read: false, created_at: '2026-10-04T09:00:00+08:00' }],
  };
}
export const Seed = Object.freeze({ create: createSeed });
export default createSeed;
