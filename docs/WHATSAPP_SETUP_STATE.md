# Estado: Setup WhatsApp/Meta — PAUSADO (10 jun 2026)

## Por que esta pausado
Depende de la Business Verification de Meta, que espera al alta de actividad en el SAT (~fin de mes). Retomar SOLO cuando el SAT este listo y haya Constancia de Situacion Fiscal actualizada.

## Ya hecho
- Meta App "Anfiora" (Business) + producto WhatsApp agregado.
- Numero de prueba + WABA de prueba creados (dev mode).
- Config Embedded Signup creada via plantilla "registro insertado, token 60 dias":
  - META_CONFIG_ID = 981260651354302
  - Variacion: Registro insertado de WhatsApp | Token: usuario del sistema (60 dias)
  - Activos: Cuentas de WhatsApp | Permisos: whatsapp_business_management + whatsapp_business_messaging
- IDs de prueba: Phone Number ID 1104668042737625 | WABA prueba 757044670799491
- App ID y App Secret ya guardados en .env (el secret NO va en este doc).
- 2FA activado en portfolio "Anfiora saas eventos" (passkey + Authy).

## Pendiente (en orden, al retomar)
1. Constancia de Situacion Fiscal actualizada (post alta SAT).
2. Business Verification en Meta (Centro de seguridad / Paso 3 del caso de uso WhatsApp). Datos EXACTOS como en la constancia.
3. Twilio Tech Provider Program (ISV): ya NO es ticket, se arranca en la Twilio Console (quiz que enruta a ISV). Requiere business verification hecha.
4. Self Sign-up del sender propio de Anfiora en Twilio (numero real).
5. Aceptar Partner Solution (Twilio linkea la Meta app).
6. App Review + Access Verification (Track 1, paralelo; necesita privacy policy URL + data deletion URL en la app).
7. Codigo Fase 3 (transport.ts), bloqueado hasta confirmar con Twilio:
   a. envio con sender registrado: Messages.json o Messaging Service?
   b. Senders API exacta para registrar numero del planner + sender SID de vuelta.
   c. como se autentica el envio a nombre del subaccount.

## Env vars Fase 3
META_APP_ID, META_APP_SECRET, META_CONFIG_ID=981260651354302, META_GRAPH_VERSION (revisar version actual del Graph API), TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN. subaccount_sid de cada planner -> columna wa_subaccount_sid.
