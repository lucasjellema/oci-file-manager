<script setup>

import { onMounted } from 'vue';
import { useFilesStore } from "./stores/filesStore";
const filesStore = useFilesStore()

onMounted(() => {
  filesStore.refreshFiles()
})

</script>

<template>
  <ul>
    <li v-for="file in filesStore.files">
      {{ file }}
    </li>
  </ul>
</template>
