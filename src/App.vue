<script setup>

import { onMounted, computed, ref, watch } from 'vue';
import { useFilesStore } from "./stores/filesStore";

import JSZip from 'jszip';
import QRCode from 'qrcode'

import Tree from 'primevue/tree';

const filesStore = useFilesStore()
const targetFolder = ref(null)
const expandZipfiles = ref(false)
const selectedKey = ref(null);

const showImageThumbnails = ref(false)
const showQRCode = ref(false)
const qrcodeFile = ref(null)

//const drawer = ref(true)
const bucketPAR = ref(null)
const bucketName = computed(() => {
  // /b/website/o/
  // find the substring that starts after /b/ and ends before /o
  // return the substring
  if (!bucketPAR.value) return null
  const start = bucketPAR.value.indexOf('/b/') + 3
  const end = bucketPAR.value.substring(start).indexOf('/o')
  return bucketPAR.value.substring(start, start + end)
})

const clearRememberedPARs = () => {
  filesStore.clearRememberedPARs()
}

// when bucketPAR changes, inform filestore to refresh
watch(bucketPAR, () => {
  filesStore.setPAR(bucketPAR.value)
})
const filesTree = computed(() => {
  return filesStore.getFilesTree()
})

onMounted(() => {
  filesStore.refreshFiles()
})

const renderQRCode = (myurl) => {
  var opts = {
    errorCorrectionLevel: 'H',
    type: 'image/jpeg',
    quality: 0.3,
    margin: 1,
    scale: 5,
    color: {
      dark: "#010599FF",
      light: "#FFFFFF"
    }
  }
  var canvas = document.getElementById('canvas')

  QRCode.toCanvas(canvas, myurl, opts, function (error) {
    if (error) console.error(error)
  })
}

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


const handleFileUpload = async (event) => {
  const files = event.target.files;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(file.name, file.type, file.size, file.lastModified);

  }
}

const nodeSelect = (node) => {
  if (node.nodeType === 'file') {
    const url = filesStore.PAR.value + node.data
    qrcodeFile.value = node.data
    renderQRCode(url)
  }
}

const nodeUnselect = (node) => {
  //hide qrcode
  const canvas = document.getElementById('canvas')
  if (canvas) canvas.width = canvas.width; // clears the canvas content
  qrcodeFile.value = null

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
              class="w-full md:w-30rem tree-override" ref="treeRef" selectionMode="single" :filter="true"
              filterPlaceholder="Enter search term" @node-select="nodeSelect" @node-unselect="nodeUnselect">
              <template #default="slotProps">
                <b>{{ slotProps.node.label }}</b>
              </template>
              <template #file="slotProps">
                <a :href="bucketPAR + slotProps.node.data" target="_blank" rel="noopener noreferrer"
                  class="text-700 hover:text-primary">{{ slotProps.node.label }}</a>
                <v-img height="50" :src="bucketPAR + slotProps.node.data" class="thumbnail"
                  v-if="showImageThumbnails && (slotProps.node.data.toLowerCase().endsWith('.jpg') || slotProps.node.data.toLowerCase().endsWith('.gif') || slotProps.node.data.toLowerCase().endsWith('.png'))"></v-img>
              </template>
            </Tree>
            <v-divider class="my-10"></v-divider>
            <div v-if="showQRCode">
              <h2 v-if="qrcodeFile">QR Code for {{ qrcodeFile }}</h2>
              <canvas id="canvas"></canvas>
            </div>
          </v-col>
          <v-col cols=" 4" offset="1" mr="10">
            <v-expansion-panels :multiple="false">
              <v-expansion-panel title="Upload File(s)" collapse-icon="mdi-upload" expand-icon="mdi-upload-outline">
                <v-expansion-panel-text>
                  <v-file-input id="uploadedFile" label="Upload file(s)" @change="handleFileUpload" accept="*/*"
                    :multiple="true"></v-file-input>
                  <v-checkbox v-model="expandZipfiles" label="Expand zipfile(s)"
                    hint="Submit files in zip archive one by one" class="ma-10 mt-2 mb-5"></v-checkbox>
                  <v-combobox v-model="targetFolder" :items="filesStore.foldersInBucket" label="Target Folder"
                    hint="Optionally select or define a folder to upload the file(s) to"
                    append-icon="mdi-folder-arrow-up" persistent-hint class="ma-10 mt-2 mb-5" </v-combobox>
                    <v-btn @click="submitData" prepend-icon="mdi-upload-box" mt="30">Send file(s) to Bucket</v-btn>
                    <v-img src="mdi-folder-outline"></v-img>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Settings" collapse-icon="mdi-cog-outline" expand-icon="mdi-cog-outline">
                <v-expansion-panel-text>
                  <v-checkbox v-model="showImageThumbnails" label="Show Image Thumbnails"
                    hint="Show thumbnail images in file tree for files of type jpg, gif, png"
                    class="mt-2 "></v-checkbox>
                  <v-checkbox v-model="showQRCode" label="Show QR Code for selected file"
                    hint="Show a QR Code for downloading the file currently selected in the tree" class=""></v-checkbox>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

          </v-col>
        </v-row>
        <v-navigation-drawer location="right" width="700" rail-width="100" expand-on-hover rail>
          <v-img src="mdi-folder-outline"></v-img>
          <v-icon large>
            mdi-pail-outline
          </v-icon>
          <h2>OCI Bucket</h2>
          <h3>{{ bucketName }}</h3>
          <v-divider class="my-10"></v-divider>
          <v-combobox v-model="bucketPAR" :items="filesStore.getRememberedPARs()" label="Pre Authenticated Request"
            hint="enter the PAR for a Bucket in OCI Object Storage" single-line hide-details></v-combobox>
          <v-btn @click="clearRememberedPARs" prepend-icon="mdi-pail-off-outline" mt="30">Forget Buckets</v-btn>
        </v-navigation-drawer>
      </v-container>
    </v-main>
  </v-app>

</template>
<style>
/*change the number below to scale to the appropriate size*/
.thumbnail:hover {
  transform: scale(5);
  z-index: 900;
}

/* this class is defined in PrimeVue tree; it gets overridden by a Vuetify style; this next definition corrects this override to marke
   sure that child nodes are indented properly 
*/
.p-treenode-children {
  padding-left: 1rem !important;
}

.p-tree-filter-container .p-tree-filter {
  padding-top: 0px;
  padding-right: 1.125rem !important;
  padding-bottom: 1.125rem !important;
  padding-left: 1.125rem !important;
  margin-top: 10px;

}
</style>
