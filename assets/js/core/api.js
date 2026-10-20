import { ApiError, copy, delay, zonedISO } from './config.js';
import { Store } from './store.js';
import { Auth, publicUser } from './auth.js';
import { assertRole, assertBarangay, assertOwner, assertReadAlert, requireUser, roleOf, isOfficial } from './permissions.js';
import { transition, ALERT_TYPES, ALERT_STATUSES, RESPONSE_TYPES } from './alertMachine.js';

export { ApiError };
const staff = ['secretary', 'responder', 'rescuer'];
const nextId = rows => Math.max(0, ...rows.map(row => row.id)) + 1;
const recent = rows => [...rows].sort((a, b) => Date.parse(b.created_at || b.submitted_at) - Date.parse(a.created_at || a.submitted_at) || b.id - a.id);
function get(rows, id, label = 'Record') {
  const n = Number(id); const record = rows.find(row => row.id === n);
  if (!Number.isInteger(n) || !record) throw new ApiError('NOT_FOUND', `${label} was not found.`);
  return record;
}
function text(value, field, { required = true, max = 2000 } = {}) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new ApiError('VALIDATION', `Check ${field.replaceAll('_', ' ')}.`, { [field]: required && !result ? 'This field is required.' : `Use ${max} characters or fewer.` });
  return result;
}
function oneOf(value, options, field) {
  if (!options.includes(value)) throw new ApiError('VALIDATION', `Choose a valid ${field.replaceAll('_', ' ')}.`, { [field]: 'Choose one of the available options.' });
  return value;
}
function count(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new ApiError('VALIDATION', 'Enter a valid victim count or choose Not sure.', { victim_count: 'Use a whole number from 0 to 9999.' });
  return n;
}
function coordinate(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new ApiError('VALIDATION', 'Choose a location inside the barangay map.', { [field]: 'Use a map coordinate from 0 to 100.' });
  return n;
}
const latestVerification = (db, id) => recent(db.verify_residency.filter(row => row.user_id === id))[0] || null;
const within = (db, user, row) => assertBarangay(user, db.users.find(person => person.id === row.user_id) || row);
function notification(db, user_id, kind, message, link, at) {
  db.notifications.push({ id: nextId(db.notifications), user_id, kind, text: message, link, is_read: false, created_at: at });
}
function notifyOfficials(db, barangay, kind, message, link, at) {
  for (const user of db.users.filter(u => u.barangay_id === barangay && isOfficial(u))) notification(db, user.id, kind, message, link, at);
}
function joinedAlert(db, alert) {
  const resident = db.users.find(u => u.id === alert.resident_id) || null;
  const responses = db.alert_responses.filter(r => r.alert_id === alert.id).map(r => ({ ...r, responder: publicUser(db.users.find(u => u.id === r.responder_id)) }));
  const rescues = db.rescues.filter(r => r.alert_id === alert.id).map(r => ({ ...r, rescuer: publicUser(db.users.find(u => u.id === r.rescuer_id)), facility: db.facilities.find(f => f.id === r.facility_id) || null }));
  const times = [alert.created_at, alert.acknowledged_at, responses[0]?.responded_at || null, rescues[0]?.rescued_at || null, alert.resolved_at];
  return { ...alert, resident: publicUser(resident), household: db.households.find(h => h.id === alert.household_id) || null, assigned_responder: publicUser(db.users.find(u => u.id === alert.assigned_responder_id)), assigned_rescuer: publicUser(db.users.find(u => u.id === alert.assigned_rescuer_id)), responses, rescues, timeline: ALERT_STATUSES.map((status, i) => ({ status, at: times[i], current: status === alert.status })) };
}
function alertDetails(input, household, partial = false) {
  const patch = {};
  if (!partial || input.alert_type !== undefined) patch.alert_type = oneOf(input.alert_type || 'Other', ALERT_TYPES, 'alert_type');
  for (const key of ['description', 'photo_name']) if (!partial || input[key] !== undefined) patch[key] = text(input[key], key, { required: false, max: key === 'photo_name' ? 200 : 2000 });
  if (!partial || input.location_label !== undefined) patch.location_label = text(input.location_label || household?.address, 'location_label', { max: 200 });
  if (!partial || input.victim_count !== undefined) patch.victim_count = count(input.victim_count);
  for (const key of ['map_x', 'map_y']) if (!partial || input[key] !== undefined) patch[key] = coordinate(input[key], key, household?.[key] ?? 50);
  return patch;
}

