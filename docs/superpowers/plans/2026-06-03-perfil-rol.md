# Perfil: acceso desde dashboard + tipo de perfil (rol) — Plan

**Goal:** Acceder a `/perfil` desde el dashboard (avatar clickeable) y mostrar/editar el tipo de perfil (planner/anfitrion) como badge a la derecha de una franja de identidad en `/perfil`.

**Branch:** `feature/perfil-rol` (desde main). Sin SQL nuevo (`users.role` ya existe). Verificacion: `npm run lint` + `npm run build` + manual. Commits convencionales, sin acentos en subject, co-author Claude Opus 4.8.

**Decision de UX (aprobada):** dashboard = solo avatar clickeable. Perfil = ampliar el contenedor + franja de identidad arriba con avatar+nombre+correo a la izquierda y el badge de rol a la derecha, clickeable para cambiar.

## File Structure
- Create `lib/roles.ts` — catalogo unico de roles (value, shortLabel, label, description, icon) + `getRole()`. Reusado por OnboardingModal y /perfil.
- Modify `app/components/OnboardingModal.tsx` — usar ROLES (salida identica).
- Modify `app/perfil/page.tsx` — ampliar contenedor, franja de identidad con badge de rol editable, fetch + save de `role`.
- Modify `app/dashboard/page.tsx` — avatar clickeable -> /perfil (visible tambien en movil).

## Task 1: lib/roles.ts + refactor OnboardingModal (DRY, salida identica)
- [ ] Crear `lib/roles.ts` con `Role`, `RoleConfig`, `ROLES` (planner: Briefcase, "Planner / Organizador profesional", "Organizo eventos para mis clientes."; anfitrion: PartyPopper, "Anfitrion", "Organizo mi propio evento (boda, XV, fiesta...)."), `shortLabel` ('Planner'/'Anfitrion'), y `getRole(value)`. Incluir `import type React from 'react'`.
- [ ] En OnboardingModal: importar `ROLES` y el tipo `Role` de `@/lib/roles`; quitar el `type Role` local y los imports `Briefcase, PartyPopper` (vienen del catalogo); renderizar las 2 cards mapeando `ROLES.map(...)` con el MISMO markup/clases actuales. Salida visual identica.
- [ ] `npm run lint && npm run build` -> PASS. Commit.

## Task 2: /perfil — franja de identidad + badge de rol editable
- [ ] Ampliar contenedor: header `max-w-2xl` -> `max-w-3xl` (linea ~208) y main `max-w-2xl` -> `max-w-3xl` (linea ~222).
- [ ] Extender el `select('full_name, phone, plan')` a incluir `role`; agregar estado `role`, `editingRole`, `savingRole`, y un toast de rol.
- [ ] Agregar franja de identidad (section) como PRIMER hijo del contenedor de tarjetas (antes de "Plan actual"): izquierda avatar (inicial de nombre o correo) + nombre + correo; derecha el badge de rol (icono + shortLabel via `getRole(role)`), clickeable para abrir un mini-selector con las 2 opciones de `ROLES`. Al elegir: `update users set role`, actualizar estado, toast, cerrar. Si `role` es null -> badge "Sin definir".
- [ ] `npm run lint && npm run build` -> PASS. Commit.

## Task 3: Dashboard — avatar clickeable a /perfil
- [ ] En el header (entre la campana y "Salir"), envolver un avatar (circulo con inicial de `userEmail`) + el span del email en un boton que navega a `/perfil`. Avatar SIEMPRE visible (tambien movil); el texto del email sigue `hidden sm:block`. "Salir" intacto.
- [ ] `npm run lint && npm run build` -> PASS. Commit.

## Verificacion final (manual)
- [ ] Dashboard: clic en avatar -> /perfil (movil y desktop).
- [ ] /perfil: la franja muestra el badge correcto (Planner/Anfitrion); cambiar el rol persiste (verificar en Supabase) y el badge se actualiza; recargar mantiene el cambio.
- [ ] OnboardingModal sigue identico para un usuario sin rol.
