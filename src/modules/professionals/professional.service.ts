// src/modules/professionals/professional.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
}

type DayRange = { start: string; end: string } | null
type WeeklyAvailability = Record<string, DayRange>

async function syncAvailability(professionalId: string, availability: WeeklyAvailability) {
  for (const [day, range] of Object.entries(availability)) {
    const dayIndex = DAY_MAP[day]
    if (dayIndex === undefined) continue

    if (range === null) {
      await prisma.professionalAvailability.deleteMany({
        where: { professionalId, dayOfWeek: dayIndex },
      })
    } else {
      await prisma.professionalAvailability.upsert({
        where:  { professionalId_dayOfWeek: { professionalId, dayOfWeek: dayIndex } },
        create: { professionalId, dayOfWeek: dayIndex, startTime: range.start, endTime: range.end },
        update: { startTime: range.start, endTime: range.end, active: true },
      })
    }
  }
}

async function syncServices(
  professionalId: string,
  services: { serviceId: string; status: 'active' | 'inactive' }[],
) {
  const keepIds = services.map(s => s.serviceId)
  await prisma.professionalService.deleteMany({
    where: { professionalId, serviceId: { notIn: keepIds.length ? keepIds : ['__none__'] } },
  })

  for (const s of services) {
    const catalogService = await prisma.service.findUnique({ where: { id: s.serviceId } })
    if (!catalogService) continue

    await prisma.professionalService.upsert({
      where:  { professionalId_serviceId: { professionalId, serviceId: s.serviceId } },
      create: {
        professionalId, serviceId: s.serviceId,
        ownPrice: catalogService.price, ownDuration: catalogService.duration,
        active: s.status !== 'inactive',
      },
      update: { active: s.status !== 'inactive' },
    })
  }
}

function scheduleFromAvailability(availability: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  const schedule: Record<string, { start: string; end: string } | null> = {
    monday: null, tuesday: null, wednesday: null, thursday: null,
    friday: null, saturday: null, sunday: null,
  }
  for (const a of availability) {
    const key = DAY_KEYS[a.dayOfWeek]
    if (key) schedule[key] = { start: a.startTime, end: a.endTime }
  }
  return schedule
}

function toAdminProfessional(user: {
  id: string; name: string; email: string; phone: string | null
  role: string; active: boolean; createdAt: Date
  professional: {
    photo: string | null; specialty: string | null
    instagram: string | null; facebook: string | null; tiktok: string | null; twitter: string | null
    commissionType: string; commissionPct: number
    vacationFrom: Date | null; vacationTo: Date | null
    availability: { dayOfWeek: number; startTime: string; endTime: string }[]
    services: { serviceId: string }[]
  } | null
}) {
  const professional = user.professional
  return {
    id:        user.id,
    name:      user.name,
    photo:     professional?.photo ?? null,
    specialty: professional?.specialty ?? '',
    services:  (professional?.services ?? []).map(s => s.serviceId),
    commissionType: (professional?.commissionType ?? 'earned') as 'earned' | 'to_owner',
    commissionPct:  professional?.commissionPct ?? 0,
    status:    user.active ? 'active' as const : 'inactive' as const,
    role:      user.role,
    phone:     user.phone ?? '',
    email:     user.email,
    socials: {
      instagram: professional?.instagram ?? null,
      facebook:  professional?.facebook  ?? null,
      tiktok:    professional?.tiktok    ?? null,
      twitter:   professional?.twitter   ?? null,
    },
    schedule:     scheduleFromAvailability(professional?.availability ?? []),
    daysOff:      [] as string[],
    vacationFrom: professional?.vacationFrom ? professional.vacationFrom.toISOString().slice(0, 10) : null,
    vacationTo:   professional?.vacationTo   ? professional.vacationTo.toISOString().slice(0, 10)   : null,
    createdAt:    user.createdAt.toISOString(),
    metrics: { totalAppointments: 0, totalClients: 0, totalRevenue: 0, rating: 0 },
  }
}

const ADMIN_PROFESSIONAL_INCLUDE = {
  professional: {
    include: {
      availability: true,
      services: { where: { active: true }, select: { serviceId: true } },
    },
  },
} as const

