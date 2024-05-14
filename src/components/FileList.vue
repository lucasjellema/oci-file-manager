<template>
    {{ files }}
</template>

<script>
import { computed } from "vue";
import { useFilesStore } from "../stores/filesStore";
const filesStore = useFilesStore()

const files = computed(() => {
    return filesStore.files
})

const onMounted = () => {
    filesStore.refreshFiles()
}

</script>