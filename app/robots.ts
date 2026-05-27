import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/events/',
        '/perfil',
        '/admin',
        '/mensajes',
        '/api/',
      ],
    },
    sitemap: 'https://anfiora.com/sitemap.xml',
  }
}