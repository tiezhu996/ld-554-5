<template>
  <AppLayout>
    <div class="page-title">
      <h1>排班管理</h1>
      <el-button-group>
        <el-button v-permission="['OWNER','MANAGER']" type="primary" :icon="Plus" @click="formVisible = true">创建排班</el-button>
        <el-button v-permission="['OWNER','MANAGER']" :icon="MagicStick" @click="autoPlan">自动排班</el-button>
      </el-button-group>
    </div>
    <div class="panel filters">
      <StoreSelector @change="(value) => filters.storeId = value as number" />
      <el-select v-model="filters.shiftType" placeholder="班次" clearable>
        <el-option v-for="(label, value) in ShiftTypeLabel" :key="value" :label="label" :value="value" />
      </el-select>
      <el-button @click="load">刷新</el-button>
    </div>
    <div class="panel week-board">
      <div v-for="day in weekDays" :key="day" class="day-col">
        <strong>{{ day }}</strong>
        <article
          v-for="shift in shifts.list.filter((item) => item.date.endsWith(day.slice(-2)))"
          :key="shift.id"
          draggable="true"
          :class="['shift-card', attendanceClass(shift)]"
        >
          <div class="shift-header">
            <EmployeeAvatar :name="shift.employee?.name ?? `员工 ${shift.employeeId}`" :employee-no="shift.employee?.employeeNo ?? 'EMP'" size="sm" />
            <el-tag :type="attendanceTagType(shift)">{{ attendanceLabel(shift) }}</el-tag>
          </div>
          <el-tag size="small">{{ ShiftTypeLabel[shift.shiftType as keyof typeof ShiftTypeLabel] }}</el-tag>
          <small>计划：{{ shift.startTime?.slice(0, 5) }} - {{ shift.endTime?.slice(0, 5) }}</small>
          <small v-if="shift.actualStartTime">实际：{{ shift.actualStartTime.slice(0, 5) }}<template v-if="shift.actualEndTime"> - {{ shift.actualEndTime.slice(0, 5) }}</template></small>
          <div class="shift-actions" v-if="shift.shiftType !== 'REST'">
            <el-button v-if="shift.status === 'PENDING' || shift.status === 'CONFIRMED'" size="small" type="success" @click="handleCheckIn(shift)">签到</el-button>
            <el-button v-if="shift.status === 'CHECKED_IN'" size="small" type="warning" @click="handleCheckOut(shift)">签退</el-button>
            <el-tag v-if="shift.status === 'CHECKED_OUT'" size="small" type="info">已签退</el-tag>
          </div>
        </article>
      </div>
    </div>
    <div class="grid cols-2 lower">
      <div class="panel">
        <h2>换班申请</h2>
        <ShiftSwapRequest />
      </div>
      <div class="panel">
        <h2>排班统计</h2>
        <el-statistic title="本月预估工时" :value="shifts.list.length * 5" suffix="小时" />
      </div>
    </div>
    <el-drawer v-model="formVisible" title="创建排班"><ScheduleForm @submit="save" /></el-drawer>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { MagicStick, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import AppLayout from '@/components/layout/AppLayout.vue';
import EmployeeAvatar from '@/components/common/EmployeeAvatar.vue';
import StoreSelector from '@/components/common/StoreSelector.vue';
import ScheduleForm from './ScheduleForm.vue';
import ShiftSwapRequest from './ShiftSwapRequest.vue';
import { ShiftTypeLabel } from '@/constants/enums';
import { createShift, autoGenerateShifts, checkInShift, checkOutShift } from '@/api/shift';
import { useShiftStore } from '@/stores/shiftStore';
import type { Shift, AttendanceStatus } from '@/types/shift';

const shifts = useShiftStore();
const filters = reactive<Record<string, unknown>>({});
const formVisible = ref(false);
const weekDays = ['06-15', '06-16', '06-17', '06-18', '06-19', '06-20', '06-21'];

async function load() {
  await shifts.load(filters);
}

async function save(payload: Record<string, unknown>) {
  await createShift(payload);
  formVisible.value = false;
  await load();
}

async function autoPlan() {
  await autoGenerateShifts({ storeId: Number(filters.storeId ?? 1), date: new Date().toISOString().slice(0, 10) });
  ElMessage.success('已生成排班方案');
  await load();
}

async function handleCheckIn(shift: Shift) {
  await checkInShift(shift.id);
  ElMessage.success(`${shift.employee?.name ?? '员工'} 签到成功`);
  await load();
}

async function handleCheckOut(shift: Shift) {
  await checkOutShift(shift.id);
  ElMessage.success(`${shift.employee?.name ?? '员工'} 签退成功`);
  await load();
}

function attendanceLabel(shift: Shift): string {
  if (shift.shiftType === 'REST') return '休息';
  const map: Record<AttendanceStatus, string> = {
    NORMAL: '正常',
    LATE: '迟到',
    EARLY: '早退',
    LATE_AND_EARLY: '迟到+早退',
    ABSENT: '缺勤'
  };
  if (!shift.attendanceStatus && (shift.status === 'PENDING' || shift.status === 'CONFIRMED')) return '待签到';
  if (shift.status === 'CHECKED_IN') return '在岗';
  return map[shift.attendanceStatus ?? 'ABSENT'] ?? '待签到';
}

function attendanceTagType(shift: Shift): 'success' | 'warning' | 'danger' | 'info' {
  if (shift.shiftType === 'REST') return 'info';
  if (!shift.attendanceStatus && shift.status !== 'CHECKED_IN') return 'info';
  if (shift.status === 'CHECKED_IN') return 'success';
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    NORMAL: 'success',
    LATE: 'danger',
    EARLY: 'warning',
    LATE_AND_EARLY: 'danger',
    ABSENT: 'info'
  };
  return map[shift.attendanceStatus ?? 'ABSENT'] ?? 'info';
}

function attendanceClass(shift: Shift): string {
  if (shift.shiftType === 'REST') return '';
  if (shift.status === 'CHECKED_IN') return 'card-checked-in';
  if (shift.status === 'CHECKED_OUT' && shift.attendanceStatus === 'NORMAL') return 'card-normal';
  if (shift.attendanceStatus === 'LATE' || shift.attendanceStatus === 'LATE_AND_EARLY') return 'card-late';
  if (shift.attendanceStatus === 'EARLY') return 'card-early';
  return '';
}

onMounted(load);
</script>

<style scoped>
.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}

.week-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(130px, 1fr));
  gap: 12px;
  overflow-x: auto;
}

.day-col {
  min-height: 260px;
  border-left: 1px solid #d9d2c4;
  padding-left: 12px;
}

.shift-card {
  margin-top: 12px;
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: #f4f1ea;
}

.shift-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shift-actions {
  display: flex;
  gap: 6px;
}

.card-checked-in {
  border-left: 3px solid #67c23a;
}

.card-normal {
  border-left: 3px solid #67c23a;
}

.card-late {
  border-left: 3px solid #f56c6c;
  background: #fef0f0;
}

.card-early {
  border-left: 3px solid #e6a23c;
  background: #fdf6ec;
}

.lower {
  margin-top: 18px;
}
</style>
