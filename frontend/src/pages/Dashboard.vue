<template>
  <AppLayout>
    <div class="page-title">
      <div>
        <h1>经营仪表盘</h1>
        <p>收入、出勤、门店和待办的实时视图</p>
      </div>
      <el-button-group>
        <el-button type="primary" :icon="Plus">记账</el-button>
        <el-button :icon="Calendar">创建排班</el-button>
        <el-button :icon="User">员工入职</el-button>
      </el-button-group>
    </div>
    <div class="grid cols-3">
      <div class="panel metric" v-for="item in metrics" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
    <div class="grid cols-2 dash-grid">
      <div class="panel"><FinanceChart type="bar" title="收入支出对比" :labels="['1月','2月','3月','4月']" :values="[42,31,52,46]" /></div>
      <div class="panel">
        <h2>员工出勤率</h2>
        <div class="attendance-summary">
          <FinanceChart type="pie" title="" :labels="attendanceLabels" :values="attendanceValues" />
          <div class="attendance-detail">
            <p>正常出勤：<strong>{{ attendance.normal }}</strong></p>
            <p>迟到：<strong class="text-danger">{{ attendance.late }}</strong></p>
            <p>早退：<strong class="text-warning">{{ attendance.early }}</strong></p>
            <p>未打卡：<strong class="text-muted">{{ attendance.absent }}</strong></p>
          </div>
        </div>
      </div>
      <div class="panel"><FinanceChart type="bar" title="各门店营收 TOP" :labels="topStoreLabels" :values="topStoreValues" /></div>
      <div class="panel">
        <h2>待办事项</h2>
        <el-timeline>
          <el-timeline-item v-for="todo in todos" :key="todo.title" :timestamp="`${todo.count} 项`">{{ todo.title }}</el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Calendar, Plus, User } from '@element-plus/icons-vue';
import AppLayout from '@/components/layout/AppLayout.vue';
import FinanceChart from '@/components/common/FinanceChart.vue';
import { fetchDashboardSummary } from '@/api/dashboard';

const summary = ref<any>({});
const metrics = computed(() => [
  { label: '员工总数', value: summary.value.metrics?.employeeCount ?? 0 },
  { label: '在职员工', value: summary.value.metrics?.activeEmployees ?? 0 },
  { label: '待审核财务', value: summary.value.metrics?.pendingTransactions ?? 0 }
]);
const attendance = computed(() => summary.value.attendance ?? { normal: 0, late: 0, early: 0, absent: 0, total: 1, checkedIn: 0, rate: 0 });
const attendanceLabels = computed(() => ['正常', '迟到', '早退', '未打卡']);
const attendanceValues = computed(() => [
  attendance.value.normal,
  attendance.value.late,
  attendance.value.early,
  attendance.value.absent
]);
const todos = computed(() => summary.value.todos ?? []);
const topStoreLabels = computed(() => (summary.value.topStores ?? []).map((item: any) => item.store?.name ?? `门店 ${item.storeId}`));
const topStoreValues = computed(() => (summary.value.topStores ?? []).map((item: any) => Number(item.revenue)));

onMounted(async () => {
  const response = await fetchDashboardSummary() as { data: unknown };
  summary.value = response.data;
});
</script>

<style scoped>
.page-title p {
  color: #697066;
  margin: 8px 0 0;
}

.metric span {
  color: #697066;
}

.metric strong {
  display: block;
  margin-top: 10px;
  font-size: 34px;
}

.dash-grid {
  margin-top: 18px;
}

.attendance-summary {
  display: flex;
  gap: 20px;
  align-items: center;
}

.attendance-detail {
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.text-danger {
  color: #f56c6c;
}

.text-warning {
  color: #e6a23c;
}

.text-muted {
  color: #909399;
}
</style>
