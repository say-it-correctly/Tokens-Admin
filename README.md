# Tokens Admin — Say It Correctly

Frontend independiente para `https://github.com/say-it-correctly/Tokens-Admin.git`, sin backend, cuentas o contador propios. Servir estos archivos estáticos desde la raíz del sitio o desde `/Tokens-Admin/`; todas las dependencias locales usan rutas relativas.

Configurar únicamente valores públicos en `config.js`. La URL de Supabase y su clave publicable están preparadas; `enabled:false` y `privacyApproved:false` se conservan. Los valores públicos de CAPTCHA y del aviso de privacidad se reutilizan del repositorio educativo; falta confirmar su validez y aprobación para producción. Nunca incluir claves `service_role`, secretos ni contraseñas.

El correo precargado solo facilita el ingreso. El servidor verifica identidad/sesión/rol y exige el UUID administrativo autorizado para cada ruta `/admin/*`. La sesión del navegador se mantiene en memoria. La confirmación del pago es manual; generar un token no consume cupo ni inicia el plazo. El canje exitoso crea exactamente una activación de siete días.

La publicación y la configuración de hosting/CORS/CAPTCHA requieren aprobación independiente. Este repositorio vacío todavía no contiene estos archivos remotos. No subir `.tokens-work/`, backend ni material de QA.
