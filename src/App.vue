<script setup>

import { onMounted, computed, ref } from 'vue';
import { useFilesStore } from "./stores/filesStore";

import JSZip from 'jszip';

import Tree from 'primevue/tree';

const filesStore = useFilesStore()
const targetFolder = ref(null)
const expandZipfiles = ref(false)
const selectedKey = ref(null);

const filesTree = computed(() => {
  return filesStore.getFilesTree()
})

onMounted(() => {
  filesStore.refreshFiles()
})


const submitData = () => {
  const fileInput = document.getElementById('uploadedFile');
  const files = fileInput.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file) {
      if (expandZipfiles.value && file.name.toLowerCase().endsWith('.zip')) {
        const zip = new JSZip();
        zip.loadAsync(file).then(async (contents) => {
          const files = Object.values(contents.files);
          for (const file of files) {
            const blob = await zip.file(file.name).async('blob')
            const relativePath = (targetFolder.value ? targetFolder.value + '/' : '') + (file.dir ? file.dir + '/' + file.name : file.name)
            filesStore.submitBlob(blob, relativePath)
          }
        })
      } else {
        filesStore.submitBlob(file, (targetFolder.value ? targetFolder.value + '/' : '') + file.name)
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

const onNodeHover = (event) => {
  console.log(event)
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
      <v-container fluid>
        <v-row>
          <v-col cols="6">

            <Tree :value="filesTree" v-model:selectionKeys="selectedKey" scrollable scrollHeight="700px"
              class="w-full md:w-30rem tree-override" ref="treeRef" selectionMode="multiple" :filter="true"
              filterPlaceholder="Enter search term">
              <template #default="slotProps">
                <b>{{ slotProps.node.label }}</b>
              </template>
              <template #file="slotProps">
                <a :href="filesStore.PAR + slotProps.node.data" target="_blank" rel="noopener noreferrer"
                  class="text-700 hover:text-primary">{{ slotProps.node.label }}</a>
                <v-img height="50" :src="filesStore.PAR + slotProps.node.data" class="thumbnail"
                  v-if="slotProps.node.data.toLowerCase().endsWith('.jpg')"></v-img>
              </template>

            </Tree>
          </v-col>
          <v-col cols="4" offset="1" mr="10">
            <h2>Upload File</h2>
            <v-file-input id="uploadedFile" label="Upload file(s)" @change="handleFileUpload" accept="*/*"
              :multiple="true"></v-file-input>
            <v-checkbox v-model="expandZipfiles" label="Expand zipfile(s)" hint="Submit files in zip archive one by one"
              class="ma-10 mt-2 mb-5"></v-checkbox>
            <v-combobox v-model="targetFolder" :items="filesStore.foldersInBucket" label="Target Folder"
              hint="Optionally select or define a folder to upload the file(s) to" append-icon="mdi-folder-arrow-up"
              persistent-hint class="ma-10 mt-2 mb-5" </v-combobox>

              <v-btn @click="submitData" prepend-icon="mdi-upload-box" mt="30">Send file(s) to Bucket</v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>

</template>
<style>
/*change the number below to scale to the appropriate size*/
.thumbnail:hover {
  transform: scale(3);
  z-index: 900;
}
</style>
