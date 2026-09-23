// src/modules/auth/providers/social.provider.ts
//
// Verifica un access_token de Google/Facebook CONTRA el servidor real de cada
// proveedor — nunca se confía en el email/nombre que mande el cliente. Un
// front malicioso podría mandar cualquier JSON, pero no puede falsificar un
// access_token válido de una cuenta que no controla.
import { env } from '../../../app/config/env'

export interface SocialProfile {
  email:   string
  name:    string
  picture: string | null
}

export const socialProvider = {

  verifyGoogle: async (accessToken: string): Promise<SocialProfile> => {
    if (!env.GOOGLE_CLIENT_ID) throw new Error('Falta configurar GOOGLE_CLIENT_ID en el servidor')

    // 1) Confirma que el token lo emitió Google PARA ESTA app (aud) y que
    // sigue vigente — sin esto, un token válido de otra app cualquiera
    // pasaría el paso 2 igual.
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
    if (!tokenInfoRes.ok) throw new Error('Token de Google inválido o expirado')
    const tokenInfo: any = await tokenInfoRes.json()
    if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
      throw new Error('El token de Google no corresponde a esta aplicación')
    }

    // 2) Recién acá se pide el perfil — mismo endpoint que ya usaba el front,
    // pero ahora la fuente de verdad es esta llamada del backend, no lo que
    // el cliente diga que Google le devolvió.
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!profileRes.ok) throw new Error('No se pudo obtener el perfil de Google')
    const profile: any = await profileRes.json()
    if (!profile.email || profile.email_verified !== true) {
      throw new Error('Tu cuenta de Google no tiene el email verificado')
    }

    return { email: profile.email, name: profile.name ?? profile.email.split('@')[0], picture: profile.picture ?? null }
  },

  verifyFacebook: async (accessToken: string): Promise<SocialProfile> => {
    if (!env.FACEBOOK_APP_ID) throw new Error('Falta configurar FACEBOOK_APP_ID en el servidor')

    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
    )
    const data: any = await res.json()
    if (!res.ok || data.error) throw new Error('Token de Facebook inválido o expirado')
    if (!data.email) {
      throw new Error('Tu cuenta de Facebook no tiene un email asociado. Probá con otro método.')
    }

    return { email: data.email, name: data.name ?? data.email.split('@')[0], picture: data.picture?.data?.url ?? null }
  },
}
