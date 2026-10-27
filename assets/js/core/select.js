// Shared Alerts-style dropdown; the native select remains the form-data source.
const documents = new WeakMap();
let sequence = 0;
const set = (node, name, value) => {
  if (value == null || value === '') { if (node.hasAttribute(name)) node.removeAttribute(name); }
  else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
};
const eligible = node => node.tagName === 'SELECT' && !node.multiple && node.size <= 1;
const enabled = option => option && !option.disabled && !option.hidden && !option.parentElement?.disabled && !option.parentElement?.hidden;
const stateFor = doc => {
  if (!documents.has(doc)) documents.set(doc, { controls: new Map(), active: null, focused: null });
  return documents.get(doc);
};

export function mountSelect(select) {
  const doc = select.ownerDocument, win = doc.defaultView, state = stateFor(doc);
  if (state.controls.has(select)) return state.controls.get(select);
  if (!eligible(select) || !win.HTMLElement.prototype.showPopover) return { sync() {}, close() {}, destroy() {} };
  const original = { id: select.id, tab: select.getAttribute('tabindex'), aria: select.getAttribute('aria-hidden') };
  if (!select.id) select.id = `bc-select-${++sequence}`;
  const trigger = doc.createElement('button'), value = doc.createElement('span'), arrow = doc.createElement('img');
  trigger.type = 'button'; trigger.id = `${select.id}-trigger`; value.id = `${select.id}-value`;
  arrow.src = new URL('../../img/source/alert-chevron-down.svg', import.meta.url).href;
  arrow.alt = ''; arrow.width = 20; arrow.height = 20; trigger.append(value, arrow);
  const labels = [...select.labels].map(label => {
    const name = label.contains(select) ? label.querySelector('span') || label : label;
    const oldId = name.id, oldFor = label.getAttribute('for');
    if (!name.id) name.id = `${select.id}-label-${++sequence}`;
    label.htmlFor = trigger.id; return { label, name, oldId, oldFor };
  });
  const panel = doc.createElement('div'); panel.id = `${select.id}-options`; panel.className = 'bc-select-options';
  panel.setAttribute('role', 'listbox'); panel.setAttribute('popover', 'manual'); panel.hidden = true;
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', panel.id);
  select.classList.add('bc-select-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); select.after(trigger);
  const dialog = select.closest('dialog'); (dialog || doc.body).append(panel);
  let open = false, active = -1, rows = [], signature = '', letters = '', typedAt = 0, error, destroyed = false;
  const options = () => [...select.options];
  const position = () => {
    const rect = trigger.getBoundingClientRect(), viewport = win.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || win.innerWidth), bottom = top + (viewport?.height || win.innerHeight);
    panel.style.width = `${Math.min(rect.width, right - left - 16)}px`;
    panel.style.left = `${Math.max(left + 8, Math.min(rect.left, right - rect.width - 8))}px`;
    panel.style.maxHeight = '320px';
    const desired = Math.min(320, panel.scrollHeight + 2), below = bottom - rect.bottom - 12, above = rect.top - top - 12;
    const upward = below < desired && above > below, height = Math.max(0, Math.min(320, upward ? above : below));
    panel.style.maxHeight = `${height}px`; panel.style.top = `${upward ? rect.top - 4 - Math.min(desired, height) : rect.bottom + 4}px`;
  };
  const highlight = index => {
    if (!enabled(select.options[index])) return;
    active = index; rows.forEach((row, i) => row.classList.toggle('active', i === active)); set(trigger, 'aria-activedescendant', rows[index]?.id);
    const row = rows[index]; if (!row) return;
    const start = row.offsetTop, end = start + row.offsetHeight;
    if (start < panel.scrollTop) panel.scrollTop = start;
    else if (end > panel.scrollTop + panel.clientHeight) panel.scrollTop = end - panel.clientHeight;
  };
  const close = () => {
    open = false; if (panel.matches(':popover-open')) panel.hidePopover(); panel.hidden = true;
    set(trigger, 'aria-expanded', 'false'); set(trigger, 'aria-activedescendant', null); letters = '';
    if (state.active === control) state.active = null;
  };
  const sync = () => {
    if (destroyed) return;
    trigger.className = `${[...select.classList].filter(c => c !== 'bc-select-native').join(' ')} bc-select`;
    trigger.disabled = select.matches(':disabled'); trigger.hidden = select.hidden; value.textContent = select.selectedOptions[0]?.label || '';
    const labelIds = select.getAttribute('aria-labelledby') || labels.map(item => item.name.id).join(' ');
    set(trigger, 'aria-labelledby', labelIds ? `${labelIds} ${value.id}` : null);
    set(trigger, 'aria-label', labelIds ? null : select.getAttribute('aria-label') || select.name.replaceAll('_', ' ') || 'Choose an option');
    set(panel, 'aria-labelledby', labelIds || trigger.id); set(trigger, 'aria-required', select.required ? 'true' : null);
    if (error && select.validity.valid) { error.remove(); error = null; }
    set(trigger, 'aria-invalid', error ? 'true' : select.getAttribute('aria-invalid'));
    set(trigger, 'aria-describedby', [select.getAttribute('aria-describedby'), error?.id].filter(Boolean).join(' ')); set(trigger, 'title', select.title || null);
    const list = options(), next = JSON.stringify(list.map(option => [option.label, option.value, option.disabled, option.hidden, option.parentElement?.label, option.parentElement?.disabled, option.parentElement?.hidden]));
    if (next !== signature) {
      signature = next; panel.replaceChildren(); let group;
      rows = list.map((option, index) => {
        const parent = option.parentElement;
        if (parent.tagName === 'OPTGROUP' && group !== parent) {
          const heading = doc.createElement('div'); heading.className = 'bc-select-group'; heading.textContent = parent.label; heading.setAttribute('role', 'presentation'); heading.hidden = parent.hidden; panel.append(heading); group = parent;
        }
        const row = doc.createElement('div'); row.id = `${select.id}-option-${index}`; row.setAttribute('role', 'option'); row.textContent = option.label;
        row.dataset.index = index; row.hidden = option.hidden || parent.hidden; set(row, 'aria-disabled', enabled(option) ? null : 'true'); panel.append(row); return row;
      });
    }
    rows.forEach((row, index) => set(row, 'aria-selected', String(index === select.selectedIndex)));
    if (open) {
      if (trigger.disabled || trigger.hidden || !select.isConnected || (dialog && !dialog.open)) close();
      else { position(); highlight(enabled(list[active]) ? active : list.findIndex(enabled)); }
    }
  };
  const expand = () => {
    sync(); if (open || trigger.disabled || !select.isConnected || (dialog && !dialog.open)) return;
    state.active?.close(); panel.hidden = false; panel.showPopover(); open = true; state.active = control;
    set(trigger, 'aria-expanded', 'true'); position(); highlight(enabled(select.options[select.selectedIndex]) ? select.selectedIndex : options().findIndex(enabled));
  };
  const choose = index => {
    if (!enabled(select.options[index]) || trigger.disabled) return;
    const before = select.value; select.selectedIndex = index; sync(); close(); trigger.focus();
    if (before !== select.value) { select.dispatchEvent(new win.Event('input', { bubbles: true })); select.dispatchEvent(new win.Event('change', { bubbles: true })); }
  };
  const click = () => open ? close() : expand();
  const keydown = event => {
    const { key } = event;
    if (key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); close(); } return; }
    if (key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault(); const wasOpen = open; expand();
      const list = options().map((option, i) => enabled(option) ? i : -1).filter(i => i >= 0), current = list.indexOf(active);
      highlight(key === 'Home' ? list[0] : key === 'End' ? list.at(-1) : wasOpen ? list[Math.max(0, Math.min(list.length - 1, current + (key === 'ArrowDown' ? 1 : -1)))] : active); return;
    }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); if (open) choose(active); else expand(); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); const now = Date.now(); letters = now - typedAt > 700 ? key.toLowerCase() : letters + key.toLowerCase(); typedAt = now; expand();
      const repeated = [...letters].every(letter => letter === letters[0]), query = repeated ? letters[0] : letters, list = options(), offset = repeated ? active + 1 : 0;
      for (let i = 0; i < list.length; i++) { const index = (i + offset) % list.length; if (enabled(list[index]) && list[index].label.toLowerCase().startsWith(query)) { highlight(index); break; } }
    }
  };
  const pointer = event => { const row = event.target.closest('[role=option]'); if (row) highlight(Number(row.dataset.index)); };
  // Options use aria-activedescendant; retain trigger focus before a modal can take it.
  const keepFocus = event => { if (event.target.closest('[role=option]')) event.preventDefault(); };
  const selectRow = event => { const row = event.target.closest('[role=option]'); if (row) choose(Number(row.dataset.index)); };
  const reset = () => queueMicrotask(() => { close(); sync(); });
  const invalid = event => {
    event.preventDefault();
    if (!error) { error = doc.createElement('small'); error.className = 'error-text bc-select-error'; error.id = `${select.id}-error`; error.setAttribute('role', 'alert'); trigger.after(error); }
    error.textContent = select.validationMessage; sync();
    if (!select.form || [...select.form.elements].find(field => field.willValidate && !field.validity.valid) === select) queueMicrotask(() => trigger.focus());
  };
  const nativeFocus = () => trigger.focus(), toggled = () => { if (open && !panel.matches(':popover-open')) close(); };
  // Per-instance accessors preserve programmatic assignments without synthetic changes.
  const accessors = ['value', 'selectedIndex'].filter(name => !Object.hasOwn(select, name));
  for (const name of accessors) {
    const descriptor = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, name);
    Object.defineProperty(select, name, { configurable: true, get() { return descriptor.get.call(this); }, set(next) { descriptor.set.call(this, next); sync(); } });
  }
  const form = select.form;
  trigger.addEventListener('click', click); trigger.addEventListener('keydown', keydown);
  panel.addEventListener('pointerdown', keepFocus); panel.addEventListener('pointermove', pointer); panel.addEventListener('click', selectRow); panel.addEventListener('toggle', toggled);
  select.addEventListener('change', sync); select.addEventListener('input', sync); select.addEventListener('invalid', invalid); select.addEventListener('focus', nativeFocus);
  form?.addEventListener('reset', reset); dialog?.addEventListener('close', close);
  const control = { select, trigger, panel, sync, close, destroy() {
    if (destroyed) return; close(); destroyed = true; state.controls.delete(select);
    trigger.removeEventListener('click', click); trigger.removeEventListener('keydown', keydown);
    panel.removeEventListener('pointerdown', keepFocus); panel.removeEventListener('pointermove', pointer); panel.removeEventListener('click', selectRow); panel.removeEventListener('toggle', toggled);
    select.removeEventListener('change', sync); select.removeEventListener('input', sync); select.removeEventListener('invalid', invalid); select.removeEventListener('focus', nativeFocus);
    form?.removeEventListener('reset', reset); dialog?.removeEventListener('close', close);
    for (const name of accessors) delete select[name];
    select.classList.remove('bc-select-native'); set(select, 'tabindex', original.tab); set(select, 'aria-hidden', original.aria);
    for (const item of labels) { set(item.label, 'for', item.oldFor); if (!item.oldId) item.name.removeAttribute('id'); }
    if (!original.id) select.removeAttribute('id'); trigger.remove(); panel.remove(); error?.remove();
  } };
  state.controls.set(select, control); sync(); return control;
}

