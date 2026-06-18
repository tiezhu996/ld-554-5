import { Op, type WhereOptions } from 'sequelize';
import { Shift, Employee, Store } from '../models/index.js';
import { getPagination } from '../utils/pagination.js';
import { storeScope } from './scope.service.js';
import type { AuthUser } from '../types/request.js';
import type { AttendanceStatus } from '../models/shift.model.js';

export async function listShifts(query: Record<string, unknown>, user?: AuthUser) {
  const { page, pageSize, limit, offset } = getPagination(query);
  const where: WhereOptions = { ...storeScope(user) };
  if (query.storeId) Object.assign(where, { storeId: query.storeId });
  if (query.shiftType) Object.assign(where, { shiftType: query.shiftType });
  if (query.startDate && query.endDate) Object.assign(where, { date: { [Op.between]: [query.startDate, query.endDate] } });
  const { rows, count } = await Shift.findAndCountAll({ where, limit, offset, include: [Employee, Store], order: [['date', 'ASC']] });
  return { list: rows, total: count, page, pageSize };
}

export async function createShift(payload: Record<string, unknown>) {
  return Shift.create(payload as never);
}

export async function updateShift(id: number, payload: Record<string, unknown>) {
  const shift = await Shift.findByPk(id);
  if (!shift) throw Object.assign(new Error('排班不存在'), { status: 404 });
  return shift.update(payload);
}

export async function autoGenerateShifts(storeId: number, date: string) {
  const employees = await Employee.findAll({ where: { storeId }, limit: 6 });
  const types = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
  return Promise.all(
    employees.map((employee, index) =>
      Shift.create({
        employeeId: employee.id,
        storeId,
        date,
        shiftType: types[index % types.length],
        startTime: index % 3 === 0 ? '08:00:00' : index % 3 === 1 ? '13:00:00' : '18:00:00',
        endTime: index % 3 === 0 ? '13:00:00' : index % 3 === 1 ? '18:00:00' : '23:00:00',
        status: 'PENDING'
      })
    )
  );
}

function isLate(actualTime: string, plannedTime: string): boolean {
  const [ah, am] = actualTime.split(':').map(Number);
  const [ph, pm] = plannedTime.split(':').map(Number);
  return ah * 60 + am > ph * 60 + pm;
}

function isEarly(actualTime: string, plannedTime: string): boolean {
  const [ah, am] = actualTime.split(':').map(Number);
  const [ph, pm] = plannedTime.split(':').map(Number);
  return ah * 60 + am < ph * 60 + pm;
}

export async function checkIn(id: number) {
  const shift = await Shift.findByPk(id);
  if (!shift) throw Object.assign(new Error('排班不存在'), { status: 404 });
  if (shift.status === 'CHECKED_IN' || shift.status === 'CHECKED_OUT') {
    throw Object.assign(new Error('已签到，不可重复操作'), { status: 400 });
  }
  if (shift.shiftType === 'REST') {
    throw Object.assign(new Error('休息班无需签到'), { status: 400 });
  }

  const now = new Date();
  const actualStartTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const late = isLate(actualStartTime, shift.startTime);

  const attendanceStatus: AttendanceStatus = late ? 'LATE' : 'NORMAL';

  await shift.update({
    status: 'CHECKED_IN',
    actualStartTime,
    attendanceStatus
  });

  return shift.reload({ include: [Employee, Store] });
}

export async function checkOut(id: number) {
  const shift = await Shift.findByPk(id);
  if (!shift) throw Object.assign(new Error('排班不存在'), { status: 404 });
  if (shift.status !== 'CHECKED_IN') {
    throw Object.assign(new Error('尚未签到，无法签退'), { status: 400 });
  }

  const now = new Date();
  const actualEndTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const early = isEarly(actualEndTime, shift.endTime);

  const wasLate = shift.attendanceStatus === 'LATE' || shift.attendanceStatus === 'LATE_AND_EARLY';
  let attendanceStatus: AttendanceStatus;
  if (wasLate && early) {
    attendanceStatus = 'LATE_AND_EARLY';
  } else if (wasLate) {
    attendanceStatus = 'LATE';
  } else if (early) {
    attendanceStatus = 'EARLY';
  } else {
    attendanceStatus = 'NORMAL';
  }

  await shift.update({
    status: 'CHECKED_OUT',
    actualEndTime,
    attendanceStatus
  });

  return shift.reload({ include: [Employee, Store] });
}
