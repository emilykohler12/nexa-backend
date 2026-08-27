// src/modules/whatsapp/middleware/whatsapp-signature.middleware.ts
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

// Extendemos el tipo Request para poder guardar el body crudo
// (lo necesitamos para calcular la firma, antes de que Express
// lo convierta a objeto JSON).
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer
    }
  }
}

/**
 * Se pasa como opción "verify" al parser JSON global de la app
 * (ver app.ts), para quedarnos con el body sin procesar antes de
 * que se parsee a objeto. Corre en TODAS las requests, no solo en
 * la del webhook — el costo es despreciable y evita tener que usar
 * un segundo parser JSON solo para esta ruta.
 */
export function capturarRawBody(req: Request, _res: Response, buf: Buffer) {
  req.rawBody = buf
}

/**
 * Verifica que la petición realmente venga de Meta, comparando la
 * firma que manda en el header "x-hub-signature-256" contra un
 * HMAC-SHA256 calculado con el App Secret de la app de Meta.
 *
 * Sin esto, cualquiera que descubra la URL del webhook podría
 * mandar payloads falsos haciéndose pasar por Meta.
 */
export function verificarFirmaMeta(req: Request, res: Response, next: NextFunction) {
  const firmaRecibida = req.header('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET

  if (!appSecret) {
    console.error('[whatsapp] Falta WHATSAPP_APP_SECRET en las variables de entorno')
    return res.sendStatus(500)
  }

  if (!firmaRecibida || !req.rawBody) {
    return res.sendStatus(401)
  }

  const firmaEsperada =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')

  // timingSafeEqual lanza una excepción si los buffers tienen longitud
  // distinta en vez de devolver false — sin este chequeo previo, un
  // header de firma con una longitud distinta a la esperada (por error
  // o a propósito) tira una excepción no controlada acá adentro.
  const bufferRecibido = Buffer.from(firmaRecibida)
  const bufferEsperado = Buffer.from(firmaEsperada)

  if (bufferRecibido.length !== bufferEsperado.length) {
    console.warn('[whatsapp] Firma con longitud inválida en webhook recibido')
    return res.sendStatus(401)
  }

  const firmasCoinciden = crypto.timingSafeEqual(bufferRecibido, bufferEsperado)

  if (!firmasCoinciden) {
    console.warn('[whatsapp] Firma inválida en webhook recibido')
    return res.sendStatus(401)
  }

  next()
}
