<script setup>

import { onMounted, computed } from 'vue';
import { useFilesStore } from "./stores/filesStore";

import JSZip from 'jszip';

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
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = new JSZip();
        zip.loadAsync(file).then(async (contents) => {
          const files = Object.values(contents.files);
          for (const file of files) {
            const blob = await zip.file(file.name).async('blob')
            const relativePath = file.dir ? file.dir + '/' + file.name : file.name
            filesStore.submitBlob(blob, relativePath)
          }
        })
      } else {
        filesStore.submitBlob(file, file.name)
      }
    }
  }
  fileInput.value = ''
}

const expandedFolders = computed(() => {
  return filesStore.files.filter(file => file.isFolder && file.isExpanded).map(file => file.name)
})

const expandFolder = (folder) => {
  folder.isExpanded = !folder.isExpanded
}

const handleFileUpload = async (event) => {
  const files = event.target.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(file.name, file.type, file.size, file.lastModified);
  }
}

</script>

<template>

  <v-app>
    <v-app-bar app>
      <v-toolbar-title>OCI File Manager (aka The Bucket Browser)
      </v-toolbar-title>
      <v-img src="/app-bar-background-conclusion.jpg" height="80"></v-img>
    </v-app-bar>
    <v-main>
      <div>
        <div v-for="file in  filesStore.files ">
          <span :title="'click to ' + (file.isExpanded ? 'collapse' : 'expand')" v-if="file.isFolder"
            @click="expandFolder(file)">{{ file.isExpanded ? '▼' : '▶' }}{{
          file.name }}</span>
          <div v-if="!file.isFolder && (!file.folderName || expandedFolders.includes(file.folderName))">
            <span v-if="file.folderName">&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <a :href="filesStore.PAR + file.fullname">{{ file.name }}</a>
            <img :src="filesStore.PAR + file.fullname" v-if="file.name.toLowerCase().endsWith('.jpg')"
              style="height: 50px;" />
          </div>
        </div>

        <br />
        <h2>Upload File</h2>
        <v-file-input id="uploadedFile" label="Upload file(s)" @change="handleFileUpload" accept="*/*"
          :multiple="true"></v-file-input>
        <br /><br />

        <v-btn @click="submitData" prepend-icon="mdi-upload-box">Send file(s) to Bucket</v-btn>
      </div>
    </v-main>
  </v-app>

</template>