/** Contract adapter: browser store today, authenticated Laravel endpoints later. */
export function createApi({ store = Store, auth = Auth, wait = delay, clock = store.now } = {}) {
  const activeUser = db => {
    const session = auth.current();
    const user = session && db.users.find(row => row.id === session.id);
    return requireUser(user);
  };
  const read = async callback => { await wait(); const db = store.read(); return copy(callback(db, activeUser(db))); };
  const write = async (entities, callback) => { await wait(); return store.transact(entities, db => callback(db, activeUser(db), clock())); };
  function transitionAlert(db, user, id, action, at) {
    const alert = get(db.emergency_alerts, id, 'Alert'); assertBarangay(user, alert);
    if (action === 'logResponse' && alert.assigned_responder_id !== user.id) throw new ApiError('FORBIDDEN', 'Only the assigned Responder can log this response.');
    if (action === 'logRescue' && alert.assigned_rescuer_id !== user.id) throw new ApiError('FORBIDDEN', 'Only the assigned Rescuer can log this rescue.');
    const next = transition(alert, action, user, at); Object.assign(alert, next);
    if (alert.resident_id) notification(db, alert.resident_id, 'alert_status', `A-${alert.id} · ${alert.status}`, `resident-alert.html?id=${alert.id}`, at);
    return alert;
  }
  const api = {
    barangays: { async list() { await wait(); return store.read().barangays; } },
    facilities: {
      list: (options = {}) => read((db, user) => {
        const type = options.type === 'Evacuation Center' ? 'EvacuationCenter' : options.type;
        if (options.barangay_id && Number(options.barangay_id) !== user.barangay_id) throw new ApiError('FORBIDDEN', 'Choose your registered barangay.');
        return db.facilities.filter(f => (f.barangay_id === null || f.barangay_id === user.barangay_id) && (!type || f.type === type));
      }),
      get: id => read((db, user) => { const f = get(db.facilities, id, 'Facility'); if (f.barangay_id !== null) assertBarangay(user, f); return f; }),
    },
    users: {
      async register(input = {}) {
        await wait();
        return store.transact(['users', 'verification', 'notifications'], db => {
          const at = clock(); const name = text(input.full_name, 'full_name', { max: 100 });
          const email = text(input.email, 'email', { max: 254 }).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('VALIDATION', 'Enter a valid email.', { email: 'Enter a valid email address.' });
          if (db.users.some(u => u.email.toLowerCase() === email)) throw new ApiError('VALIDATION', 'This email is already registered.', { email: 'Use another email or sign in.' });
          if (typeof input.password !== 'string' || input.password.length < 8) throw new ApiError('VALIDATION', 'Use a password with at least 8 characters.', { password: 'Use at least 8 characters.' });
          if (['is_secretary', 'is_responder', 'is_rescuer', 'is_captain', 'is_tanod'].some(key => Boolean(input[key]))) throw new ApiError('FORBIDDEN', 'Only resident accounts can be registered here.');
          const barangay_id = get(db.barangays, input.barangay_id, 'Barangay').id;
          const address = text(input.address || input.household_address || input.household?.address, 'address', { max: 200 });
          const household = { id: nextId(db.households), barangay_id, address, map_x: coordinate(input.map_x, 'map_x', 50), map_y: coordinate(input.map_y, 'map_y', 50) }; db.households.push(household);
          const user = { id: nextId(db.users), full_name: name, email, password: input.password, contact_number: text(input.contact_number, 'contact_number', { required: false, max: 30 }), barangay_id, household_id: household.id, is_resident: true, is_secretary: false, is_responder: false, is_rescuer: false, is_tanod: false, is_captain: false, created_at: at }; db.users.push(user);
          const verification = { id: nextId(db.verify_residency), user_id: user.id, document_type: text(input.document_type || 'Proof of residence', 'document_type', { max: 100 }), file_name: text(input.file_name, 'file_name', { required: false, max: 200 }), review_status: 'Pending', submitted_at: at, deadline_at: zonedISO(Date.parse(at) + 7 * 86400000), reviewed_by: null, reviewed_at: null, rejection_reason: '' }; db.verify_residency.push(verification);
          notifyOfficials(db, barangay_id, 'verification', `${name} registered for residency verification.`, `official-verification.html?id=${verification.id}`, at);
          return publicUser(user);
        });
      },
      get: id => read((db, user) => { const person = get(db.users, id, 'Resident'); if (person.id !== user.id) { assertRole(user, staff); assertBarangay(user, person); } return { ...publicUser(person), household: db.households.find(h => h.id === person.household_id) || null, verification: latestVerification(db, person.id) }; }),
      update: (id, patch) => write(['users'], (db, user) => {
        const person = get(db.users, id, 'Resident'); assertOwner(user, person, 'id');
        const allowed = ['full_name', 'contact_number', 'address', 'household_address', 'map_x', 'map_y'];
        if (Object.keys(patch).some(key => !allowed.includes(key))) throw new ApiError('VALIDATION', 'Only profile and household fields can be edited.');
        if (patch.full_name !== undefined) person.full_name = text(patch.full_name, 'full_name', { max: 100 });
        if (patch.contact_number !== undefined) person.contact_number = text(patch.contact_number, 'contact_number', { required: false, max: 30 });
        const household = db.households.find(h => h.id === person.household_id);
        if (household) {
          if (patch.address !== undefined || patch.household_address !== undefined) household.address = text(patch.address ?? patch.household_address, 'address', { max: 200 });
          for (const key of ['map_x', 'map_y']) if (patch[key] !== undefined) household[key] = coordinate(patch[key], key, household[key]);
        }
        return { ...publicUser(person), household };
      }),
    },
    verification: {
      submit: (user_id, input = {}) => write(['verification', 'notifications'], (db, user, at) => {
        assertRole(user, ['resident']); if (Number(user_id) !== user.id) throw new ApiError('FORBIDDEN', 'Submit your own verification.');
        let row = latestVerification(db, user.id);
        if (row?.review_status === 'Approved') throw new ApiError('INVALID_STATE', 'Your residency is already approved.');
        const details = { document_type: text(input.document_type, 'document_type', { max: 100 }), file_name: text(input.file_name, 'file_name', { max: 200 }) };
        if (!row || row.review_status !== 'Pending') { row = { id: nextId(db.verify_residency), user_id: user.id }; db.verify_residency.push(row); }
        Object.assign(row, details, { review_status: 'Pending', submitted_at: at, deadline_at: zonedISO(Date.parse(at) + 7 * 86400000), reviewed_by: null, reviewed_at: null, rejection_reason: '' });
        notifyOfficials(db, user.barangay_id, 'verification', `${user.full_name} submitted a verification document.`, `official-verification.html?id=${row.id}`, at); return row;
      }),
      list: (options = {}) => read((db, user) => {
        assertRole(user, ['secretary', 'resident']);
        return recent(db.verify_residency.filter(row => {
          const resident = db.users.find(u => u.id === row.user_id);
          return resident?.barangay_id === user.barangay_id && (roleOf(user) !== 'resident' || row.user_id === user.id) && latestVerification(db, resident.id)?.id === row.id && (!options.status || row.review_status === options.status);
        })).map(row => { const resident = db.users.find(u => u.id === row.user_id); return { ...row, resident: publicUser(resident), household: db.households.find(h => h.id === resident.household_id) || null }; });
      }),
      get: id => read((db, user) => { const row = get(db.verify_residency, id, 'Verification'); if (roleOf(user) === 'resident') { if (row.user_id !== user.id) throw new ApiError('FORBIDDEN', 'View your own verification.'); } else { assertRole(user, ['secretary']); within(db, user, row); } const resident = db.users.find(u => u.id === row.user_id); return { ...row, resident: publicUser(resident), household: db.households.find(h => h.id === resident.household_id) || null }; }),
      review: (id, input = {}) => write(['verification', 'notifications', 'users'], (db, user, at) => {
        assertRole(user, ['secretary']); const row = get(db.verify_residency, id, 'Verification'); within(db, user, row);
        if (row.review_status !== 'Pending' || Date.parse(row.deadline_at) < Date.parse(at)) throw new ApiError('INVALID_STATE', 'This verification is no longer pending or its deadline has expired.');
        row.review_status = oneOf(input.decision, ['Approved', 'Rejected'], 'decision');
        row.rejection_reason = text(input.reason, 'reason', { required: row.review_status === 'Rejected', max: 1000 });
        row.reviewed_by = user.id; row.reviewed_at = at;
        notification(db, row.user_id, 'verification', `Your residency verification was ${row.review_status.toLowerCase()}.`, 'resident-verification.html', at); return row;
      }),
      expireOverdue: () => write(['verification', 'notifications'], (db, user, at) => {
        assertRole(user, ['secretary', 'resident']);
        let changed = 0;
        for (const row of db.verify_residency) {
          const person = db.users.find(u => u.id === row.user_id);
          if (person?.barangay_id !== user.barangay_id || (roleOf(user) === 'resident' && row.user_id !== user.id)) continue;
          if (roleOf(user) !== 'resident') assertRole(user, ['secretary']);
          if (row.review_status === 'Pending' && Date.parse(row.deadline_at) < Date.parse(at)) { row.review_status = 'Expired'; changed++; notification(db, row.user_id, 'verification', 'Your verification deadline expired. Resubmit your document.', 'resident-verification.html', at); }
        }
        return changed;
      }),
    },
    alerts: {
      list: (options = {}) => read((db, user) => {
        if (roleOf(user) === 'resident' && options.resident_id && Number(options.resident_id) !== user.id) throw new ApiError('FORBIDDEN', 'View your own alerts.');
        const q = String(options.q || '').trim().toLowerCase();
        return recent(db.emergency_alerts.filter(a => a.barangay_id === user.barangay_id && (roleOf(user) !== 'resident' || a.resident_id === user.id) && (!options.resident_id || a.resident_id === Number(options.resident_id)) && (!options.status || a.status === options.status) && (!options.alert_type || a.alert_type === options.alert_type) && (!q || [a.id, `A-${a.id}`, a.location_label, db.users.find(u => u.id === a.resident_id)?.full_name].some(v => String(v || '').toLowerCase().includes(q))))).map(a => joinedAlert(db, a));
      }),
      get: id => read((db, user) => { const a = get(db.emergency_alerts, id, 'Alert'); assertReadAlert(user, a); return joinedAlert(db, a); }),
      create: (input = {}) => write(['alerts', 'notifications'], (db, user, at) => {
        assertRole(user, ['resident']);
        if (latestVerification(db, user.id)?.review_status !== 'Approved') throw new ApiError('FORBIDDEN', 'Residency approval is required before sending SOS.');
        const household = db.households.find(h => h.id === user.household_id);
        const row = { id: nextId(db.emergency_alerts), resident_id: user.id, household_id: user.household_id, barangay_id: user.barangay_id, acknowledged_by: null, assigned_responder_id: null, assigned_rescuer_id: null, ...alertDetails(input, household), status: 'Pending', created_at: at, acknowledged_at: null, resolved_at: null };
        db.emergency_alerts.push(row); notifyOfficials(db, user.barangay_id, 'alert_new', `New ${row.alert_type} alert · A-${row.id} · ${row.location_label}`, `official-alert.html?id=${row.id}`, at); return joinedAlert(db, row);
      }),
      addDetails: (id, patch = {}) => write(['alerts'], (db, user) => {
        assertRole(user, ['resident']); const row = get(db.emergency_alerts, id, 'Alert'); assertOwner(user, row);
        if (row.status === 'Resolved') throw new ApiError('INVALID_STATE', 'This alert is resolved.');
        const allowed = ['alert_type', 'description', 'photo_name', 'location_label', 'victim_count', 'map_x', 'map_y'];
        if (Object.keys(patch).some(k => !allowed.includes(k))) throw new ApiError('VALIDATION', 'Only optional alert details can be edited.');
        Object.assign(row, alertDetails(patch, db.households.find(h => h.id === row.household_id), true)); return joinedAlert(db, row);
      }),
      acknowledge: id => write(['alerts', 'notifications'], (db, user, at) => {
        const a = transitionAlert(db, user, id, 'acknowledge', at);
        a.assigned_responder_id = db.users.find(u => u.barangay_id === user.barangay_id && u.is_responder)?.id || null;
        if (a.assigned_responder_id) notification(db, a.assigned_responder_id, 'alert_status', `A-${a.id} acknowledged. Your response is requested.`, `official-alert.html?id=${a.id}`, at);
        return joinedAlert(db, a);
      }),
      logResponse: (id, input = {}) => write(['alerts', 'notifications'], (db, user, at) => {
        const response_type = oneOf(input.response_type, RESPONSE_TYPES, 'response_type'), response_status = oneOf(input.response_status, ['Responding', 'Completed'], 'response_status'), notes = text(input.notes, 'notes', { required: false });
        const a = transitionAlert(db, user, id, 'logResponse', at);
        db.alert_responses.push({ id: nextId(db.alert_responses), alert_id: a.id, responder_id: user.id, response_type, response_status, notes, responded_at: at });
        a.assigned_rescuer_id = db.users.find(u => u.barangay_id === user.barangay_id && u.is_rescuer)?.id || null;
        if (a.assigned_rescuer_id) notification(db, a.assigned_rescuer_id, 'alert_status', `A-${a.id} requires extraction and transport.`, `official-alert.html?id=${a.id}`, at);
        return joinedAlert(db, a);
      }),
      logRescue: (id, input = {}) => write(['alerts', 'notifications'], (db, user, at) => {
        const facility = get(db.facilities, input.facility_id, 'Facility'); if (facility.barangay_id !== null) assertBarangay(user, facility);
        const rescue_status = oneOf(input.rescue_status, ['In progress', 'Completed'], 'rescue_status'), notes = text(input.notes, 'notes', { required: false });
        const a = transitionAlert(db, user, id, 'logRescue', at);
        db.rescues.push({ id: nextId(db.rescues), alert_id: a.id, rescuer_id: user.id, facility_id: facility.id, rescue_status, notes, rescued_at: at });
        if (a.resident_id) { const n = db.notifications.filter(n => n.user_id === a.resident_id && n.created_at === at).at(-1); if (n) n.text += ` · Destination: ${facility.name}`; }
        return joinedAlert(db, a);
      }),
      resolve: id => write(['alerts', 'notifications'], (db, user, at) => joinedAlert(db, transitionAlert(db, user, id, 'resolve', at))),
    },
    announcements: {
      list: () => read((db, user) => recent(db.announcements.filter(row => row.barangay_id === user.barangay_id)).map(row => ({ ...row, author: publicUser(db.users.find(u => u.id === row.posted_by)) }))),
      get: id => read((db, user) => { const row = get(db.announcements, id, 'Announcement'); assertBarangay(user, row); return { ...row, author: publicUser(db.users.find(u => u.id === row.posted_by)) }; }),
      create: (input = {}) => write(['announcements', 'notifications'], (db, user, at) => {
        assertRole(user, ['secretary']); const row = { id: nextId(db.announcements), barangay_id: user.barangay_id, posted_by: user.id, title: text(input.title, 'title', { max: 200 }), content: text(input.content, 'content', { max: 5000 }), created_at: at }; db.announcements.push(row);
        for (const resident of db.users.filter(u => u.is_resident && u.barangay_id === user.barangay_id)) notification(db, resident.id, 'announcement', row.title, `resident-announcements.html?id=${row.id}`, at); return row;
      }),
    },
    feedback: {
      list: (options = {}) => read((db, user) => {
        if (roleOf(user) !== 'resident') assertRole(user, ['secretary']);
        if (roleOf(user) === 'resident' && options.resident_id && Number(options.resident_id) !== user.id) throw new ApiError('FORBIDDEN', 'View your own feedback.');
        return recent(db.community_feedback.filter(row => row.barangay_id === user.barangay_id && (roleOf(user) !== 'resident' || row.resident_id === user.id) && (!options.resident_id || row.resident_id === Number(options.resident_id)) && (!options.type || row.type === options.type) && (!options.status || row.status === options.status))).map(row => ({ ...row, resident: publicUser(db.users.find(u => u.id === row.resident_id)), assigned_tanod: publicUser(db.users.find(u => u.id === row.assigned_tanod_id)) }));
      }),
      get: id => read((db, user) => { const row = get(db.community_feedback, id, 'Feedback'); assertBarangay(user, row); if (roleOf(user) === 'resident') assertOwner(user, row); else assertRole(user, ['secretary']); return { ...row, resident: publicUser(db.users.find(u => u.id === row.resident_id)), assigned_tanod: publicUser(db.users.find(u => u.id === row.assigned_tanod_id)) }; }),
      create: (type, input = {}) => write(['feedback', 'notifications'], (db, user, at) => {
        assertRole(user, ['resident']); oneOf(type, ['complaint', 'suggestion', 'general'], 'type');
        const row = { id: nextId(db.community_feedback), resident_id: user.id, barangay_id: user.barangay_id, type, created_at: at, category: '', description: '', location: '', status: type === 'general' ? null : 'Pending', assigned_tanod_id: null, rating: null, comment: '' };
        if (type === 'general') { row.rating = Number(input.rating); if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) throw new ApiError('VALIDATION', 'Choose a rating from 1 to 5.', { rating: 'Choose 1 to 5 stars.' }); row.comment = text(input.comment, 'comment'); }
        else { row.category = text(input.category, 'category', { max: 100 }); row.description = text(input.description, 'description'); row.location = text(input.location, 'location', { required: false, max: 200 }); }
        db.community_feedback.push(row); notifyOfficials(db, user.barangay_id, 'feedback_update', `New ${type} from ${user.full_name}.`, `official-feedback.html?type=${type}&id=${row.id}`, at); return row;
      }),
      assignTanod: (id, tanod_id) => write(['feedback', 'notifications'], (db, user, at) => {
        assertRole(user, ['secretary']); const row = get(db.community_feedback, id, 'Feedback'); assertBarangay(user, row);
        if (row.type === 'general' || row.status !== 'Pending') throw new ApiError('INVALID_STATE', 'Only pending complaints and suggestions can be assigned.');
        const tanod = get(db.users, tanod_id, 'Tanod'); if (!tanod.is_tanod || tanod.barangay_id !== user.barangay_id) throw new ApiError('VALIDATION', 'Choose a Tanod in this barangay.');
        row.assigned_tanod_id = tanod.id; row.status = 'Assigned'; notification(db, row.resident_id, 'feedback_update', `Your ${row.type} was assigned to Tanod ${tanod.full_name}.`, `resident-feedback.html?id=${row.id}`, at); return row;
      }),
      resolve: id => write(['feedback', 'notifications'], (db, user, at) => {
        assertRole(user, ['secretary']); const row = get(db.community_feedback, id, 'Feedback'); assertBarangay(user, row);
        if (row.type === 'general' || row.status === 'Resolved') throw new ApiError('INVALID_STATE', 'This feedback cannot be marked resolved.');
        row.status = 'Resolved'; notification(db, row.resident_id, 'feedback_update', `Your ${row.type} was resolved.`, `resident-feedback.html?id=${row.id}`, at); return row;
      }),
    },
    notifications: {
      list: () => read((db, user) => recent(db.notifications.filter(n => n.user_id === user.id))),
      markRead: id => write(['notifications'], (db, user) => { const n = get(db.notifications, id, 'Notification'); assertOwner(user, n, 'user_id'); n.is_read = true; return n; }),
      markAllRead: () => write(['notifications'], (db, user) => { let n = 0; db.notifications.filter(n => n.user_id === user.id && !n.is_read).forEach(row => { row.is_read = true; n++; }); return n; }),
      clearRead: () => write(['notifications'], (db, user) => { const before = db.notifications.length; db.notifications = db.notifications.filter(n => n.user_id !== user.id || !n.is_read); return before - db.notifications.length; }),
    },
    dashboard: { officialStats: () => read((db, user) => {
      assertRole(user, staff); const alerts = db.emergency_alerts.filter(a => a.barangay_id === user.barangay_id), day = clock().slice(0, 10);
      return { active_alerts: alerts.filter(a => a.status !== 'Resolved').length, pending_verifications: db.verify_residency.filter(v => v.review_status === 'Pending' && db.users.find(u => u.id === v.user_id)?.barangay_id === user.barangay_id && latestVerification(db, v.user_id)?.id === v.id).length, open_feedback: db.community_feedback.filter(f => f.barangay_id === user.barangay_id && f.type !== 'general' && f.status !== 'Resolved').length, resolved_today: alerts.filter(a => a.resolved_at?.slice(0, 10) === day).length, assigned_today: alerts.filter(a => a.assigned_responder_id === user.id && a.acknowledged_at?.slice(0, 10) === day).length, active_rescues: alerts.filter(a => a.assigned_rescuer_id === user.id && a.status !== 'Resolved').length };
    }) },
    subscribe: (entity, handler) => store.subscribe(entity, handler),
  };
  return Object.freeze(api);
}
export const Api = createApi();
export default Api;
