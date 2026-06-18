import { fn, col, literal, Op } from 'sequelize';
import { Employee, Shift, Store, Transaction } from '../models/index.js';
import { EmployeeStatus, TransactionType } from '../constants/enums.js';

export async function getDashboardSummary() {
  const [employeeCount, activeEmployees, pendingShifts, pendingTransactions] = await Promise.all([
    Employee.count(),
    Employee.count({ where: { status: EmployeeStatus.ACTIVE } }),
    Shift.count({ where: { status: 'PENDING' } }),
    Transaction.count({ where: { reviewed: false } })
  ]);

  const monthlyFinance = await Transaction.findAll({
    attributes: [
      [fn('DATE_FORMAT', col('date'), '%Y-%m'), 'month'],
      'type',
      [fn('SUM', col('amount')), 'amount']
    ],
    group: ['type', fn('DATE_FORMAT', col('date'), '%Y-%m')],
    raw: true
  });

  const topStores = await Transaction.findAll({
    attributes: ['storeId', [fn('SUM', col('amount')), 'revenue']],
    where: { type: TransactionType.INCOME },
    include: [Store],
    group: ['storeId'],
    order: [[literal('revenue'), 'DESC']],
    limit: 5
  });

  const nonRestTotal = await Shift.count({ where: { shiftType: { [Op.ne]: 'REST' } } });
  const checkedIn = await Shift.count({ where: { status: { [Op.in]: ['CHECKED_IN', 'CHECKED_OUT'] } } });
  const normalCount = await Shift.count({ where: { attendanceStatus: 'NORMAL' } });
  const lateCount = await Shift.count({ where: { attendanceStatus: { [Op.in]: ['LATE', 'LATE_AND_EARLY'] } } });
  const earlyCount = await Shift.count({ where: { attendanceStatus: { [Op.in]: ['EARLY', 'LATE_AND_EARLY'] } } });

  return {
    metrics: { employeeCount, activeEmployees, pendingShifts, pendingTransactions },
    monthlyFinance,
    topStores,
    attendance: {
      total: nonRestTotal,
      checkedIn,
      normal: normalCount,
      late: lateCount,
      early: earlyCount,
      absent: Math.max(nonRestTotal - checkedIn, 0),
      rate: nonRestTotal > 0 ? Math.round((normalCount / nonRestTotal) * 100) : 0
    },
    todos: [
      { title: '待确认排班', count: pendingShifts },
      { title: '待审核财务记录', count: pendingTransactions },
      { title: '试用期员工', count: await Employee.count({ where: { status: EmployeeStatus.ON_PROBATION } }) }
    ]
  };
}
