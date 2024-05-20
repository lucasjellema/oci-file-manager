<script setup>

import { onMounted, computed, ref, watch } from 'vue';
import { useFilesStore } from "./stores/filesStore";

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode'

import Tree from 'primevue/tree';

const filesStore = useFilesStore()
const targetFolder = ref(null)
const uploadFileInput = ref(null)
const expandZipfiles = ref(false)
const selectedKey = ref(null);
const expandedKeys = ref({});
const treeref = ref(null);

const showImageThumbnails = ref(false)
const showQRCode = ref(false)
const qrcodeFile = ref(null)
const selectedBucket = ref(null)
const bucketToEdit = ref(null)
const showBucketEditorPopup = ref(false)
const nameOfDownloadZipFile = ref(null)
const allowReadInShare = ref(true)
const allowWriteInShare = ref(true)
const labelForShare = ref(null)

const downloadMultipleFilesAsZip = ref(false)

const bucketName = computed(() => {
  if (!selectedBucket.value) return null
  return extractBucketName(selectedBucket.value.bucketPAR)
})

const computedBucketShareURL = computed(() => {
  if (!selectedBucket.value) return null
  return window.location.origin + window.location.pathname
    + '?bucketPAR=' + selectedBucket.value.bucketPAR
    + '&label=' + encodeURIComponent(labelForShare.value ?? selectedBucket.value.label)
    + '&permissions=' + (selectedBucket.value.readAllowed && allowReadInShare.value ? 'r' : '') + (selectedBucket.value.writeAllowed && allowWriteInShare.value ? 'w' : '')
})

watch(computedBucketShareURL, () => {
  generateQRCodeCodeForShareURL(computedBucketShareURL.value)
})

const copyShareURLToClipboard = () => {
  // copy computedBucketShareURL to clipboard
  navigator.clipboard.writeText(computedBucketShareURL.value)
}

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
  bucketToEdit.value = bucket
  showBucketEditorPopup.value = true
}
const removeBucket = (bucket, index) => {
  filesStore.removeBucket(bucket.bucketName)
}

const saveBucket = () => {
  bucketToEdit.value.bucketName = extractBucketName(bucketToEdit.value.bucketPAR)
  filesStore.saveBucket(bucketToEdit.value.bucketName, bucketToEdit.value.bucketPAR, bucketToEdit.value.label, bucketToEdit.value.description, bucketToEdit.value.readAllowed, bucketToEdit.value.writeAllowed)
  showBucketEditorPopup.value = false
}

const addAndEditBucket = () => {
  bucketToEdit.value = {
    bucketName: "", label: "New Bucket", description: "", bucketPAR: ""
  }
  showBucketEditorPopup.value = true
}

const initializeBucket = (bucket) => {
  filesStore.setPAR(bucket.bucketPAR)
  nameOfDownloadZipFile.value = bucket.bucketName + ".zip"
  labelForShare.value = bucket.label
}


// when bucketPAR changes, inform filestore to refresh
watch(selectedBucket, (newVal, oldVal) => {
  if (!newVal) return
  initializeBucket(newVal)
})

const filesTree = computed(() => {
  return filesStore.getFilesTree()
})

