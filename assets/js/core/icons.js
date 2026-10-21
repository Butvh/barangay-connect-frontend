const names = new Set(['house','map','map-pin','bell','phone','message-square','message-circle','triangle-alert','circle-check','clock','school','hospital','building-2','life-buoy','megaphone','shield-check','siren','cloud-rain','upload','arrow-right','file-text','lightbulb','check','chevron-right','chevron-left','chevron-down','x','plus','minus','user','users','calendar','search','trash-2','log-out','lock','loader-circle','star','package','info','eye','eye-off','flame','waves','mountain','activity','camera','menu','layout-dashboard','clipboard-check']);
const disasterIcons = new Map([
  ['Fire', 'flame'], ['Flood', 'waves'], ['Typhoon/Storm', 'cloud-rain'],
  ['Landslide', 'mountain'], ['Earthquake', 'triangle-alert'], ['Other', 'triangle-alert'],
]);
export const Icons={
  disaster(type){return disasterIcons.get(type)||'triangle-alert';},
  svg(name,{size=24}={}){const safe=names.has(name)?name:'info';const n=[16,18,20,24,28,32,36,40,48,56,64].includes(Number(size))?Number(size):24;return '<svg class="icon" width="'+n+'" height="'+n+'" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#'+safe+'"></use></svg>';}
};

