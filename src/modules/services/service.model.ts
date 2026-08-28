// src/modules/services/service.model.ts
import type { Prisma } from '@prisma/client'
import { prisma } from '../../app/database/prisma'

export type ServiceStatus = 'active' | 'inactive'

export interface SpecialSlot {
  id?:               string
  time:              string
  professionalId:    string
  professionalName?: string
  active:            boolean
  clientName?:       string | null
  appointmentId?:    string | null
}

export interface ServiceZone {
  id:       string
  name:     string
  duration: number
  price:    number
  active:   boolean
}

export interface ServicePackage {
  id:       string
  name:     string
  zoneIds:  string[]
  duration: number
  price:    number
  active:   boolean
}

export interface ServiceData {
  name:        string
  categoryId:  string
  description: string
  duration:    number
  price:       number
  image:       string | null
  status:      ServiceStatus
  isCombo:     boolean
  comboServiceIds: string[]
  simultaneous:    boolean
  isSpecial:    boolean
  specialDate:  string | null
  specialSlots: SpecialSlot[]
  zones:        ServiceZone[]
  packages:     ServicePackage[]
}

// Vista pública/cliente de un horario: nunca expone quién lo reservó, solo si
// ya está tomado — y los inactivos ni siquiera aparecen.
function publicSlot(s: SpecialSlot) {
  return {
    time:              s.time,
    professionalId:    s.professionalId,
    professionalName:  s.professionalName ?? null,
    active:            s.active,
    booked:            Boolean(s.appointmentId),
  }
}

function publicService(s: any) {
  if (!s.isSpecial) return s
  return {
    ...s,
    specialSlots: ((s.specialSlots ?? []) as SpecialSlot[]).filter(slot => slot.active).map(publicSlot),
    zones:        ((s.zones ?? [])        as ServiceZone[]).filter(z => z.active),
    packages:     ((s.packages ?? [])     as ServicePackage[]).filter(p => p.active),
  }
}

export const serviceModel = {

  findAll: () =>
    prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
    }),

  // Pública / cliente — nunca expone datos del cliente que reservó un horario,
  // y nunca lista horarios/zonas/paquetes inactivos (server-side, no depende
  // de que el frontend filtre).
  findActive: async () => {
    const rows = await prisma.service.findMany({
      where:   { status: 'active' },
      orderBy: { name: 'asc' },
    })
    return rows.map(publicService)
  },

  findById: (id: string) =>
    prisma.service.findUnique({ where: { id } }),

  create: (data: ServiceData) =>
    prisma.service.create({
      data: {
        ...data,
        specialSlots: data.specialSlots as unknown as Prisma.InputJsonValue,
        zones:        data.zones        as unknown as Prisma.InputJsonValue,
        packages:     data.packages     as unknown as Prisma.InputJsonValue,
      },
    }),

  update: (id: string, data: Partial<ServiceData>) =>
    prisma.service.update({
      where: { id },
      data: {
        ...data,
        specialSlots: data.specialSlots as unknown as Prisma.InputJsonValue | undefined,
        zones:        data.zones        as unknown as Prisma.InputJsonValue | undefined,
        packages:     data.packages     as unknown as Prisma.InputJsonValue | undefined,
      },
    }),

  delete: async (id: string): Promise<{ deleted: boolean }> => {
    try {
      await prisma.service.delete({ where: { id } })
      return { deleted: true }
    } catch (err: any) {
      // El servicio tiene turnos o asignaciones a profesionales (RESTRICT) —
      // no se puede borrar sin perder ese historial, así que se desactiva en su lugar.
      const isForeignKeyRestrict = err?.code === 'P2003' || String(err?.message ?? '').includes('foreign key constraint')
      if (isForeignKeyRestrict) {
        await prisma.service.update({ where: { id }, data: { status: 'inactive' } })
        return { deleted: false }
      }
      throw err
    }
  },

  toggleStatus: async (id: string) => {
    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) return null
    return prisma.service.update({
      where: { id },
      data:  { status: service.status === 'active' ? 'inactive' : 'active' },
    })
  },
}
