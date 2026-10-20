const valid = value => { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date : null; };
const dateFormat = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'});
const shortDate = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'Asia/Manila'});
const timeFormat = new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'});
export const Fmt = {
date(iso){const d=valid(iso);return d?dateFormat.format(d):'—';},
dateTime(iso){const d=valid(iso);return d?dateFormat.format(d)+' · '+timeFormat.format(d):'—';},
short(iso){const d=valid(iso);return d?shortDate.format(d)+' · '+timeFormat.format(d):'—';},
alertId(n){return 'A-'+String(n);},
countdown(iso){const d=valid(iso);if(!d)return '—';const days=Math.ceil((d.getTime()-Date.now())/86400000);return days>0?days+' day'+(days===1?'':'s')+' remaining':'Expired';},
initials(name){const parts=String(name??'').trim().split(/\s+/u).filter(Boolean);return parts.length?Array.from(parts[0])[0].toLocaleUpperCase()+(parts.length>1?Array.from(parts.at(-1))[0].toLocaleUpperCase():''):'?';}
};

