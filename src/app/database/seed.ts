import { env }            from '../config/env'
import { prisma }         from './prisma'
import { bcryptProvider } from '../../modules/auth/providers/bcrypt.provider'

export async function seedAdmin(): Promise<void> {
  const exists = await prisma.user.count({ where: { email: env.ADMIN_EMAIL } })
  if (exists > 0) return

  const passwordHash = await bcryptProvider.hash(env.ADMIN_PASSWORD)

  await prisma.user.create({
    data: {
      name:          env.ADMIN_NAME,
      email:         env.ADMIN_EMAIL,
      passwordHash,
      role:          'admin',
      emailVerified: true,
    },
  })

  console.log(`👤 Admin inicial creado: ${env.ADMIN_EMAIL}`)
}