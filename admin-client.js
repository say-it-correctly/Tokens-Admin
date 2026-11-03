(()=>{'use strict';
 const config=window.SIC_CONFIG||{};
 const ADMIN_EMAIL='say.it.correctly.github@gmail.com',ADMIN_ID='ea79aaaa-5bb7-4477-bda7-1676db533693',PANEL_RETURN='https://say-it-correctly.github.io/Tokens-Admin/';
 const callback=(()=>{const fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);const attempt=fragment.has('access_token')||fragment.has('error')||fragment.has('error_code')||query.has('code')||query.has('error');const accessToken=fragment.get('access_token')||'';if(location.hash||location.search)history.replaceState(null,'',location.pathname);return {attempt,accessToken};})();
 const errors={commerce_disabled:'Comercio desactivado.',privacy_not_ready:'Privacidad pendiente de aprobación.',identity_required:'Verifica tu identidad administrativa.',forbidden:'No tienes autorización administrativa.',student_identity_required:'El estudiante debe verificar primero su correo.',student_identity_mismatch:'La identidad verificada no coincide con el correo.',payment_already_consumed:'El pago ya tiene un token o permiso.',payment_reference_used:'La referencia del pago ya fue registrada.',capacity_exhausted:'Se alcanzó el límite de 50 activaciones.'};
 const client=window.SICCommerce={bearer:null,enabled:false,error:e=>errors[e?.code]||'Servicio temporalmente no disponible. Inténtalo de nuevo.'};
 const validURL=value=>{try{const u=new URL(value);return !u.username&&!u.password&&!u.search&&!u.hash&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))}catch{return false}};
 const safe=!!(config.adminReadEnabled===true&&config.privacyApproved===true&&validURL(config.apiBase)&&validURL(config.supabaseUrl)&&validURL(config.privacyUrl)&&config.publishableKey);
 function requireOperations(path='',body){const read=path===''||(!body&&['/admin/capacity','/admin/requests','/admin/inventory'].includes(path));const code=config.privacyApproved!==true?'privacy_not_ready':!safe||!client.enabled?'practice_not_ready':!read&&config.enabled!==true?'commerce_disabled':null;if(code)throw Object.assign(Error(code),{code});}
 client.api=async(path,body,{key}={})=>{requireOperations(path,body);if(!client.bearer)throw Object.assign(Error('identity_required'),{code:'identity_required'});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(config.apiBase+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),authorization:'Bearer '+client.bearer,...(key?{'idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'unavailable'),{code:result.error});return result;}finally{clearTimeout(timer)}};
 client.healthState=validURL(config.apiBase)?'checking':'configuration';
 client.statusText=()=>[({checking:'Comprobando conectividad del servicio.',ready:'Servicio accesible; /health informa ready.',unavailable:'Servicio no disponible o no verificable.',configuration:'URL del servicio no configurada correctamente.'})[client.healthState],config.enabled!==true?'Comercio desactivado.':'',config.privacyApproved!==true?'Privacidad pendiente de aprobación.':'','La conectividad no acredita autenticación ni permisos administrativos.'].filter(Boolean).join(' ');
 client.health=validURL(config.apiBase)?(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(config.apiBase+'/health',{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});const health=await response.json();client.healthState=response.ok&&health?.ready===true?'ready':'unavailable';}catch{client.healthState='unavailable';}finally{clearTimeout(timer)}return client.healthState==='ready';})():Promise.resolve(false);
 client.ready=client.health.then(healthy=>{client.enabled=safe&&healthy;return client.enabled;});
 const widgetScript='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 let turnstileLoading=null;
 const captchaAttempts=new WeakMap();
 function loadTurnstile(){
  if(window.turnstile?.ready&&window.turnstile?.render)return Promise.resolve(window.turnstile);
  if(turnstileLoading)return turnstileLoading;
  const loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');let done=false;
   const finish=error=>{if(done)return;done=true;clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error)}else resolve(window.turnstile)};
   const timer=setTimeout(()=>finish(Error('captcha_load_timeout')),15000);
   script.src=widgetScript;script.async=true;script.defer=true;
   script.onload=()=>finish(window.turnstile?.ready&&window.turnstile?.render?null:Error('captcha_unavailable'));
   script.onerror=()=>finish(Error('captcha_load_failed'));document.head.append(script);
  });
  turnstileLoading=loading.catch(error=>{turnstileLoading=null;throw error});return turnstileLoading;
 }
 function removeWidget(container,sdk,id=container.dataset.sicWidget){if(id!==undefined){try{sdk?.remove(id)}catch{}}delete container.dataset.sicWidget;}
 client.captcha=async container=>{
  if(!safe||!await client.ready||!client.enabled)throw Object.assign(Error('practice_not_ready'),{code:'practice_not_ready'});
  if(typeof config.turnstileSiteKey!=='string'||!config.turnstileSiteKey.trim())throw Error('captcha_configuration_required');
  if(!container?.isConnected)throw Error('captcha_cancelled');
  captchaAttempts.get(container)?.cancel();
  return new Promise((resolve,reject)=>{
   let done=false,failed=false,sdk,id;
   const finish=(error,token)=>{if(done)return;done=true;failed=!!error;clearTimeout(timer);if(captchaAttempts.get(container)===attempt)captchaAttempts.delete(container);if(error){removeWidget(container,sdk,id);reject(error)}else resolve(token)};
   const attempt={cancel:()=>finish(Error('captcha_cancelled'))};captchaAttempts.set(container,attempt);
   const timer=setTimeout(()=>finish(Error('captcha_timeout')),120000);
   loadTurnstile().then(api=>{if(done)return;sdk=api;
    if(!container.isConnected)return finish(Error('captcha_cancelled'));
    // The load event guarantees the explicit-render API is available. Do not
    // call turnstile.ready() for an async/defer script: the SDK rejects it.
    try{removeWidget(container,sdk);container.replaceChildren();
     id=sdk.render(container,{sitekey:config.turnstileSiteKey.trim(),size:container.getBoundingClientRect().width<300?'compact':'flexible',
      callback:token=>{if(!container.isConnected)return finish(Error('captcha_cancelled'));if(typeof token!=='string'||!token.trim()||token.length>2048)return finish(Error('captcha_invalid_response'));finish(null,token)},
      'error-callback':code=>finish(Object.assign(Error('captcha_failed'),{code:'captcha_failed',providerCode:/^\d{6}$/.test(String(code))?String(code):null,stage:'provider'})),'expired-callback':()=>finish(Error('captcha_expired')),'timeout-callback':()=>finish(Error('captcha_timeout'))});
     if(done&&failed)removeWidget(container,sdk,id);else container.dataset.sicWidget=String(id);
    }catch(error){finish(Object.assign(Error('captcha_failed'),{code:'captcha_failed',stage:'render',providerCause:/sitekey/i.test(error.message)?'sitekey':/size/i.test(error.message)?'widget_size':/container/i.test(error.message)?'widget_container':'widget_render'}))}
   }).catch(()=>finish(Error('captcha_unavailable')));
  });
 };
 async function auth(path,body){await client.ready;requireOperations();if(!validURL(config.supabaseUrl)||!config.publishableKey)throw Error('identity_configuration_required');const r=await fetch(config.supabaseUrl+'/auth/v1/'+path,{method:'POST',headers:{apikey:config.publishableKey,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('identity_failed');return r.json();}
client.auth=auth;
 client.requestMagicLink=async(email,captchaToken)=>{await client.ready;requireOperations();if(String(email).trim().toLowerCase()!==ADMIN_EMAIL)throw Object.assign(Error('forbidden'),{code:'forbidden'});if(config.authReturnUrl!==PANEL_RETURN)throw Error('identity_configuration_required');if(typeof captchaToken!=='string'||!captchaToken.trim())throw Error('captcha_required');return auth('otp?redirect_to='+encodeURIComponent(PANEL_RETURN),{email:ADMIN_EMAIL,create_user:false,gotrue_meta_security:{captcha_token:captchaToken}});};
 client.completeMagicLink=async()=>{if(!callback.attempt)return false;callback.attempt=false;let bearer=callback.accessToken;callback.accessToken='';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{await client.ready;requireOperations();if(!bearer||config.authReturnUrl!==PANEL_RETURN)throw Error('identity_failed');const response=await fetch(config.supabaseUrl+'/auth/v1/user',{method:'GET',headers:{apikey:config.publishableKey,authorization:'Bearer '+bearer},credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('identity_failed');const user=await response.json();if(user.id!==ADMIN_ID||String(user.email||'').toLowerCase()!==ADMIN_EMAIL||!user.email_confirmed_at||user.is_anonymous)throw Object.assign(Error('forbidden'),{code:'forbidden'});client.bearer=bearer;const capacity=await client.api('/admin/capacity');if(!Number.isInteger(capacity.used)||capacity.used<0||capacity.used>50)throw Error('invalid_admin_response');return true;}
  catch(error){client.bearer=null;throw error;}finally{bearer='';clearTimeout(timer);}
 };
})();
