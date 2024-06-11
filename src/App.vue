<script setup>

const version = '0.3.10'
import { onMounted, computed, ref, watch } from 'vue';
import { useFilesStore } from "./stores/filesStore";

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid';

import Tree from 'primevue/tree';

const filesStore = useFilesStore()
const targetFolder = ref(null)
const progressReport = ref({})
const uploadFileInput = ref(null)
const uploadInProgress = ref(false)
// const numberOfFilesUploaded = ref(0)
// const numberOfBytesUploaded = ref(0)
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
const contextFolderForShare = ref(null)
const downloadMultipleFilesAsZip = ref(false)
const flattenFoldersInDownload = ref(false)

const copyPanelIsExpanded = ref(false)
const targetBucketForCopy = ref(null)
const targetFolderForCopy = ref(null)
const copyMultipleFilesAsZip = ref(false)
const nameOfCopyZipFile = ref(null)

const adminEnabled = ref(false) // when not enabled, user cannot change bucket and cannot do bucket management or share


const copyfiles = () => {
  const selectedFiles = Object.keys(selectedKey.value).filter(key => !key.endsWith('-folder'))
  uploadInProgress.value = true
  progressReport.value = { uploadCount: 0, uploadSize: 0, uploadErrorCount: 0, uploadErrors: [], totalToUpload: selectedFiles.length }
  if (copyMultipleFilesAsZip.value) {
    // create a single zip file from all selected files

    const zip = new JSZip();
    const promises = [];
    selectedFiles.forEach(file => {
      addFileToZip(promises, file, zip);
    })
    // only when all files have been added can we generate the zip; that is when all promises are resolved
    // upload the single zip file - called nameOfCopyZipFile

    Promise.all(promises)
      .then(results => {
        // Generate the zip file and copy to target
        zip.generateAsync({ type: "blob" })
          .then(function (content) {
            filesStore.submitBlob(content, (targetBucketForCopy.value.contextFolder ? targetBucketForCopy.value.contextFolder + '/' : '')
              + (targetFolderForCopy.value ? targetFolderForCopy.value + '/' : '') + nameOfCopyZipFile.value, progressReport.value, targetBucketForCopy.value.bucketPAR, false)

          });
      })
  } else { // upload each file individually
    const promises = []
    selectedFiles.forEach(file => {
      promises.push(new Promise((resolve, reject) => {
        filesStore.getFile(file).then(blob => {
          filesStore.submitBlob(blob, (targetBucketForCopy.value.contextFolder ? targetBucketForCopy.value.contextFolder + '/' : '')
            + (targetFolderForCopy.value ? targetFolderForCopy.value + '/' : '') + file, progressReport.value, targetBucketForCopy.value.bucketPAR, false)
        })
      }))
    })
  }
}

const bucketName = computed(() => {
  if (!selectedBucket.value) return null
  return extractBucketName(selectedBucket.value.bucketPAR)
})

const encodeString = (input) => {
  // Convert the string to base64
  let encoded = btoa(input);
  // Make the base64 string URL-safe
  encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return encoded;
}

const decodeString = (encoded) => {
  // Revert the URL-safe base64 string back to a standard base64 string
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');

  // Pad the base64 string with '=' to make it valid
  while (base64.length % 4) {
    base64 += '=';
  }

  // Decode the base64 string
  const decoded = atob(base64);
  // %2F should be replaced with / in the decoded string, and %20 with space
  const d1 = decoded.replace(/%2F/g, '/').replace(/%20/g, ' ');

  return d1;
}



