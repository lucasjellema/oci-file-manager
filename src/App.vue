<script setup>

import { onMounted } from 'vue';
import { useFilesStore } from "./stores/filesStore";
const filesStore = useFilesStore()

onMounted(() => {
  filesStore.refreshFiles()
})

</script>

<template>
  {{ filesStore.files }}
</template>
