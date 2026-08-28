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

const app = express()

// Confía en el primer proxy delante de la app (el túnel de VS Code en dev;
// en producción va a ser el proxy real del hosting elegido — revisar este
// número si en algún momento hay más de un proxy en cadena). Sin esto,
// express-rate-limit no puede confiar en el header X-Forwarded-For que
// agrega el túnel, y tira el warning ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1)

app.use(helmet())

app.use(cors({
  origin:         env.FRONTEND_URL,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))

app.use(rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  message:  { error: 'Demasiadas solicitudes. Intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders:   false,
}))

// verify: capturarRawBody guarda el body crudo en req.rawBody antes de
// parsearlo — lo necesita el webhook de WhatsApp para validar la firma
// de Meta (HMAC contra los bytes exactos recibidos). Corre en todas las
// requests; el costo es despreciable y evita un segundo parser JSON
// solo para esa ruta.
app.use(express.json({ limit: '8mb', verify: capturarRawBody }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/api', apiRoutes)

app.use(notFound)
app.use(errorHandler)

export { app }