const computedBucketShareURL = computed(() => {
  if (!selectedBucket.value) return null

  const shareableURLQueryParams = 'bucketPAR=' + selectedBucket.value.bucketPAR
    + '&label=' + encodeURIComponent(labelForShare.value ?? selectedBucket.value.label)
    + '&permissions=' + (selectedBucket.value.readAllowed && allowReadInShare.value ? 'r' : '') + (selectedBucket.value.writeAllowed && allowWriteInShare.value ? 'w' : '')
    + '&contextFolder=' + encodeURIComponent(selectedBucket.value.contextFolder ? selectedBucket.value.contextFolder : '')
    + encodeURIComponent(((selectedBucket.value.contextFolder && contextFolderForShare.value) ? '/' : '')
      + (contextFolderForShare.value ? contextFolderForShare.value : '')
    )
  console.log(`Shareable URL = `, shareableURLQueryParams)

  const encodedShareableURLQueryParams = encodeString(shareableURLQueryParams)

  const shareableURL = window.location.origin + window.location.pathname + '?shareableQueryParams=' + encodedShareableURLQueryParams
  return shareableURL
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
  console.log('id', bucketToEdit.value.id)
  filesStore.saveBucket(bucketToEdit.value.bucketName, bucketToEdit.value.bucketPAR, bucketToEdit.value.label, bucketToEdit.value.description
    , bucketToEdit.value.readAllowed, bucketToEdit.value.writeAllowed, bucketToEdit.value.id, bucketToEdit.value.contextFolder)
  showBucketEditorPopup.value = false
}

const addAndEditBucket = () => {
  bucketToEdit.value = {
    bucketName: "", label: "New Bucket", description: "", bucketPAR: "", id: uuidv4()
  }
  showBucketEditorPopup.value = true
}

const initializeBucket = (bucket) => {
  filesStore.setPAR(bucket.bucketPAR)
  filesStore.setBucketContextFolder(bucket.contextFolder)
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
  adminEnabled.value = true
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
    const contextFolder = urlParams.get('contextFolder')
    const bucket = filesStore.saveBucket(bucketName, bucketPAR, label, 'created from URL query parameters', readAllowed, writeAllowed, null, contextFolder)
    selectedBucket.value = bucket
  }
  if (urlParams.has('shareableQueryParams')) {
    const shareableQueryParams = urlParams.get('shareableQueryParams')
    const shareableURLQueryParams = decodeString(shareableQueryParams)

    console.log(`onMounted Shareable URL = `) //, shareableURLQueryParams)

    const shareableURLParts = shareableURLQueryParams.split('&')
    const bucketPAR = shareableURLParts[0].split('=')[1]
    const label = shareableURLParts[1].split('=')[1]
    const permissions = shareableURLParts[2].split('=')[1]
    const readAllowed = permissions.includes('r')
    const writeAllowed = permissions.includes('w')
    const contextFolder = shareableURLParts[3].split('=')[1]
    console.log('bucketPAR', bucketPAR, 'label', label, 'permissions', permissions, 'readAllowed', readAllowed, 'writeAllowed', writeAllowed, 'contextFolder', contextFolder)
    const bucket = filesStore.saveBucket(extractBucketName(bucketPAR), bucketPAR, label, 'created from URL query parameters', readAllowed, writeAllowed, null, contextFolder)
    selectedBucket.value = bucket
    adminEnabled.value = false
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
    scale: 3,
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

const submitData = async () => {
  const fileInput = uploadFileInput.value  // document.getElementById('uploadedFile');
  const files = fileInput.files;
  uploadInProgress.value = true
  progressReport.value = { uploadCount: 0, uploadSize: 0, uploadErrorCount: 0, uploadErrors: [], totalToUpload: files.length }
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file) {
      if (expandZipfiles.value && file.name.toLowerCase().endsWith('.zip')) {
        const zip = new JSZip();
        zip.loadAsync(file).then(async (contents) => {
          const filesInZip = Object.values(contents.files);
          progressReport.value.totalToUpload += filesInZip.length - 1 // add the number of files in the zip file to the total number to upload, and remove the zip file itself
          for (const fileFromZip of filesInZip) {
            if (fileFromZip.dir) { progressReport.value.totalToUpload--; continue } // do not count folders in the total number to upload
            const fileFromZipName = fileFromZip.name
            const blob = await zip.file(fileFromZipName).async('blob')
            const relativePath = (targetFolder.value ? targetFolder.value + '/' : '') + (fileFromZip.dir ? fileFromZip.dir + '/' + fileFromZipName : fileFromZipName)
            filesStore.submitBlob(blob, relativePath, progressReport.value)
          }
        })
      } else {
        filesStore.submitBlob(file, (targetFolder.value ? targetFolder.value + '/' : '') + file.name, progressReport.value)
      }
    }
  }
  fileInput.reset()
}


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


