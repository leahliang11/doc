<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="placeholder">
    <i class="ri-hammer-line placeholder-icon"></i>
    <p class="placeholder-title">{{ label }}</p>
    <p class="placeholder-desc">建设中，Week 5+ 实现</p>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-tertiary);
}
.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.placeholder-title {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.placeholder-desc {
  font-size: 13px;
}
</style>
