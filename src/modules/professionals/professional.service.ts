// src/modules/professionals/professional.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
}

type DayRange = { start: string; end: string }
// Se acepta tanto el formato viejo (un solo rango u null, todavía usado por la
// edición de horario del admin) como el nuevo (array de rangos, self-service y
// onboarding) — así un mismo profesional puede tener más de un bloque el mismo
// día (ej: 08–12 y 14–20 con un hueco al mediodía).
type DayValue = DayRange | DayRange[] | null
type WeeklyAvailability = Record<string, DayValue>

async function syncAvailability(professionalId: string, availability: WeeklyAvailability) {
  for (const [day, value] of Object.entries(availability)) {
    const dayIndex = DAY_MAP[day]
    if (dayIndex === undefined) continue

    const ranges: DayRange[] = value === null ? [] : Array.isArray(value) ? value : [value]

    // Reemplaza todas las filas de ese día en vez de hacer upsert por
    // (professionalId, dayOfWeek) — esa combinación ya no es única, así que
    // no hay una sola fila para actualizar.
    await prisma.professionalAvailability.deleteMany({
      where: { professionalId, dayOfWeek: dayIndex },
    })
    if (ranges.length > 0) {
      await prisma.professionalAvailability.createMany({
        data: ranges.map(r => ({ professionalId, dayOfWeek: dayIndex, startTime: r.start, endTime: r.end })),
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
    where: keepIds.length
      ? { professionalId, serviceId: { notIn: keepIds } }
      : { professionalId },
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

type AdminProfessionalMetrics = { totalAppointments: number; totalClients: number; totalRevenue: number }

async function computeMetrics(professionalIds: string[]): Promise<Map<string, AdminProfessionalMetrics>> {
  const map = new Map<string, AdminProfessionalMetrics>()
  if (professionalIds.length === 0) return map

  const rows = await prisma.appointment.findMany({
    where:  { professionalId: { in: professionalIds }, status: 'finished' },
    select: { professionalId: true, clientId: true, servicePrice: true },
  })

  const clientsByProf = new Map<string, Set<string>>()
  for (const r of rows) {
    const bucket = map.get(r.professionalId) ?? { totalAppointments: 0, totalClients: 0, totalRevenue: 0 }
    bucket.totalAppointments += 1
    bucket.totalRevenue += Number(r.servicePrice)
    map.set(r.professionalId, bucket)

    const clients = clientsByProf.get(r.professionalId) ?? new Set<string>()
    clients.add(r.clientId)
    clientsByProf.set(r.professionalId, clients)
  }
  for (const [professionalId, clients] of clientsByProf) {
    map.get(professionalId)!.totalClients = clients.size
  }

  return map
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
}, metrics?: AdminProfessionalMetrics) {
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
    metrics: {
      totalAppointments: metrics?.totalAppointments ?? 0,
      totalClients:      metrics?.totalClients      ?? 0,
      totalRevenue:      metrics?.totalRevenue       ?? 0,
      // No hay sistema de reseñas todavía — sin dato real para promediar.
      rating: 0,
    },
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
            certifications: true,
            instagram: true,
            facebook:  true,
            tiktok:    true,
            twitter:   true,
            priorRecommendations: true,
            afterCare:            true,
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
      certifications: u.professional?.certifications ?? null,
      instagram: u.professional?.instagram ?? null,
      facebook:  u.professional?.facebook  ?? null,
      tiktok:    u.professional?.tiktok    ?? null,
      twitter:   u.professional?.twitter   ?? null,
      // El frontend arma el mensaje de confirmación post-reserva con esto.
      priorRecommendations: u.professional?.priorRecommendations ?? null,
      afterCare:            u.professional?.afterCare            ?? null,
      services:  (u.professional?.services ?? []).map(s => s.serviceId),
    }))
  },

  // Disponibilidad semanal de un profesional — pública, para el flujo de reserva
  // date opcional (YYYY-MM-DD): si se pasa, además de la disponibilidad semanal
  // devuelve los horarios ya ocupados ese día, para que el frontend no ofrezca
  // turnos que van a chocar con la constraint de no-doble-reserva.
  getPublicAvailability: async (id: string, date?: string) => {
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } })
    if (!user || !['professional', 'admin'].includes(user.role) || !user.active) {
      throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')
    }
    const professional = await prisma.professional.findUnique({ where: { userId: id } })

    const availability = professional
      ? (await prisma.professionalAvailability.findMany({
          where:   { professionalId: professional.id, active: true },
          orderBy: { dayOfWeek: 'asc' },
        })).map(r => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }))
      : []

    let bookedTimes: string[] = []
    if (date) {
      const booked = await prisma.appointment.findMany({
        where:  { professionalId: id, date, status: { notIn: ['cancelled', 'no_show'] } },
        select: { time: true },
      })
      bookedTimes = booked.map(b => b.time)
    }

    return { availability, bookedTimes }
  },

  getAll: async () => {
    const users = await prisma.user.findMany({
      where:   { role: { in: ['professional', 'admin'] } },
      orderBy: { createdAt: 'asc' },
      include: ADMIN_PROFESSIONAL_INCLUDE,
    })
    const metricsMap = await computeMetrics(users.map(u => u.id))
    return users.map(u => toAdminProfessional(u, metricsMap.get(u.id)))
  },

  getById: async (id: string) => {
    const user = await prisma.user.findUnique({
      where:   { id },
      include: ADMIN_PROFESSIONAL_INCLUDE,
    })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')
    const metricsMap = await computeMetrics([id])
    return toAdminProfessional(user, metricsMap.get(id))
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
      // El formulario de configuración lo edita como texto separado por comas
      // (igual que el paso de onboarding) — no como array.
      languages:       (professional?.languages ?? []).join(', '),
      instagram:       professional?.instagram       ?? null,
      facebook:        professional?.facebook        ?? null,
      tiktok:          professional?.tiktok          ?? null,
      twitter:         professional?.twitter         ?? null,
      policies:        professional?.policies        ?? null,
      paymentMethods:  professional?.paymentMethods  ?? [],
      toleranceMinutes:     professional?.toleranceMinutes     ?? null,
      latePenalty:          professional?.latePenalty          ?? null,
      cancellationPolicy:   professional?.cancellationPolicy   ?? null,
      reschedulePolicy:     professional?.reschedulePolicy     ?? null,
      depositPolicy:        professional?.depositPolicy        ?? null,
      priorRecommendations: professional?.priorRecommendations ?? null,
      afterCare:            professional?.afterCare            ?? null,
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

    const languages = data.languages !== undefined
      ? String(data.languages).split(',').map((l: string) => l.trim()).filter(Boolean)
      : []

    const professionalFields = {
      bio:       data.bio       ?? null,
      photo:     data.photo     ?? null,
      specialty: data.specialty ?? null,
      instagram: data.instagram ?? null,
      facebook:  data.facebook  ?? null,
      tiktok:    data.tiktok    ?? null,
      twitter:   data.twitter   ?? null,
      yearsExperience: data.yearsExperience ?? 0,
      certifications:  data.certifications  ?? null,
      languages,
      paymentMethods:       data.paymentMethods       ?? [],
      toleranceMinutes:     data.toleranceMinutes     ?? null,
      latePenalty:          data.latePenalty          ?? null,
      cancellationPolicy:   data.cancellationPolicy   ?? null,
      reschedulePolicy:     data.reschedulePolicy     ?? null,
      depositPolicy:        data.depositPolicy        ?? null,
      priorRecommendations: data.priorRecommendations ?? null,
      afterCare:            data.afterCare            ?? null,
    }

    await prisma.professional.upsert({
      where:  { userId },
      create: { userId, ...professionalFields },
      update: professionalFields,
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

    // El paso "Personal" del onboarding manda un único campo `name` (no
    // firstName/lastName/dni) — se persiste en el User igual que en el registro.
    if (personal?.name !== undefined || personal?.phone !== undefined || personal?.gender !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(personal?.name   !== undefined ? { name: personal.name }     : {}),
          ...(personal?.phone  !== undefined ? { phone: personal.phone }   : {}),
          ...(personal?.gender !== undefined ? { gender: personal.gender } : {}),
        },
      })
    }

    const professionalFields = {
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
      toleranceMinutes:     policies?.toleranceMinutes     ?? null,
      latePenalty:          policies?.latePenalty          ?? null,
      cancellationPolicy:   policies?.cancellationPolicy   ?? null,
      reschedulePolicy:     policies?.reschedulePolicy     ?? null,
      depositPolicy:        policies?.depositPolicy        ?? null,
      priorRecommendations: policies?.priorRecommendations ?? null,
      afterCare:            policies?.afterCare            ?? null,
    }

    const professional = await prisma.professional.upsert({
      where:  { userId },
      create: { userId, ...professionalFields },
      update: professionalFields,
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

  // Horarios de servicios especiales que el profesional tiene asignados y que
  // TODAVÍA no reservó ningún cliente — hasta que eso pasa, no existe ningún
  // Appointment real, así que no aparecen en /professional/appointments. La
  // Agenda los usa para mostrar un bloque vacío "reservado para esto" en el
  // día/semana correspondiente.
  getSpecialAssignments: async (professionalId: string, date?: string) => {
    const services = await prisma.service.findMany({
      where: {
        isSpecial: true,
        status:    'active',
        ...(date ? { specialDate: date } : {}),
      },
    })

    const result: { serviceId: string; serviceName: string; date: string; time: string }[] = []
    for (const s of services) {
      if (!s.specialDate) continue
      const slots = (s.specialSlots as unknown as { time: string; professionalId: string; active: boolean; appointmentId?: string | null }[]) ?? []
      for (const slot of slots) {
        if (slot.active && slot.professionalId === professionalId && !slot.appointmentId) {
          result.push({ serviceId: s.id, serviceName: s.name, date: s.specialDate, time: slot.time })
        }
      }
    }
    return result
  },
}
