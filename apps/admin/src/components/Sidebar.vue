<script setup lang="ts">
import { ref, onMounted } from 'vue'
defineProps<{
  route: string
  navGroups: { title: string; items: { path: string; label: string; icon: string }[] }[]
}>()
const emit = defineEmits<{ navigate: [path: string] }>()
const collapsed = ref(false)
onMounted(() => {
  collapsed.value = localStorage.getItem('admin:sidebar-collapsed') === '1'
})
function toggleCollapsed() {
  collapsed.value = !collapsed.value
  localStorage.setItem('admin:sidebar-collapsed', collapsed.value ? '1' : '0')
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="logo">
        <i class="ri-book-open-line logo-icon"></i>
        <span class="logo-text">JoyMaaS 文档后台</span>
      </div>
      <button class="collapse-btn" :title="collapsed ? '展开侧边栏' : '收起侧边栏'" @click="toggleCollapsed">
        <i :class="collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'"></i>
      </button>
    </div>
    <nav class="sidebar-nav">
      <template v-for="group in navGroups" :key="group.title">
        <div class="nav-group-title">{{ group.title }}</div>
        <a
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: route === item.path }"
          :title="collapsed ? item.label : undefined"
          @click="emit('navigate', item.path)"
        >
          <i :class="item.icon" class="nav-icon"></i>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      </template>
    </nav>
  </aside>
</template>
