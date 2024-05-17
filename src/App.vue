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
const selectedBucket = ref(null)
const bucketToEdit = ref(null)
const showBucketEditorPopup = ref(false)

//const drawer = ref(true)
const bucketPAR = ref(null)
const bucketName = computed(() => {
  // /b/website/o/
  // find the substring that starts after /b/ and ends before /o
  // return the substring
  if (!selectedBucket.value) return null

  return extractBucketName(selectedBucket.value.bucketPAR)
})

const extractBucketName = (bucketPAR) => {
  const start = bucketPAR.indexOf('/b/') + 3
  const end = bucketPAR.substring(start).indexOf('/o')
  return bucketPAR.substring(start, start + end)
}

const bucketHeaders = ref([
  { title: 'Label', value: 'label' },
  { title: 'Name', value: 'bucketName' },
  { title: 'Actions', value: 'actions' }
])


const editBucket = (bucket, index) => {
  //  filesStore.editBucket(item, index)
  bucketToEdit.value = bucket
  showBucketEditorPopup.value = true
}
const removeBucket = (bucket, index) => {
  filesStore.removeBucket(bucket.bucketName)
}

const saveBucket = () => {
  bucketToEdit.value.bucketName = extractBucketName(bucketToEdit.value.bucketPAR)
  filesStore.saveBucket(bucketToEdit.value.bucketName, bucketToEdit.value.bucketPAR, bucketToEdit.value.label, bucketToEdit.value.description)
  showBucketEditorPopup.value = false
}

const addAndEditBucket = () => {
  bucketToEdit.value = {
    bucketName: "", label: "New Bucket", description: "", bucketPAR: ""
  }
  showBucketEditorPopup.value = true
}



// when bucketPAR changes, inform filestore to refresh
watch(selectedBucket, () => {
  filesStore.setPAR(selectedBucket.value.bucketPAR)
  bucketPAR.value = selectedBucket.value.bucketPAR
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
            <h2 v-if="selectedBucket">{{ bucketName + ' (' + selectedBucket?.label + ')' }}</h2>
            <Tree :value="filesTree" v-model:selectionKeys="selectedKey" scrollable scrollHeight="700px"
              class="w-full md:w-30rem tree-override" ref="treeRef" selectionMode="single" :filter="true"
              filterPlaceholder="Enter search term" @node-select="nodeSelect" @node-unselect="nodeUnselect">
              <template #default="slotProps">
                <b>{{ slotProps.node.label }}</b>
              </template>
              <template #file="slotProps">
                <a :href="selectedBucket.bucketPAR + slotProps.node.data" target="_blank" rel="noopener noreferrer"
                  class="text-700 hover:text-primary">{{ slotProps.node.label }}</a>
                <v-img height="50" :src="selectedBucket.bucketPAR + slotProps.node.data" class="thumbnail"
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
              <v-expansion-panel title="Bucket Management" collapse-icon="mdi-pail-outline"
                expand-icon="mdi-pail-outline">
                <v-expansion-panel-text>

                  <v-data-table :headers="bucketHeaders" :items="filesStore.rememberedBuckets" item-key="bucketName"
                    class="elevation-1">
                    <template v-slot:item.actions="{ item, index }">
                      <v-icon small @click="editBucket(item, index)">
                        mdi-pencil
                      </v-icon>
                      <v-icon small @click="removeBucket(item, index)">
                        mdi-delete
                      </v-icon>
                    </template>
                  </v-data-table>
                  <v-btn prepend-icon="mdi-pail-plus-outline" @click="addAndEditBucket()" class="mt-4 mb-5">Add
                    Bucket</v-btn>
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
        <v-navigation-drawer location="right" width="700" rail-width="150" expand-on-hover rail>
          <v-img src="mdi-folder-outline"></v-img>
          <v-icon large>
            mdi-pail-outline
          </v-icon>
          <h2>OCI Buckets</h2>
          <v-divider class="my-10"></v-divider>

          <v-radio-group v-model="selectedBucket" row>
            <v-radio v-for="item in filesStore.rememberedBuckets" :key="item.bucketName" :label="item.label"
              :value="item" :title="item.bucketName + ' - ' + item.description"></v-radio>
          </v-radio-group>

        </v-navigation-drawer>
      </v-container>
    </v-main>
  </v-app>
  <v-dialog v-model="showBucketEditorPopup" max-width="800px">

    <v-card>
      <v-card-title>Bucket Editor</v-card-title>

      <v-card-text>
        <v-text-field v-model="bucketToEdit.label" label="Label"></v-text-field>
        <v-text-field v-model="bucketToEdit.bucketPAR" label="Pre Authenticated Request URL"
          hint="enter the PAR for a Bucket in OCI Object Storage (with at least read and list objects privileges)"></v-text-field>
        <v-text-field v-model="bucketToEdit.description" label="Description"></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="showBucketEditorPopup = false">Cancel</v-btn>
        <v-btn color="blue darken-1" text @click="saveBucket">Save</v-btn>
      </v-card-actions>
    </v-card>

  </v-dialog>
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
