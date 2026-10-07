import type { Area, AreaId, Specialty, SpecialtyId } from '../types'

export const AREAS: Area[] = [
  {
    id: 'clinica',
    name: 'Clínica Burgos',
    shortName: 'Clínica Burgos',
    description: 'Oftalmología y medicina estética en clínica',
    accent: '#7A8471',
    hasSpecialty: true,
  },
  {
    id: 'quiron',
    name: 'Hospital Quirón',
    shortName: 'Hospital Quirón',
    description: 'Actividad en Hospital Quirón',
    accent: '#A68B5B',
    hasSpecialty: true,
  },
  {
    id: 'cataratas',
    name: 'Concierto Cataratas',
    shortName: 'Cataratas',
    description: 'Actividad concertada de cirugía de cataratas',
    accent: '#5C6B7A',
    hasSpecialty: false,
  },
]

export const SPECIALTIES: Specialty[] = [
  { id: 'oftalmologia', name: 'Oftalmología' },
  { id: 'estetica', name: 'Medicina estética' },
]

export function getArea(id: string): Area | undefined {
  return AREAS.find((a) => a.id === id)
}

export function getSpecialty(id?: SpecialtyId): Specialty | undefined {
  if (!id) return undefined
  return SPECIALTIES.find((s) => s.id === id)
}

export function areaNeedsSpecialty(areaId: AreaId): boolean {
  return getArea(areaId)?.hasSpecialty ?? false
}

export function specialtyLabel(id?: SpecialtyId): string {
  return getSpecialty(id)?.name ?? '—'
}
