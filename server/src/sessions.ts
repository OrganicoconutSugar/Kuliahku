import type { CourseInput } from '../../shared/validation'
import { fail, type Tx } from './core'
export async function writeCourse(tx: Tx, semesterId: string, input: CourseInput, id?: string) {
  const { schedules, ...fields } = input
  const course = id
    ? await tx.course.update({ where: { id, semesterId }, data: fields })
    : await tx.course.create({ data: { ...fields, semesterId } })
  const existing = await tx.classSchedule.findMany({ where: { courseId: course.id, active: true } })
  for (const s of existing)
    if (!schedules.some((slot) => slot.id === s.id))
      await tx.classSchedule.update({ where: { id: s.id }, data: { active: false } })
  for (const { id: slotId, ...data } of schedules) {
    if (slotId) {
      if (!existing.some((s) => s.id === slotId)) fail('Slot jadwal tidak ditemukan.')
      await tx.classSchedule.update({ where: { id: slotId }, data })
    } else await tx.classSchedule.create({ data: { ...data, courseId: course.id } })
  }
  return course
}
