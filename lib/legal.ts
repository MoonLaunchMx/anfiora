// Una sola version cubre Terminos + Aviso de Privacidad.
// Subir CURRENT_LEGAL_VERSION re-dispara el gate de consentimiento para todos.
// La 1.1 ya la tomo feature/paywall-monetization, por eso esta tanda entra como 1.2.

export const CURRENT_LEGAL_VERSION = '1.2'
export const LEGAL_EFFECTIVE_DATE = '20 de septiembre de 2026'
export const LEGAL_DOCUMENT = 'terms_privacy'

// La LFPDPPP exige identidad y domicilio del responsable en el aviso: se pueden cambiar, no quitar.
// El domicilio es para oir y recibir notificaciones, no tiene que ser particular.
export const LEGAL_RESPONSABLE = 'Diego Garza Rodríguez'
export const LEGAL_DOMICILIO = 'Ciudad de México, C.P. 06760, México'
export const LEGAL_JURISDICCION = 'la Ciudad de México'

// Un solo buzon para todo lo legal: ARCO, eliminacion, terminos y contacto.
export const LEGAL_EMAIL = 'hola@anfiora.com'
