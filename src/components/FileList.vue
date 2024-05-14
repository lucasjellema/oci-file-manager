<template>
    {{ filesStore.files }}
</template>

<script>
import { useFilesStore } from "./stores/filesStore";
const filesStore = useFilesStore()

const onMounted = () => {
    filesStore.refreshFiles()
}

</script>