export function installSelects(doc = document) {
  const state = stateFor(doc), win = doc.defaultView;
  if (state.installed) return; state.installed = true;
  const scan = root => { if (root.nodeType !== 1) return; if (eligible(root)) mountSelect(root); root.querySelectorAll('select').forEach(select => { if (eligible(select)) mountSelect(select); }); };
  const observer = new win.MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) scan(node);
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement, select = target?.closest('select');
      if (select) state.controls.get(select)?.sync();
      if (target?.tagName === 'FIELDSET') target.querySelectorAll('select').forEach(field => state.controls.get(field)?.sync());
    }
    let restore;
    for (const [select, control] of state.controls) if (!select.isConnected || !eligible(select)) { if (state.focused === control.trigger) restore = control.trigger.id; control.destroy(); }
    if (restore && doc.activeElement === doc.body) doc.getElementById(restore)?.focus();
  });
  const outside = event => { const control = state.active; if (control && !control.trigger.contains(event.target) && !control.panel.contains(event.target)) control.close(); };
  const focus = event => { state.focused = event.target; outside(event); };
  const resize = () => state.active?.close(), scroll = event => { const control = state.active; if (control && !control.panel.contains(event.target)) control.close(); };
  const start = () => { scan(doc.documentElement); observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'required', 'label', 'value', 'selected', 'multiple', 'size', 'class', 'title', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid'] }); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  doc.addEventListener('pointerdown', outside); doc.addEventListener('focusin', focus);
  win.addEventListener('resize', resize); win.addEventListener('scroll', scroll, true);
  win.visualViewport?.addEventListener('resize', resize); win.visualViewport?.addEventListener('scroll', resize);
  win.addEventListener('pagehide', () => state.active?.close());
}
