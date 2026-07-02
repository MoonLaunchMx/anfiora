# Comportamiento del agente de Anfiora (Telegram)

Referencia unica de "que dice el invitado -> que hace el agente". Todo pasa por el guardia determinista (`lib/agent/apply.ts`): la IA propone, el codigo valida contra la lista real y aplica o marca.

## Asistencia del titular

| El invitado dice | El agente |
|---|---|
| "si voy", "ahi estare" | Confirma al titular (rsvp_status = confirmed) |
| "no voy a poder", "siempre no voy" | Declina al titular (rsvp_status = declined) |
| No menciona su asistencia | No toca la asistencia |

## Acompanantes

| El invitado dice | El agente |
|---|---|
| "vamos todos", "confirmamos todos" | Confirma a TODOS los acompanantes registrados |
| "solo voy yo" | Confirma al titular; los acompanantes quedan pending |
| "voy con Ana" (Ana registrada) | Confirma a Ana |
| "voy con mi primo Luis" (Luis NO registrado) | No crea a Luis; levanta bandera (peticion) |
| "mi esposa Olivia no va" (Olivia registrada) | Declina a Olivia (rsvp_status = declined) |
| "solo va mi hijo" (no nombra a los demas) | Confirma al hijo; NO declina a los demas; levanta bandera (duda) |
| "vamos 2 de 3" (no dice quienes) | No toca acompanantes; levanta bandera (peticion) |

## Alergias

| El invitado dice | El agente |
|---|---|
| "soy alergico a mariscos" | Guarda mariscos en el titular + bandera (alergia) |
| "Ana es vegana" (Ana registrada) | Guarda en la ficha de Ana + bandera |
| "mi esposa es alergica" (sin nombre / no mapeable) | No escribe; levanta bandera (alergia) |
| "no es nueces, es gluten" / "quita esa alergia" / "el de las nueces es mi hijo" | NO cambia alergias (nunca auto-borra); levanta bandera (alergia) para revision humana |

## Otros

| Situacion | El agente |
|---|---|
| Queja ("la organizacion es pesima") | Escala a humano (mensaje de espera) + bandera (queja) |
| Mensaje ambiguo / ininteligible (baja confianza) | No escribe nada; levanta bandera (duda) |
| IA apagada en la conversacion (handoff) | El agente se calla; responde el humano |

## Principios

- **La IA propone, el codigo dispone.** Ninguna escritura al corazon pasa sin el guardia determinista.
- **No adivina.** Nombres se validan contra la lista real; lo ambiguo se marca, no se inventa.
- **Seguridad primero.** Las alergias nunca se auto-borran; toda correccion es bandera humana.
- **Honestidad.** El agente solo afirma acciones que realmente ejecuto.

## Fuera de alcance (por ahora)

- WhatsApp (Fase 4). Panel de configuracion del agente (Fase 3).
- Inferir "mi esposa" -> acompanante especifico sin nombre (casi-humano futuro).
- Editar/borrar alergias por el agente (por diseno: siempre revision humana).
