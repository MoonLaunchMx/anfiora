import { toWhatsApp } from '@/lib/phone'

export type ContactoTipo = 'whatsapp' | 'correo' | 'instagram' | 'facebook' | 'sitio'

export type Contacto = { tipo: ContactoTipo; href: string }

type DatosContacto = {
  phone: string | null
  phone_country_code: string | null
  email: string | null
  instagram: string | null
  facebook: string | null
  website: string | null
}

// El telefono guardado a veces trae el '+' completo y a veces solo el numero
// nacional con la lada aparte -- las dos formas conviven en la base.
export function telefonoCrudoDe(s: Pick<DatosContacto, 'phone' | 'phone_country_code'>): string | null {
  if (!s.phone) return null
  return s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`
}

// Un boton por canal, y solo si el dato existe. El orden es el que pidio Diego:
// WhatsApp, correo, Instagram, Facebook, sitio.
export function contactosDe(s: DatosContacto): Contacto[] {
  const contactos: Contacto[] = []

  const telCrudo = telefonoCrudoDe(s)
  const waDigitos = telCrudo ? toWhatsApp(telCrudo) : null
  if (waDigitos) contactos.push({ tipo: 'whatsapp', href: `https://wa.me/${waDigitos}` })

  if (s.email) contactos.push({ tipo: 'correo', href: `mailto:${s.email}` })

  if (s.instagram) contactos.push({ tipo: 'instagram', href: `https://instagram.com/${s.instagram.replace('@', '')}` })
  if (s.facebook) contactos.push({ tipo: 'facebook', href: `https://facebook.com/${s.facebook.replace('@', '')}` })

  if (s.website) {
    contactos.push({ tipo: 'sitio', href: s.website.startsWith('http') ? s.website : `https://${s.website}` })
  }

  return contactos
}
