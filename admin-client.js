(()=>{'use strict';
 const config=window.SIC_CONFIG||{};
 const errors={forbidden:'No tienes autorización administrativa.',student_identity_required:'El estudiante debe verificar primero su correo.',student_identity_mismatch:'La identidad verificada no coincide con el correo.',payment_already_consumed:'El pago ya tiene un token o permiso.',payment_reference_used:'La referencia del pago ya fue registrada.',capacity_exhausted:'Se alcanzó el límite de 50 activaciones.'};
 const client=window.SICCommerce={bearer:null,enabled:false,error:e=>errors[e?.code]||'Servicio temporalmente no disponible. Inténtalo de nuevo.'};
 const validURL=value=>{try{const u=new URL(value);return !u.username&&!u.password&&!u.search&&!u.hash&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))}catch{return false}};
 const safe=!!(config.enabled&&config.privacyApproved&&validURL(config.apiBase)&&validURL(config.supabaseUrl)&&validURL(config.privacyUrl)&&config.publishableKey);
 client.api=async(path,body,{key}={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(config.apiBase+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(client.bearer?{authorization:'Bearer '+client.bearer}:{}),...(key?{'idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'unavailable'),{code:result.error});return result;}finally{clearTimeout(timer)}};
 client.ready=safe?(async()=>{try{const health=await client.api('/health');client.enabled=health.ready===true;return client.enabled}catch{return false}})():Promise.resolve(false);
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
 async function auth(path,body){if(!validURL(config.supabaseUrl)||!config.publishableKey)throw Error('identity_configuration_required');const r=await fetch(config.supabaseUrl+'/auth/v1/'+path,{method:'POST',headers:{apikey:config.publishableKey,'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('identity_failed');return r.json();}
client.auth=auth;
})();
