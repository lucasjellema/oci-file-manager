<script setup>

import { onMounted } from 'vue';
import { useFilesStore } from "./stores/filesStore";
const filesStore = useFilesStore()

onMounted(() => {
  filesStore.refreshFiles()
})


const submitData = () => {
  const fileInput = document.getElementById('uploadedFile');
  const files = fileInput.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file) {
      filesStore.submitBlob(file, file.name)
    }
  }
  fileInput.value = ''
}

</script>

<template>
  <div>
    <ul>
      <li v-for="file in  filesStore.files ">
        <span v-if="file.isFolder">+{{ file.name }}</span>
        <div v-else>
          <span v-if="file.folderName">&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <a :href="filesStore.PAR + file.fullname">{{ file.name }}</a>
          <img :src="filesStore.PAR + file.fullname" v-if="file.name.toLowerCase().endsWith('.jpg')"
            style="height: 50px;" />
        </div>
      </li>
    </ul>
    <br />
    <h2>Upload File</h2>
    <label for="uploadedFile">Upload a file:</label>
    <input type="file" id="uploadedFile" accept="*/*" multiple>
    <br /><br />
    <button type="button" @click="submitData()">Send file to Bucket</button>
  </div>
</template>
