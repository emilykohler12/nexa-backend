// src/app/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env }          from './config/env'
import { apiRoutes }    from './routes'
import { errorHandler } from './middlewares/errorHandler'
import { notFound }     from './middlewares/notFound'
import { capturarRawBody } from '../modules/whatsapp/middleware/whatsapp-signature.middleware'
import { initSentry, sentryRequestHandler, sentryErrorHandler } from '../sentry'

// Inicializar Sentry ANTES de crear la app
initSentry()

const app = express()

// Confía en el primer proxy delante de la app (el túnel de VS Code en dev;
// en producción va a ser el proxy real del hosting elegido — revisar este
// número si en algún momento hay más de un proxy en cadena). Sin esto,
// express-rate-limit no puede confiar en el header X-Forwarded-For que
// agrega el túnel, y tira el warning ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1)

// Sentry request handler PRIMERO para capturar requests
app.use(sentryRequestHandler())

// Cabeceras de seguridad. helmet() ya trae buenos defaults (CSP, X-Frame-Options,
// HSTS, etc.) — acá se los deja explícitos porque esta API nunca sirve HTML/JS/CSS
// propio (solo JSON), así que puede ser más estricta que el default 'self' de CSP.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"], // refuerza X-Frame-Options: nadie nos puede iframear
    },
  },
  strictTransportSecurity: {
    maxAge: 63072000, // 2 años, el mínimo que piden los navegadores para el preload
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
}))

app.use(cors({
  origin:         env.FRONTEND_URL,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))

// En test, los límites de tasa (acá y los de auth.routes.ts) rompen la suite
// sin aportar nada — una corrida de tests dispara muchas más requests por
// minuto que un uso real, y no se está probando el rate limit en sí.
if (env.NODE_ENV !== 'test') {
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max:      100,
    message:  { error: 'Demasiadas solicitudes. Intentá más tarde.' },
    standardHeaders: true,
    legacyHeaders:   false,
  }))
}

// verify: capturarRawBody guarda el body crudo en req.rawBody antes de
// parsearlo — lo necesita el webhook de WhatsApp para validar la firma
// de Meta (HMAC contra los bytes exactos recibidos). Corre en todas las
// requests; el costo es despreciable y evita un segundo parser JSON
// solo para esa ruta.
app.use(express.json({ limit: '8mb', verify: capturarRawBody }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// Alias sin /api — el panel de Render suele pedir una ruta de health check
// "pelada" (ej. /health), así sirve sin importar cuál termines configurando ahí.
app.get('/health', (_req, res) => res.redirect(307, '/api/health'))

app.use('/api', apiRoutes)

app.use(notFound)
app.use(sentryErrorHandler())
app.use(errorHandler)

export { app }