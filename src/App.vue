<script setup>

import { onMounted } from 'vue';
import { useFilesStore } from "./stores/filesStore";
const filesStore = useFilesStore()

onMounted(() => {
  filesStore.refreshFiles()
})


const submitData = () => {
  const fileInput = document.getElementById('uploadedFile');
  const file = fileInput.files[0]; // Get the first file from the file input

  if (file) {
    filesStore.submitBlob(file, file.name)
    fileInput.value = ''
  }
}

</script>

<template>
  <div>
    <ul>
      <li v-for="file in  filesStore.files ">
        <a :href="filesStore.PAR + file.name">{{ file.name }}</a>
        <img :src="filesStore.PAR + file.name" v-if="file.name.toLowerCase().endsWith('.jpg')" style="height: 50px;" />
      </li>
    </ul>
    <br />
    <h2>Upload File</h2>
    <label for="uploadedFile">Upload a file:</label>
    <input type="file" id="uploadedFile" accept="*/*">
    <br /><br />
    <button type="button" @click="submitData()">Send file to Bucket</button>
  </div>
</template>
