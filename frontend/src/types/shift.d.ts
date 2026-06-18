import type { ShiftType } from '@/constants/enums';

export type AttendanceStatus = 'NORMAL' | 'LATE' | 'EARLY' | 'LATE_AND_EARLY' | 'ABSENT';
export type ShiftStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT';

export interface Shift {
  id: number;
  employeeId: number;
  employee?: { name: string; employeeNo: string };
  date: string;
  shiftType: keyof typeof ShiftType;
  startTime: string;
  endTime: string;
  storeId: number;
  status: ShiftStatus;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  attendanceStatus?: AttendanceStatus | null;
}
