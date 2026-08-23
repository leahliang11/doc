<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ overwrite: []; discard: [] }>()
</script>

<template>
  <div class="modal-mask">
    <div class="modal">
      <div class="modal-header">
        <i class="ri-error-warning-line modal-icon"></i>
        <span>文档冲突</span>
      </div>
      <p class="modal-body">{{ message }}</p>
      <p class="modal-hint">文件已被他人修改。你可以用你的内容覆盖（基于最新版本重新保存），或放弃你的改动加载远端最新版本。</p>
      <div class="modal-footer">
        <button class="btn" @click="emit('discard')">放弃我的改动</button>
        <button class="btn btn-primary" @click="emit('overwrite')">用我的覆盖</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
.modal {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  min-width: 420px;
  max-width: 520px;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
.modal-icon {
  color: var(--orange);
  font-size: 22px;
}
.modal-body {
  font-size: 14px;
  color: var(--text);
  margin-bottom: 8px;
}
.modal-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}
.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
