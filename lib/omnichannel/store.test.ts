import { describe, it, expect } from 'vitest'
import { conversationRelinkPatch } from './store'

describe('conversationRelinkPatch', () => {
  it('conversacion sin invitado + start con guest: re-liga con guest/tenant/workspace nuevos', () => {
    const patch = conversationRelinkPatch(
      { contact_guest_id: null, tenant_id: 'evento-viejo', workspace_id: 'ws1' },
      { contactGuestId: 'guest-nuevo', tenantId: 'evento-nuevo', workspaceId: 'ws1' },
    )
    expect(patch).toEqual({ contact_guest_id: 'guest-nuevo', tenant_id: 'evento-nuevo', workspace_id: 'ws1' })
  })

  it('ya ligada al mismo invitado/evento/workspace: no hay nada que actualizar', () => {
    const patch = conversationRelinkPatch(
      { contact_guest_id: 'g1', tenant_id: 'e1', workspace_id: 'ws1' },
      { contactGuestId: 'g1', tenantId: 'e1', workspaceId: 'ws1' },
    )
    expect(patch).toBeNull()
  })

  it('sin guest entrante (mensaje normal): nunca desliga', () => {
    const patch = conversationRelinkPatch(
      { contact_guest_id: 'g1', tenant_id: 'e1', workspace_id: 'ws1' },
      { contactGuestId: null, tenantId: 'e1', workspaceId: 'ws1' },
    )
    expect(patch).toBeNull()
  })

  it('ligada a otro invitado: el deep-link mas reciente gana', () => {
    const patch = conversationRelinkPatch(
      { contact_guest_id: 'g-viejo', tenant_id: 'e1', workspace_id: 'ws1' },
      { contactGuestId: 'g-nuevo', tenantId: 'e2', workspaceId: 'ws2' },
    )
    expect(patch).toEqual({ contact_guest_id: 'g-nuevo', tenant_id: 'e2', workspace_id: 'ws2' })
  })
})