export const professionalService = {

  // Ruta pública — devuelve solo lo necesario para mostrar en la home
  // (y, con includeAdmin, para el paso 2 de reserva de turno)
  // serviceId, si se pasa, filtra server-side a quienes tengan ese servicio activo asignado.
  getAllPublic: async (includeAdmin = false, serviceId?: string) => {
    const users = await prisma.user.findMany({
      where: {
        role:   includeAdmin ? { in: ['professional', 'admin'] } : 'professional',
        active: true,
        ...(serviceId ? { professional: { services: { some: { serviceId, active: true } } } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id:   true,
        name: true,
        professional: {
          select: {
            photo:     true,
            bio:       true,
            specialty: true,
            instagram: true,
            facebook:  true,
            tiktok:    true,
            twitter:   true,
            services:  { where: { active: true }, select: { serviceId: true } },
          },
        },
      },
    })

    return users.map(u => ({
      id:        u.id,
      name:      u.name,
      photo:     u.professional?.photo     ?? null,
      bio:       u.professional?.bio       ?? null,
      specialty: u.professional?.specialty ?? null,
      instagram: u.professional?.instagram ?? null,
      facebook:  u.professional?.facebook  ?? null,
      tiktok:    u.professional?.tiktok    ?? null,
      twitter:   u.professional?.twitter   ?? null,
      services:  (u.professional?.services ?? []).map(s => s.serviceId),
    }))
  },

  // Disponibilidad semanal de un profesional — pública, para el flujo de reserva
  getPublicAvailability: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } })
    if (!user || !['professional', 'admin'].includes(user.role) || !user.active) {
      throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')
    }
    const professional = await prisma.professional.findUnique({ where: { userId: id } })
    if (!professional) return []

    const rows = await prisma.professionalAvailability.findMany({
      where:   { professionalId: professional.id, active: true },
      orderBy: { dayOfWeek: 'asc' },
    })
    return rows.map(r => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }))
  },

  getAll: async () => {
    const users = await prisma.user.findMany({
      where:   { role: { in: ['professional', 'admin'] } },
      orderBy: { createdAt: 'asc' },
      include: ADMIN_PROFESSIONAL_INCLUDE,
    })
    return users.map(toAdminProfessional)
  },

  getById: async (id: string) => {
    const user = await prisma.user.findUnique({
      where:   { id },
      include: ADMIN_PROFESSIONAL_INCLUDE,
    })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')
    return toAdminProfessional(user)
  },

  updateById: async (id: string, data: any) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')

    const userUpdate: Record<string, unknown> = {}
    if (data.name   !== undefined) userUpdate.name   = data.name
    if (data.phone  !== undefined) userUpdate.phone  = data.phone
    if (data.email  !== undefined) userUpdate.email  = data.email
    if (data.status !== undefined) userUpdate.active = data.status === 'active'

    if (Object.keys(userUpdate).length > 0) {
      try {
        await prisma.user.update({ where: { id }, data: userUpdate })
      } catch (err: any) {
        if (err?.code === 'P2002') throw new AppError(HTTP.CONFLICT, 'Ese email ya está en uso', 'EMAIL_TAKEN')
        throw err
      }
    }

    const professional = await prisma.professional.upsert({
      where:  { userId: id },
      create: {
        userId:    id,
        photo:     data.photo     ?? null,
        specialty: data.specialty ?? null,
        instagram: data.socials?.instagram ?? null,
        facebook:  data.socials?.facebook  ?? null,
        tiktok:    data.socials?.tiktok    ?? null,
        twitter:   data.socials?.twitter   ?? null,
        commissionType: data.commissionType ?? 'earned',
        commissionPct:  data.commissionPct  ?? 0,
        vacationFrom:   data.vacationFrom ? new Date(data.vacationFrom) : null,
        vacationTo:     data.vacationTo   ? new Date(data.vacationTo)   : null,
      },
      update: {
        ...(data.photo               !== undefined ? { photo: data.photo }         : {}),
        ...(data.specialty           !== undefined ? { specialty: data.specialty } : {}),
        ...(data.socials?.instagram  !== undefined ? { instagram: data.socials.instagram } : {}),
        ...(data.socials?.facebook   !== undefined ? { facebook:  data.socials.facebook  } : {}),
        ...(data.socials?.tiktok     !== undefined ? { tiktok:    data.socials.tiktok    } : {}),
        ...(data.socials?.twitter    !== undefined ? { twitter:   data.socials.twitter   } : {}),
        ...(data.commissionType      !== undefined ? { commissionType: data.commissionType } : {}),
        ...(data.commissionPct       !== undefined ? { commissionPct:  data.commissionPct  } : {}),
        ...(data.vacationFrom        !== undefined ? { vacationFrom: data.vacationFrom ? new Date(data.vacationFrom) : null } : {}),
        ...(data.vacationTo          !== undefined ? { vacationTo:   data.vacationTo   ? new Date(data.vacationTo)   : null } : {}),
      },
    })

    if (data.schedule) await syncAvailability(professional.id, data.schedule)
    if (data.services) {
      await syncServices(professional.id, data.services.map((serviceId: string) => ({ serviceId, status: 'active' as const })))
    }

    return professionalService.getById(id)
  },

  toggleActive: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado')
    return prisma.user.update({ where: { id }, data: { active: !user.active } })
  },

  toggleRole: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado')
    const newRole = user.role === 'admin' ? 'professional' : 'admin'
    return prisma.user.update({ where: { id }, data: { role: newRole as any } })
  },

  // ── Self-service — profesional autenticado ─────────────────────────

  getMyProfile: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado')

    const professional = await prisma.professional.findUnique({
      where:   { userId },
      include: { availability: true },
    })

    return {
      id:              user.id,
      name:            user.name,
      email:           user.email,
      phone:           user.phone,
      bio:             professional?.bio             ?? null,
      photo:           professional?.photo           ?? null,
      specialty:       professional?.specialty       ?? null,
      yearsExperience: professional?.yearsExperience ?? 0,
      certifications:  professional?.certifications  ?? null,
      languages:       professional?.languages       ?? [],
      instagram:       professional?.instagram       ?? null,
      facebook:        professional?.facebook        ?? null,
      tiktok:          professional?.tiktok          ?? null,
      twitter:         professional?.twitter         ?? null,
      policies:        professional?.policies        ?? null,
      paymentMethods:  professional?.paymentMethods  ?? [],
      availability: (professional?.availability ?? []).map(a => ({
        dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime,
      })),
    }
  },

  updateMyProfile: async (userId: string, data: any) => {
    if (data.name !== undefined || data.phone !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name  !== undefined ? { name: data.name }   : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        },
      })
    }

    await prisma.professional.upsert({
      where:  { userId },
      create: {
        userId,
        bio:       data.bio       ?? null,
        photo:     data.photo     ?? null,
        specialty: data.specialty ?? null,
        instagram: data.instagram ?? null,
        facebook:  data.facebook  ?? null,
        tiktok:    data.tiktok    ?? null,
        twitter:   data.twitter   ?? null,
      },
      update: {
        bio:       data.bio       ?? null,
        photo:     data.photo     ?? null,
        specialty: data.specialty ?? null,
        instagram: data.instagram ?? null,
        facebook:  data.facebook  ?? null,
        tiktok:    data.tiktok    ?? null,
        twitter:   data.twitter   ?? null,
      },
    })

    return professionalService.getMyProfile(userId)
  },

  getMyServices: async (userId: string) => {
    const professional = await prisma.professional.findUnique({ where: { userId } })
    if (!professional) return []

    const rows = await prisma.professionalService.findMany({ where: { professionalId: professional.id } })
    return rows.map(r => ({
      serviceId:   r.serviceId,
      status:      r.active ? 'active' as const : 'inactive' as const,
      ownPrice:    Number(r.ownPrice),
      ownDuration: r.ownDuration,
    }))
  },

  updateMyServices: async (userId: string, services: { serviceId: string; status: 'active' | 'inactive' }[]) => {
    const professional = await prisma.professional.upsert({
      where: { userId }, create: { userId }, update: {},
    })
    await syncServices(professional.id, services)
    return professionalService.getMyServices(userId)
  },

  updateMySchedule: async (userId: string, availability: WeeklyAvailability) => {
    const professional = await prisma.professional.upsert({
      where: { userId }, create: { userId }, update: {},
    })
    await syncAvailability(professional.id, availability)
    return { message: 'Horario actualizado' }
  },

  saveOnboarding: async (userId: string, data: any): Promise<void> => {
    const { personal, work, availability, services, policies } = data

    const professional = await prisma.professional.upsert({
      where:  { userId },
      create: {
        userId,
        bio:             personal?.bio             ?? null,
        photo:           personal?.photo           ?? null,
        specialty:       work?.specialty           ?? null,
        yearsExperience: work?.yearsExperience     ?? 0,
        certifications:  work?.certifications      ?? null,
        languages:       work?.languages ? work.languages.split(',').map((l: string) => l.trim()) : [],
        instagram:       personal?.instagram       ?? null,
        facebook:        personal?.facebook        ?? null,
        tiktok:          personal?.tiktok          ?? null,
        twitter:         personal?.twitter         ?? null,
        policies:        policies?.cancellationPolicy ?? null,
        paymentMethods:  policies?.paymentMethods  ?? [],
      },
      update: {
        bio:             personal?.bio             ?? null,
        photo:           personal?.photo           ?? null,
        specialty:       work?.specialty           ?? null,
        yearsExperience: work?.yearsExperience     ?? 0,
        certifications:  work?.certifications      ?? null,
        languages:       work?.languages ? work.languages.split(',').map((l: string) => l.trim()) : [],
        instagram:       personal?.instagram       ?? null,
        facebook:        personal?.facebook        ?? null,
        tiktok:          personal?.tiktok          ?? null,
        twitter:         personal?.twitter         ?? null,
        policies:        policies?.cancellationPolicy ?? null,
        paymentMethods:  policies?.paymentMethods  ?? [],
      },
    })

    if (availability) await syncAvailability(professional.id, availability)

    if (Array.isArray(services)) {
      for (const s of services) {
        await prisma.professionalService.upsert({
          where:  { professionalId_serviceId: { professionalId: professional.id, serviceId: s.serviceId } },
          create: { professionalId: professional.id, serviceId: s.serviceId, ownPrice: s.ownPrice, ownDuration: s.ownDuration, active: true },
          update: { ownPrice: s.ownPrice, ownDuration: s.ownDuration },
        })
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { profileComplete: true },
    })
  },

  getOnboardingStatus: async (userId: string): Promise<{ profileComplete: boolean }> => {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { profileComplete: true },
    })
    return { profileComplete: user?.profileComplete ?? false }
  },
}