const addFileToZip = (promises, file, zip, commonPrefixToStripOff, flattenFolders) => {
  promises.push(new Promise((resolve, reject) => {
    filesStore.getFile(file).then(blob => {
      // filename from last / onwards

      const filename = flattenFolders ? file.substring(file.lastIndexOf('/') + 1) : file.replace(commonPrefixToStripOff, '')
      console.log('filename to add in zip', filename)
      zip.file(filename, blob);
      resolve();
    })
  }));
}

const longestCommonPrefix = (arr) => {
  if (arr.length === 0) return "";
  let prefix = arr[0];
  for (let i = 1; i < arr.length; i++) {
    while (arr[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}


const exportFilesToZip = (files, zipname) => {
  const zip = new JSZip();
  const promises = [];
  // find out the common prefix for all files - the part of their name that they all start with
  // remove the part after the last /
  const commonPrefix = longestCommonPrefix(files);
  const commonFolderPath = commonPrefix.substring(0, commonPrefix.lastIndexOf('/') + 1)

  files.forEach(file => {
    addFileToZip(promises, file, zip, commonFolderPath, flattenFoldersInDownload.value);
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
      <v-toolbar-title>OCI File Manager (aka The Bucket Browser) v{{ version }}
      </v-toolbar-title>
      <v-img src="/oci-file-manager/app-bar-background-conclusion.jpg" height="80"></v-img>

    </v-app-bar>
    <v-main>
      <v-container fluid>
        <v-row>
          <v-col cols="6">
            <h2 v-if="selectedBucket">{{ selectedBucket?.label
        + (!selectedBucket?.writeAllowed && selectedBucket?.readAllowed ? '(read only)' : '') }}</h2>
            <v-container fluid v-if="selectedBucket">
              <v-row>
                <v-col cols="6">
                  <v-icon @click="expandAll" icon="mdi-expand-all-outline" class="ml-4 mt-3"
                    title="Expand all (nested) folders"></v-icon>
                  <v-icon @click="collapseAll" icon="mdi-collapse-all-outline" class="ml-2 mt-3"
                    title="Collapse all expanded (nested) folders"></v-icon>
                </v-col>
                <v-col cols="5" v-if="downloadMultipleFilesAsZip || copyPanelIsExpanded">
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
              :selectionMode="downloadMultipleFilesAsZip || copyPanelIsExpanded ? 'checkbox' : 'single'"
              v-model:expandedKeys="expandedKeys" :filter="true" filterPlaceholder="Enter search term"
              @node-select="nodeSelect" @node-unselect="nodeUnselect">
              <template #default="slotProps">
                <b>{{ slotProps.node.label }}</b>
              </template>
              <template #file="slotProps">
                <div v-if="selectedBucket?.readAllowed">
                  <a :href="selectedBucket.bucketPAR + (selectedBucket.contextFolder ? selectedBucket.contextFolder + '/' : '') + slotProps.node.data"
                    target="_blank" rel="noopener noreferrer" class="text-700 hover:text-primary">{{
        slotProps.node.label }}</a>
                  <v-img height="50"
                    :src="selectedBucket.bucketPAR + (selectedBucket.contextFolder ? selectedBucket.contextFolder + '/' : '') + slotProps.node.data"
                    class="thumbnail"
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
                    append-icon="mdi-folder-arrow-up" persistent-hint class="ma-10 mt-2 mb-5">
                  </v-combobox>
                  <v-btn @click="submitData" prepend-icon="mdi-upload-box" mt="30">Send file(s) to Bucket</v-btn>

                  <div v-if="uploadInProgress" class="text-center mt-5">
                    <v-icon icon="mdi-progress-upload"></v-icon>
                    {{ progressReport.uploadCount }} / {{ progressReport.totalToUpload }} files uploaded,
                    {{ progressReport.uploadSize }} bytes uploaded
                    <div v-if="progressReport.uploadErrorCount > 0">
                      {{ progressReport.uploadErrorCount }} file uploads failed
                      <div v-for="error in progressReport.uploadErrors">
                        {{ error }}
                      </div>
                    </div>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Download" collapse-icon="mdi-download" expand-icon="mdi-download-outline"
                v-if="selectedBucket?.readAllowed">
                <v-expansion-panel-text>
                  <v-checkbox v-model="downloadMultipleFilesAsZip"
                    label="Allow multiple file download as single zipfile"
                    hint="Select multiple files and download them as a single zip file"
                    class="ma-10 mt-2 mb-5"></v-checkbox>
                  <v-checkbox v-model="flattenFoldersInDownload" label="Flatten folders in download"
                    hint="Should all files be collapsed into one set without folder structure in download?"
                    class="ma-10 mt-2 mb-5" v-if="downloadMultipleFilesAsZip"></v-checkbox>
                  <v-text-field v-model="nameOfDownloadZipFile" label="Zip filename"
                    class="ma-10 mt-2 mb-5"></v-text-field>
                  <v-btn @click="downloadZipfile" prepend-icon="mdi-download-box" mt="30">Download selected file(s) as
                    zip</v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Copy" collapse-icon="mdi-transfer" expand-icon="mdi-transfer"
                v-if="selectedBucket?.readAllowed && adminEnabled" @group:selected="copyPanelIsExpanded = $event.value">
                <v-expansion-panel-text>
                  <v-select v-model="targetBucketForCopy" label="Target Bucket"
                    hint="Which bucket should files be copied to?" :items="filesStore.rememberedBuckets"
                    item-title="label" item-value="id" return-object></v-select>

                  <v-text-field v-model="targetFolderForCopy" label="Target Folder (optional)"
                    hint="optional folder path in target bucket to copy file(s) to - does not need to already exist"
                    class="ma-10 mt-2 mb-5"></v-text-field>
                  <v-checkbox v-model="copyMultipleFilesAsZip" label="Copy files as a single zipfile"
                    hint="Select multiple files and copy them as a single zip file"
                    class="ma-10 mt-2 mb-5"></v-checkbox>
                  <v-text-field v-model="nameOfCopyZipFile" label="Zip filename" class="ma-10 mt-2 mb-5"
                    v-if="copyMultipleFilesAsZip"></v-text-field>
                  <v-btn @click="copyfiles" prepend-icon="mdi-transfer" mt="30">Copy selected file(s)</v-btn>
                  <div v-if="uploadInProgress" class="text-center mt-5">
                    <v-icon icon="mdi-progress-upload"></v-icon>
                    {{ progressReport.uploadCount }} / {{ progressReport.totalToUpload }} files copied,
                    {{ progressReport.uploadSize }} bytes copied
                    <div v-if="progressReport.uploadErrorCount > 0">
                      {{ progressReport.uploadErrorCount }} file copy actions failed
                      <div v-for="error in progressReport.uploadErrors">
                        {{ error }}
                      </div>
                    </div>
                  </div>

                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel title="Share" collapse-icon="mdi-share" expand-icon="mdi-share"
                v-if="selectedBucket && adminEnabled">
                <v-expansion-panel-text>
                  <v-text-field v-model="labelForShare" default-value="selectedBucket?.label"
                    label="Label"></v-text-field>
                  <v-select v-model="contextFolderForShare" :items="filesStore.foldersInBucket" label="Folder to share"
                    hint="Optionally indicate a (nested) folder that this share should restrict access to"
                    append-icon="mdi-folder-star-outline" persistent-hint class="">
                  </v-select>

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
                expand-icon="mdi-pail-outline" v-if="adminEnabled">
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
        <v-navigation-drawer location="right" width="700" rail-width="150" expand-on-hover rail v-if="adminEnabled">
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

        <v-text-field v-model="bucketToEdit.contextFolder" label="Context Folder"
          hint="specify the context folder path in the bucket that should be used as context"></v-text-field>
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
