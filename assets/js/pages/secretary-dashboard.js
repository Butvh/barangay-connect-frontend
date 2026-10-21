import { Auth, Api, Store, UI, Icons, Fmt, e, dialog, live, errorView, alertName, victims } from './official-shared.js';
import { BCMap } from '../core/map.js';
import { nextAnnouncementExpiry } from '../core/announcements.js';
import { announcementAuthor, composeAnnouncement, readAnnouncement } from './official-announcement-actions.js';
import { secretaryDashboard } from './official-dashboard-model.js?v=secretary-dashboard-1';

const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const chevron = () => Icons.svg('chevron-right', { size: 16 });
const sectionLink = (href, label = 'View all') => `<a class="secretary-section-link" href="${e(href)}">${label}<img class="icon" src="assets/img/source/secretary-section-arrow.svg" width="16" height="16" alt=""></a>`;
const category = row => {
  const label = String(row.category || '').trim() || 'Update';
  return { label, ...({ Advisory: { icon: 'megaphone', tone: 'blue' }, Assembly: { icon: 'users', tone: 'violet' }, Notice: { icon: 'info', tone: 'orange' } }[label] || { icon: 'megaphone', tone: 'blue' }) };
};

export function mountSecretaryDashboard(main, user) {
  Auth.requireRole(['secretary']);
  document.body.classList.add('secretary-dashboard');
  document.title = 'Secretary Dashboard — Barangay Connect';
  main.classList.add('secretary-dashboard-main');
  main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading Secretary Dashboard…</p>' + UI.skeleton(3);
  let map, model, reference, barangay, data, composer, timer, version = 0, alive = true;
  function metric(label, value, supporting, icon, tone, href) {
    return `<a class="card secretary-metric" href="${href}" aria-label="${label}: ${value}"><span class="secretary-metric-icon ${tone}">${Icons.svg(icon, { size: icon === 'triangle-alert' ? 28 : 24 })}</span><span class="secretary-metric-copy"><span>${label}</span><strong>${value}</strong><small>${e(supporting)}</small></span>${chevron()}</a>`;
  }
  function activityItems(items) {
    return `<ol class="secretary-activity-list">${items.map(item => `<li><a href="${e(item.href)}"><span class="secretary-timeline-dot" aria-hidden="true"></span><span class="secretary-activity-copy"><strong>${e(item.title)}</strong><span>${e(item.detail)}</span></span><time datetime="${e(item.at)}" title="${e(Fmt.dateTime(item.at))}">${e(Fmt.date(item.at) === Fmt.date(reference) ? clock.format(new Date(item.at)) : Fmt.short(item.at))}</time></a></li>`).join('')}</ol>`;
  }
  function showActivity() {
    const el = dialog('Secretary activity log', `${model.activity.length ? activityItems(model.activity) : '<p>No activity has been recorded yet.</p>'}<div class="actions"><button type="button" class="btn" data-done>Done</button></div>`);
    el.classList.add('secretary-activity-dialog', 'dialog-wide');
    el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
  }
  function postAnnouncement() {
    if (composer?.open) return;
    composer = composeAnnouncement({ barangay, onSaved: async () => { await load(); main.querySelector('[data-post-announcement]')?.focus(); } });
    composer.addEventListener('close', () => { composer = null; main.querySelector('[data-post-announcement]')?.focus(); }, { once: true });
  }
  function mountMap() {
    const container = main.querySelector('[data-dashboard-map]'), callout = main.querySelector('[data-map-callout]');
    const show = marker => {
      callout.hidden = !marker;
      if (marker) callout.innerHTML = `<strong>${e(marker.kind === 'alert' ? alertName(marker.record) : marker.label)}</strong><span>${e(marker.kind === 'alert' ? marker.record.location_label || 'Location not provided' : marker.record.address || 'Mapped facility')}</span>`;
    };
    show(model.markers.find(marker => marker.selected));
    map = BCMap.mount(container, { barangay_id: user.barangay_id, markers: model.markers, controls: false, interactive: false, onSelect: marker => {
      show(marker);
      dialog('Map location', `<div class="stack"><p>${e(marker.label)}</p><small>Approximate location on the barangay illustration.</small>${marker.kind === 'alert' ? `<a class="btn btn-primary" href="official-alert.html?id=${marker.record.id}">Open alert details</a>` : ''}<a class="btn" href="official-map.html">Open map monitoring</a></div>`);
    } });
  }
  function render() {
    map?.destroy(); map = null;
    const m = model.metrics, priority = model.priority;
    const announcementHint = m.categories.some(item => item.label !== 'Update') ? m.categories.map(item => `${item.label}: ${item.count}`).join(' · ') : 'Published barangay updates';
    const incident = priority ? `<article class="secretary-priority-incident"><div class="secretary-incident-heading"><h3>${e(alertName(priority))}</h3>${UI.badge(priority.status)}</div><dl class="secretary-incident-facts">${[
      ['map-pin', 'Location', `${priority.location_label || 'Location not provided'}${String(priority.location_label || '').toLowerCase().includes(barangay.toLowerCase()) ? '' : `, ${barangay}`}`],
      ['users', 'Victims', victims(priority.victim_count)], ['user', 'Reporter', `Reported by ${priority.resident?.full_name || 'Reporter not provided'}`], ['clock', 'Received', `Received: ${Fmt.dateTime(priority.created_at)}`],
    ].map(([icon, label, value]) => `<div><dt><span class="sr-only">${label}</span>${icon === 'map-pin' ? '<img class="icon" src="assets/img/source/secretary-location.svg" width="24" height="24" alt="">' : Icons.svg(icon, { size: 20 })}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="secretary-incident-description">${e(priority.description || 'No additional incident details have been provided.')}</p><a class="btn btn-primary secretary-open-alert" href="official-alert.html?id=${priority.id}"><span>Open alert details</span>${chevron()}</a></article>` : UI.empty({ icon: 'circle-check', title: 'No active alerts', text: 'New resident SOS reports will appear here.' });
    main.innerHTML = `<header class="secretary-heading"><h1>Secretary Dashboard</h1><p>Operations overview for ${e(barangay)}</p></header>
      <div class="secretary-metrics" aria-label="Operations summary">
        ${metric('Active alerts', m.active, `${m.pending} pending · ${m.inProgress} in progress`, 'triangle-alert', 'red', 'official-alerts.html')}
        ${metric('Pending verifications', m.verifications, 'Awaiting review', 'shield-check', 'blue', 'official-verifications.html?status=Pending')}
        ${metric('Open feedback', m.feedback, `${plural(m.complaints, 'complaint')} · ${plural(m.suggestions, 'suggestion')}`, 'message-square', 'amber', 'official-feedback.html')}
        ${metric('Announcements today', m.announcementsToday, announcementHint, 'megaphone', 'green', 'official-announcements.html')}
      </div>
      <div class="secretary-middle">
        <section class="card secretary-panel secretary-priority" aria-labelledby="priority-heading"><div class="secretary-section-head"><h2 id="priority-heading">Priority overview</h2>${sectionLink('official-alerts.html', 'View all alerts')}</div>${incident}</section>
        <section class="card secretary-panel secretary-map-panel" aria-labelledby="map-heading"><div class="secretary-section-head"><h2 id="map-heading">Barangay map overview</h2><span class="secretary-map-status${m.active ? '' : ' clear'}"><i aria-hidden="true"></i>${m.active ? 'Active alert' : 'No active alerts'}</span></div><div class="secretary-map-surface"><div data-dashboard-map></div><div class="secretary-map-callout" data-map-callout hidden></div><a class="icon-btn secretary-full-map" href="official-map.html" aria-label="Open full map" title="Open full map"><img src="assets/img/source/secretary-maximize.svg" width="24" height="24" alt=""></a></div><div class="secretary-map-summary"><div><img class="icon" src="assets/img/source/secretary-marker-count.svg" width="28" height="28" alt=""><span><strong>${model.markers.filter(marker => marker.kind === 'alert').length}</strong><small>active markers</small></span></div><div>${Icons.svg('building-2', { size: 28 })}<span><strong>${model.mappedFacilities}</strong><small>mapped facilities</small></span></div></div>${model.mapAvailable && model.unmappedAlerts ? `<small class="secretary-unmapped">${plural(model.unmappedAlerts, 'alert')} without a map location</small>` : ''}</section>
        <section class="card secretary-panel secretary-quick" aria-labelledby="quick-heading"><h2 id="quick-heading">Quick actions</h2><div class="secretary-quick-buttons"><a class="btn btn-primary" href="official-verifications.html?status=Pending">${Icons.svg('shield-check')}<span>Review verifications</span>${chevron()}</a><button type="button" class="btn" data-post-announcement>${Icons.svg('megaphone')}<span>Post announcement</span>${chevron()}</button><a class="btn" href="official-map.html">${Icons.svg('map')}<span>Open map monitoring</span>${chevron()}</a></div></section>
      </div>
      <div class="secretary-bottom">
        <section class="card secretary-panel" aria-labelledby="activity-heading"><div class="secretary-section-head"><h2 id="activity-heading">Secretary activity log</h2><button type="button" class="secretary-section-link" data-all-activity>View all<img class="icon" src="assets/img/source/secretary-section-arrow.svg" width="16" height="16" alt=""></button></div>${model.activity.length ? activityItems(model.activity.slice(0, 4)) : '<p class="secretary-empty">No activity has been recorded yet.</p>'}</section>
        <section class="card secretary-panel" aria-labelledby="verification-heading"><div class="secretary-section-head"><h2 id="verification-heading">Pending verifications</h2>${sectionLink('official-verifications.html?status=Pending')}</div>${model.pendingVerifications.length ? `<ul class="secretary-record-list">${model.pendingVerifications.slice(0, 3).map(row => `<li><a class="secretary-verification-row" href="official-verification.html?id=${row.id}" aria-label="Review ${e(row.resident?.full_name || 'resident')}"><span class="secretary-resident-avatar">${e(Fmt.initials(row.resident?.full_name))}</span><span class="secretary-record-copy"><strong>${e(row.resident?.full_name || 'Resident')}</strong><span>${e(row.household?.address || 'Address not provided')}</span></span>${UI.badge(row.review_status)}${chevron()}</a></li>`).join('')}</ul>` : '<p class="secretary-empty">No verifications are awaiting review.</p>'}</section>
        <section class="card secretary-panel" aria-labelledby="announcement-heading"><div class="secretary-section-head"><h2 id="announcement-heading">Recent announcements</h2>${sectionLink('official-announcements.html')}</div>${model.recentAnnouncements.length ? `<ul class="secretary-record-list">${model.recentAnnouncements.map(row => { const kind = category(row); return `<li><button type="button" class="secretary-announcement-row" data-announcement="${row.id}"><span class="secretary-announcement-icon ${kind.tone}">${Icons.svg(kind.icon)}</span><span class="secretary-record-copy"><strong>${e(row.title)}</strong><small>${e(announcementAuthor(row))} · ${e(Fmt.date(row.published_at ?? row.created_at))}</small></span><span class="secretary-category ${kind.tone}">${e(kind.label)}</span>${chevron()}</button></li>`; }).join('')}</ul>` : '<p class="secretary-empty">No active announcements to display.</p>'}</section>
      </div>`;
    main.querySelector('[data-post-announcement]').addEventListener('click', postAnnouncement);
    main.querySelector('[data-all-activity]').addEventListener('click', showActivity);
    main.querySelectorAll('[data-announcement]').forEach(button => button.addEventListener('click', () => readAnnouncement(model.recentAnnouncements.find(row => row.id === Number(button.dataset.announcement)), () => main.querySelector(`[data-announcement="${button.dataset.announcement}"]`)?.focus())));
    mountMap();
  }
  function schedule() {
    clearTimeout(timer); if (document.hidden || !alive || !data) return;
    let now;
    try { now = Date.parse(Store.now()); } catch { return; }
    if (!Number.isFinite(now)) return;
    const day = 86400000, midnight = now + day - ((now + 8 * 3600000) % day);
    const expiry = nextAnnouncementExpiry(data.announcements, reference), deadline = model.pendingVerifications.map(row => Date.parse(row.deadline_at) + 1).filter(value => value > now);
    const next = Math.min(midnight, expiry || Infinity, ...deadline);
    timer = setTimeout(load, Math.max(50, next - now + 25));
  }
  async function load() {
    const request = ++version;
    try {
      const [alerts, announcements, facilities, barangays, verifications, feedback] = await Promise.all([Api.alerts.list(), Api.announcements.list(), Api.facilities.list(), Api.barangays.list(), Api.verification.list(), Api.feedback.list()]);
      if (!alive || request !== version) return;
      reference = Store.now(); barangay = barangays.find(row => row.id === user.barangay_id)?.name || 'Your barangay';
      data = { alerts, announcements, facilities, verifications, feedback }; model = secretaryDashboard(data, { barangayId: user.barangay_id, at: reference });
      render(); schedule();
    } catch (error) { if (!alive || request !== version) return; clearTimeout(timer); map?.destroy(); map = null; errorView(main, error, load); }
    finally { if (alive && request === version) main.removeAttribute('aria-busy'); }
  }
  const update = live(['alerts', 'announcements', 'verification', 'feedback', 'users'], load);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else update(); });
  window.addEventListener('beforeunload', event => { if (composer?.open && (composer.dataset.dirty === 'true' || composer.querySelector('[aria-busy="true"]'))) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', event => { if (!event.persisted) { alive = false; version++; clearTimeout(timer); map?.destroy(); } }, { once: true });
  update();
}
