export type InboundMessage = {
  channel: string
  externalAccountId: string
  participantExternalId: string
  displayName: string | null
  providerMessageId: string
  providerTimestamp: string
  contentText: string
  payload?: Record<string, unknown>
  workspaceId: string
  tenantId: string | null
  contactGuestId: string | null
}

export type OutboundMessage = {
  channel: string
  externalAccountId: string
  participantExternalId: string
  contentText: string
  authorType: 'ai' | 'human'
  providerMessageId: string
  providerTimestamp: string
  status: string
  workspaceId: string
  tenantId: string | null
  contactGuestId: string | null
}
