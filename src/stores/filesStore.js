import { ref, computed } from 'vue'
import { defineStore } from 'pinia'


export const useFilesStore = defineStore('filesStore', () => {
  const PAR = 'https://objectstorage.us-ashburn-1.oraclecloud.com/p/kwEUouf1vfoUJA6gDR_urH6eIebGB1RPiU9V4lePAjYN_-guecBpDCDaDJFoIIwC/n/idtwlqf2hanz/b/TwoDrive/o/'

  const files = ref([])
  const refreshFiles = () => {

    fetch(PAR, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        processFileObjects(data.objects)
      })
  }

  const foldersInBucket = ref([])

  const processFileObjects = (fileObjects) => {
    const filesAndFolders = []
    // if a fileObject name contains a slash, then the text before the slash is a folder name ; for now only one level of nesting is supported
    const folderNames = []
    fileObjects.forEach(fileObject => {
      if (fileObject.name.includes('/')) {
        const folderName = fileObject.name.split('/')[0]
        if (!folderNames.includes(folderName)) {
          folderNames.push(folderName)
        }
      }
    })
    foldersInBucket.value = folderNames
    for (const folderName of folderNames.sort()) {
      filesAndFolders.push({ isFolder: true, isExpanded: false, name: folderName })
    }
    //sort fileObjects by name
    fileObjects.sort((a, b) => a.name.localeCompare(b.name))
    for (const fileObject of fileObjects) {
      if (fileObject.name.includes('/')) {
        filesAndFolders.push({ isFolder: false, name: fileObject.name.split('/')[1], folderName: fileObject.name.split('/')[0], fullname: fileObject.name })
      } else {
        filesAndFolders.push({ isFolder: false, name: fileObject.name, fullname: fileObject.name })
      }
    }
    files.value = filesAndFolders
  }

  const submitBlob = (blob, filename) => {
    const fetchOptions = {
      method: 'PUT',
      body: blob,
    };

    fetch(PAR + filename, fetchOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.status;
      })
      .then(data => {
        console.log('Success:', data);
        refreshFiles()
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }

  return { files, refreshFiles, PAR, submitBlob, foldersInBucket }
})
