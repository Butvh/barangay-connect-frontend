import { ApiError } from './config.js';
import { validateResetPassword } from './account-security.js';

const fail = (code, message, fields) => { throw new ApiError(code, message, fields); };
const duration = (value, max) => Number.isInteger(value) && value > 0 && value <= max;
const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;

// Transient state only. The server owns code generation/delivery, attempts and authorization.
export function createPasswordRecovery({ transport = null, now = Date.now } = {}) {
  let stage='request',email='',portal='',challenge='',authorization='',expiresAt=0,retryAt=0,epoch=0,busy=false;
  const available=['requestCode','verifyCode','resetPassword'].every(key=>typeof transport?.[key]==='function');
  const state=()=>({stage,retry_in:Math.max(0,Math.ceil((retryAt-now())/1000))});
  function clear(){epoch++;stage='request';email=portal=challenge=authorization='';expiresAt=retryAt=0;busy=false;}
  async function invoke(method,payload){
    const current=epoch;
    if(!available)fail('NOT_AVAILABLE','Password recovery requires a secure account server.');
    const result=await transport[method](payload);
    if(current!==epoch)fail('CANCELLED','Recovery was closed.');
    return result;
  }
  async function run(action){
    if(busy)fail('BUSY','A recovery request is already in progress.');
    const current=epoch;busy=true;
    try{return await action();}finally{if(current===epoch)busy=false;}
  }
  async function request(input){
    const current=epoch;
    const address=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
    if(!address||address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))fail('VALIDATION','Enter a valid email address.',{email:'Enter a valid email address.'});
    if(!['resident','official'].includes(input?.portal))fail('VALIDATION','Choose a valid sign-in page.');
    const result=await invoke('requestCode',{email:address,portal:input.portal});
    if(current!==epoch)fail('CANCELLED','Recovery was closed.');
    if(result?.accepted!==true||!opaque(result.challenge_id)||!duration(result.expires_in,600)||!duration(result.retry_after,86400))fail('SERVER','The server did not confirm the recovery request.');
    email=address;portal=input.portal;challenge=result.challenge_id;authorization='';stage='verify';expiresAt=now()+result.expires_in*1000;retryAt=now()+Math.max(60,result.retry_after)*1000;
    return state();
  }
  return Object.freeze({
    available,state,clear,
    requestCode(input){return run(()=>{if(stage!=='request')fail('RECOVERY_STATE','Start a new recovery request.');return request(input);});},
    resendCode(){return run(()=>{if(stage!=='verify')fail('RECOVERY_STATE','Request a code first.');if(now()<retryAt)fail('COOLDOWN','Wait before requesting another code.');return request({email,portal});});},
    verifyCode(code){return run(async()=>{
      const current=epoch;
      if(stage!=='verify')fail('RECOVERY_STATE','Request a code first.');
      if(now()>=expiresAt)fail('CODE_EXPIRED','This code has expired. Request another code.');
      if(typeof code!=='string'||!/^\d{6}$/.test(code))fail('VALIDATION','Enter the six-digit code.',{code:'Enter the six-digit code.'});
      const result=await invoke('verifyCode',{challenge_id:challenge,code});
      if(current!==epoch)fail('CANCELLED','Recovery was closed.');
      if(result?.verified!==true||!opaque(result.reset_authorization)||!duration(result.expires_in,600))fail('SERVER','The server did not confirm code verification.');
      authorization=result.reset_authorization;challenge='';expiresAt=now()+result.expires_in*1000;retryAt=0;stage='reset';return state();
    });},
    resetPassword(input){return run(async()=>{
      const current=epoch;
      if(stage!=='reset')fail('RECOVERY_STATE','Verify your code first.');
      if(now()>=expiresAt)fail('AUTHORIZATION_EXPIRED','Recovery has expired. Start again from sign in.');
      const payload=validateResetPassword(input);
      const result=await invoke('resetPassword',{reset_authorization:authorization,...payload});
      if(current!==epoch)fail('CANCELLED','Recovery was closed.');
      if(result?.password_reset!==true)fail('SERVER','The server did not confirm a password reset.');
      clear();return {password_reset:true};
    });},
  });
}
