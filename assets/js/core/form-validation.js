// App-owned feedback over native constraint metadata; never invokes browser bubbles.
export function invalidFormFields(form) {
  const fields = {};
  for (const control of Array.from(form.elements || [])) {
    if (!control.name || control.disabled || control.willValidate === false || !control.validity || control.validity.valid) continue;
    fields[control.name] = control.validity.valueMissing ? 'This field is required.' : control.type === 'email' ? 'Enter a valid email address.' : 'Check this field and its allowed format.';
  }
  return fields;
}

export function showFormFieldErrors(form, fields) {
  let first;
  for (const [name, message] of Object.entries(fields)) {
    const control = form.elements.namedItem?.(name) || form.elements[name];
    if (!control?.setAttribute || !control.id) continue;
    control.setAttribute('aria-invalid', 'true');
    let help = form.querySelector('#' + control.id + '-error');
    if (!help) {
      help = form.ownerDocument.createElement('small');
      help.id = control.id + '-error'; help.className = 'error-text'; control.closest('.field')?.append(help);
    }
    help.textContent = message;
    const references = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    references.add(help.id); control.setAttribute('aria-describedby', [...references].join(' '));
    first ||= control;
  }
  first?.focus();
}
