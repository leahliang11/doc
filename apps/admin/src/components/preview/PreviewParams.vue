<script setup lang="ts">
import { computed } from 'vue'

interface Param {
  name: string
  type: string
  required: boolean
  default?: string
  description: string
}

const props = defineProps<{
  params?: Param[]
}>()

const params = computed<Param[]>(() => (Array.isArray(props.params) ? props.params : []))
</script>

<template>
  <div class="pv-params" v-if="params.length">
    <table>
      <thead>
        <tr>
          <th>参数名</th>
          <th>类型</th>
          <th>必填</th>
          <th>默认值</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in params" :key="p.name">
          <td class="pv-param-name">{{ p.name }}</td>
          <td class="pv-param-type">{{ p.type }}</td>
          <td>
            <span v-if="p.required" class="pv-param-req-yes">是</span>
            <span v-else class="pv-param-req-no">否</span>
          </td>
          <td class="pv-param-default">{{ p.default ?? '-' }}</td>
          <td class="pv-param-desc">{{ p.description }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