onMounted(() => {
  // inspect query params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('bucketPAR')) {
    // http://localhost:5173/oci-file-manager/?bucketPAR=https://objectstorage.us-ashburn-1.oraclecloud.com/p/3ZvD2n18VN6y/n/idtwlqf2hanz/b/website/o/&label=Walk&permissions=rw
    const label = urlParams.get('label')
    const bucketPAR = urlParams.get('bucketPAR')
    const bucketName = extractBucketName(bucketPAR)
    const permissions = urlParams.get('permissions') ?? "rw"
    // read is true if permissions contains r
    const readAllowed = permissions.includes('r')
    // write is true if permissions contains w
    const writeAllowed = permissions.includes('w')
    const bucket = filesStore.saveBucket(bucketName, bucketPAR, label, 'created from URL query parameters', readAllowed, writeAllowed)
    selectedBucket.value = bucket
  }
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


const generateQRCodeCodeForShareURL = (shareURL) => {
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
  var canvas = document.getElementById('canvasQRCodeForShareURL')
  QRCode.toCanvas(canvas, shareURL, opts, function (error) {
    if (error) console.error(error)
  })
}

const submitData = () => {
  const fileInput = uploadFileInput.value  // document.getElementById('uploadedFile');
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
  fileInput.reset()
}


// const handleFileUpload = async (event) => {
//   const files = event.target.files;
//   for (let i = 0; i < files.length; i++) {
//     const file = files[i];
//     console.log(file.name, file.type, file.size, file.lastModified);

//   }
// }

watch(downloadMultipleFilesAsZip, () => {
  for (let node of filesTree.value) {
    if (node.nodeType === 'folder') {
      setSelectableForNode(node, downloadMultipleFilesAsZip.value);
    }
  }
})

const setSelectableForNode = (node, selectable) => {
  if (node.nodeType === 'folder') {
    node.selectable = selectable;
    if (node.children && node.children.length) {
      for (let child of node.children) {
        if (child.nodeType === 'folder') {
          setSelectableForNode(child, selectable)
        }
      }
    }
  }
};


const downloadZipfile = () => {
  // create a collection of all key values in selectedKey.value
  const selectedFiles = Object.keys(selectedKey.value).filter(key => !key.endsWith('-folder'))
  exportFilesToZip(selectedFiles, nameOfDownloadZipFile.value)
}


const addFileToZip = (promises, file, zip) => {
  promises.push(new Promise((resolve, reject) => {
    filesStore.getFile(file).then(blob => {
      zip.file(file, blob);
      resolve();
    })
  }));
}
const exportFilesToZip = (files, zipname) => {
  const zip = new JSZip();
  const promises = [];
  files.forEach(file => {
    addFileToZip(promises, file, zip);
  })
  // only when all files have been added can we generate the zip; that is when all promises are resolved

  Promise.all(promises)
    .then(results => {
      // Generate the zip file and trigger download
      zip.generateAsync({ type: "blob" })
        .then(function (content) {
          saveAs(content, zipname);
        });
    })
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

const selectAll = () => {
  const selectAllNodes = (nodes) => {
    const keys = {};
    const traverse = (node) => {
      keys[node.key] = true;
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    nodes.forEach(traverse);
    return keys;
  };

  selectedKey.value = selectAllNodes(filesTree.value);
}

const unselectAll = () => {
  selectedKey.value = {};
}

const expandAll = () => {
  for (let node of filesTree.value) {
    expandNode(node);
  }

  expandedKeys.value = { ...expandedKeys.value };
};

const collapseAll = () => {
  expandedKeys.value = {};
};

const expandNode = (node) => {
  if (node.children && node.children.length) {
    expandedKeys.value[node.key] = true;
    for (let child of node.children) {
      expandNode(child);
    }
  }
};
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
            <h2 v-if="selectedBucket">{{ bucketName + ' (' + selectedBucket?.label + ')'
              + (!selectedBucket?.writeAllowed ? '(read only)' : '') }}</h2>
            <v-container fluid v-if="selectedBucket">
              <v-row>
                <v-col cols="6">
                  <v-icon @click="expandAll" icon="mdi-expand-all-outline" class="ml-4 mt-3"
                    title="Expand all (nested) folders"></v-icon>
                  <v-icon @click="collapseAll" icon="mdi-collapse-all-outline" class="ml-2 mt-3"
                    title="Collapse all expanded (nested) folders"></v-icon>
                </v-col>
                <v-col cols="5" v-if="downloadMultipleFilesAsZip">
                  <v-icon @click="selectAll" icon="mdi-select-all" class="ml-10 mt-3"
                    title="Select all files and (nested) folders"></v-icon>
                  <v-icon @click="unselectAll" icon="mdi-selection-off" class="ml-2 mt-3"
                    title="Clear current selection"></v-icon>
                </v-col>
                <v-col cols="1">
                  <v-icon @click="filesStore.refreshFiles" icon="mdi-refresh" class="ml-4 mt-3"
                    title="Refresh Tree"></v-icon>
                </v-col>
              </v-row>
            </v-container>
            <Tree :value="filesTree" v-model:selectionKeys="selectedKey" scrollable scrollHeight="700px"
              class="w-full md:w-30rem tree-override" ref="treeref"
              :selectionMode="downloadMultipleFilesAsZip ? 'checkbox' : 'single'" v-model:expandedKeys="expandedKeys"
              :filter="true" filterPlaceholder="Enter search term" @node-select="nodeSelect"
              @node-unselect="nodeUnselect">
              <template #default="slotProps">
                <b>{{ slotProps.node.label }}</b>
              </template>
              <template #file="slotProps">
                <div v-if="selectedBucket?.readAllowed">
                  <a :href="selectedBucket.bucketPAR + slotProps.node.data" target="_blank" rel="noopener noreferrer"
                    class="text-700 hover:text-primary">{{ slotProps.node.label }}</a>
                  <v-img height="50" :src="selectedBucket.bucketPAR + slotProps.node.data" class="thumbnail"
                    v-if="showImageThumbnails && (slotProps.node.data.toLowerCase().endsWith('.jpg') || slotProps.node.data.toLowerCase().endsWith('.gif') || slotProps.node.data.toLowerCase().endsWith('.png'))"></v-img>
                </div>
                <div v-else>
                  {{ slotProps.node.label }}
                </div>
              </template>
            </Tree>
            <div v-if="showQRCode && selectedBucket?.readAllowed">
              <h2 v-if="qrcodeFile">QR Code for {{ qrcodeFile }}</h2>
              <canvas id="canvas"></canvas>
            </div>
          </v-col>
          <v-col cols=" 4" offset="1" mr="10">
            <v-expansion-panels :multiple="false">
              <v-expansion-panel title="Upload File(s)" collapse-icon="mdi-upload" expand-icon="mdi-upload-outline"
                v-if="selectedBucket?.writeAllowed">
                <v-expansion-panel-text>
                  <v-file-input id="uploadedFile" ref="uploadFileInput" label="Upload file(s)" accept="*/*"
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
              <v-expansion-panel title="Download" collapse-icon="mdi-download" expand-icon="mdi-download-outline"
                v-if="selectedBucket?.readAllowed">
                <v-expansion-panel-text>
                  <v-checkbox v-model="downloadMultipleFilesAsZip"
                    label="Allow multiple file download as single zipfile"
                    hint="Select multiple files and download them as a single zip file"
                    class="ma-10 mt-2 mb-5"></v-checkbox>
                  <v-text-field v-model="nameOfDownloadZipFile" label="Zip filename"
                    class="ma-10 mt-2 mb-5"></v-text-field>
                  <v-btn @click="downloadZipfile" prepend-icon="mdi-download-box" mt="30">Download selected file(s) as
                    zip</v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Share" collapse-icon="mdi-share" expand-icon="mdi-share" v-if="selectedBucket">
                <v-expansion-panel-text>
                  <v-text-field v-model="labelForShare" default-value="selectedBucket?.label"
                    label="Label"></v-text-field>
                  <v-checkbox v-model="allowReadInShare" label="Allow Read Access"
                    v-if="selectedBucket?.readAllowed"></v-checkbox>
                  <v-checkbox v-model="allowWriteInShare" label="Allow Write Access"
                    v-if="selectedBucket?.writeAllowed"></v-checkbox>
                  <v-text-field v-model="computedBucketShareURL" label="URL to share" :readonly="true"
                    class="mt-2 mb-5"></v-text-field>
                  <v-btn @click="copyShareURLToClipboard" prepend-icon="mdi-content-copy" mt="30">Copy Share URL to
                    Clipboard</v-btn>

                  <div>
                    <h2>QR Code to Share</h2>
                    <canvas id="canvasQRCodeForShareURL"></canvas>
                  </div>
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
        <v-checkbox v-model="bucketToEdit.readAllowed" label="Read Allowed" class="mt-1"></v-checkbox>
        <v-checkbox v-model="bucketToEdit.writeAllowed" label="Write Allowed" class="mt-1"></v-checkbox>
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
