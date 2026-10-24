// Preserve the existing select's options, value and change event while anchoring its list.
export function mountAlertSelect(select) {
  const label = document.querySelector(`label[for="${select.id}"]`);
  label.id = `${select.id}-label`;
  const trigger = document.createElement('button'), value = document.createElement('span'), arrow = document.createElement('img');
  trigger.type = 'button'; trigger.className = 'alert-select'; trigger.id = `${select.id}-trigger`; value.id = `${select.id}-value`;
  arrow.src = 'assets/img/source/alert-chevron-down.svg'; arrow.alt = ''; arrow.width = 20; arrow.height = 20; trigger.append(value, arrow);
  const panel = document.createElement('div'); panel.id = `${select.id}-options`; panel.className = 'alert-options';
  panel.setAttribute('role', 'listbox'); panel.setAttribute('aria-labelledby', label.id); panel.setAttribute('popover', 'manual'); panel.hidden = true;
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-labelledby', `${label.id} ${value.id}`);
  const options = [...select.options].map((option, index) => {
    const row = document.createElement('div'); row.id = `${select.id}-option-${index}`; row.setAttribute('role', 'option'); row.textContent = option.text; panel.append(row); return row;
  });
  select.hidden = true; select.after(trigger); document.body.append(panel);
  let open = false, active = 0, letters = '', typedAt = 0;
  const sync = () => { value.textContent = select.selectedOptions[0]?.text || ''; options.forEach((row, i) => row.setAttribute('aria-selected', String(i === select.selectedIndex))); };
  const highlight = index => {
    active = Math.max(0, Math.min(options.length - 1, index)); options.forEach((row, i) => row.classList.toggle('active', i === active));
    trigger.setAttribute('aria-activedescendant', options[active].id); options[active].scrollIntoView({ block: 'nearest' });
  };
  const close = () => {
    if (!open) return; open = false;
    if (panel.matches(':popover-open')) panel.hidePopover(); panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); letters = '';
  };
  const expand = () => {
    if (open) return;
    if (innerHeight - trigger.getBoundingClientRect().bottom < 100) trigger.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = trigger.getBoundingClientRect();
    panel.style.left = `${rect.left}px`; panel.style.top = `${rect.bottom + 4}px`; panel.style.width = `${rect.width}px`;
    panel.style.maxHeight = `${Math.max(44, Math.min(320, innerHeight - rect.bottom - 12))}px`;
    panel.hidden = false; if (panel.showPopover) panel.showPopover(); open = true;
    trigger.setAttribute('aria-expanded', 'true'); highlight(select.selectedIndex < 0 ? 0 : select.selectedIndex);
  };
  const choose = index => { select.selectedIndex = index; sync(); close(); trigger.focus(); select.dispatchEvent(new Event('change', { bubbles: true })); };
  trigger.addEventListener('click', () => open ? close() : expand());
  trigger.addEventListener('keydown', event => {
    const { key } = event;
    if (key === 'Escape') { if (open) { event.preventDefault(); close(); } return; }
    if (key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault(); const wasOpen = open; expand();
      highlight(key === 'Home' ? 0 : key === 'End' ? options.length - 1 : wasOpen ? active + (key === 'ArrowDown' ? 1 : -1) : active); return;
    }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); if (open) choose(active); else expand(); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); const now = Date.now(); letters = now - typedAt > 700 ? key.toLowerCase() : letters + key.toLowerCase(); typedAt = now; expand();
      const index = options.findIndex(row => row.textContent.toLowerCase().startsWith(letters)); if (index >= 0) highlight(index);
    }
  });
  options.forEach((row, i) => { row.addEventListener('pointermove', () => highlight(i)); row.addEventListener('click', () => choose(i)); });
  const outside = event => { if (!trigger.contains(event.target) && !panel.contains(event.target)) close(); };
  const scroll = event => {
    if (open && !panel.contains(event.target) && Math.abs(trigger.getBoundingClientRect().bottom + 4 - parseFloat(panel.style.top)) > 1) close();
  };
  const reset = () => queueMicrotask(sync);
  document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside);
  window.addEventListener('resize', close); window.addEventListener('scroll', scroll, true);
  select.addEventListener('change', sync); select.form?.addEventListener('reset', reset); sync();
  return { sync, close, destroy() { close(); document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', scroll, true); select.removeEventListener('change', sync); select.form?.removeEventListener('reset', reset); trigger.remove(); panel.remove(); select.hidden = false; } };
}
