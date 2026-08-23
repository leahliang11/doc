<script setup lang="ts">
defineProps<{
  route: string
  navGroups: { title: string; items: { path: string; label: string; icon: string }[] }[]
}>()
const emit = defineEmits<{ navigate: [path: string] }>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <i class="ri-book-open-line logo-icon"></i>
        <span class="logo-text">JoyMaaS 文档后台</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <template v-for="group in navGroups" :key="group.title">
        <div class="nav-group-title">{{ group.title }}</div>
        <a
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: route === item.path }"
          @click="emit('navigate', item.path)"
        >
          <i :class="item.icon" class="nav-icon"></i>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      </template>
    </nav>
  </aside>
</template>
