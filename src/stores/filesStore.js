import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid';

export const useFilesStore = defineStore('filesStore', () => {
  const PAR = ref(null)
  const localStorageKeyForRememberedPARs = 'rememberedPARs';
  const localStorageKeyForRememberedBuckets = 'rememberedBuckets';
  const rememberedBuckets = ref([])

  const initializeRememberedBuckets = () => {
    const bucketsFromLocalStorage = localStorage.getItem(localStorageKeyForRememberedBuckets);
    if (bucketsFromLocalStorage) {
      rememberedBuckets.value = JSON.parse(bucketsFromLocalStorage);
    }
  }

  initializeRememberedBuckets()

  const saveBucket = (bucketName, bucketPAR, label, description, read = true, write = true, id = null, contextFolder = null) => {
    console.log('fileStore saveBucket bucketid', id)

    let bucket = rememberedBuckets.value.find(bucket => id == bucket.id);
    if (!bucket) {
      bucket = { bucketName, bucketPAR, label, description, readAllowed: read, writeAllowed: write, id: uuidv4(), contextFolder }
      rememberedBuckets.value.push(bucket)
    } else {
      bucket.bucketPAR = bucketPAR
      bucket.label = label
      bucket.description = description
      bucket.readAllowed = read
      bucket.writeAllowed = write
      bucket.contextFolder = contextFolder
    }
    localStorage.setItem(localStorageKeyForRememberedBuckets, JSON.stringify(rememberedBuckets.value));
    return bucket
  }

  const removeBucket = (bucketName) => {
    rememberedBuckets.value = rememberedBuckets.value.filter(bucket => bucket.bucketName !== bucketName)
    localStorage.setItem(localStorageKeyForRememberedBuckets, JSON.stringify(rememberedBuckets.value));
  }

  const setPAR = (newPAR) => {
    PAR.value = newPAR
    refreshFiles()
  }

  const bucketContextFolder = ref(null)
  const setBucketContextFolder = (contextFolder) => {
    bucketContextFolder.value = contextFolder
  }

  const refreshFiles = () => {
    fetch(PAR.value, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        //    //  bucketContents.value = data.objects.filter(object => object.name.startsWith(  '/'))
        const limitedScope = (bucketContextFolder.value != null)
        const context = bucketContextFolder.value + '/'
        // map objects: remove string context from object.name

        processFileObjects(data.objects.filter(object => limitedScope ? object.name.startsWith(context) : true)
          .map(fileObject => { return { name: fileObject.name.replace(context, '') } })
        )
      })
  }

  const getFile = (filename) => {
    return new Promise((resolve, reject) => {
      const targetURL = PAR.value + (bucketContextFolder.value ? (bucketContextFolder.value + '/') : '') + filename
      fetch(targetURL, { method: 'GET' })
        .then(response => response.blob())
        .then(blob => {
          resolve(blob);
        });
    })
  }

  const foldersInBucket = ref([])
  //  const bucketContents = ref([])
  const filesAndFolders = ref([])

  const createNestedStructure = (paths) => {
    const root = { name: "root", nestedFolders: [], files: [] };
    paths.forEach((path) => {
      const parts = path.split('/');
      addPath(root, parts, path);
    });

    return root;
  }

  const addPath = (currentFolder, parts, fullPath) => {
    if (parts.length === 1) {
      // It's a file
      currentFolder.files.push({ name: parts[0], fullPath: fullPath });
    } else {
      // It's a folder
      const folderName = parts[0];
      let folder = currentFolder.nestedFolders.find(f => f.name === folderName);

      if (!folder) {
        folder = { name: folderName, nestedFolders: [], files: [] };
        currentFolder.nestedFolders.push(folder);
        // full path minus the part after the last slash
        const folderPath = fullPath.split('/').slice(0, -1).join('/');
        if (!foldersInBucket.value.includes(folderPath)) foldersInBucket.value.push(folderPath)
      }
      addPath(folder, parts.slice(1), fullPath);
    }
  }

  const processFileObjects = (fileObjects) => {
    foldersInBucket.value = []
    const nestedStructure = createNestedStructure(fileObjects.map(fileObject => fileObject.name));
    foldersInBucket.value = foldersInBucket.value.sort()
    filesAndFolders.value = nestedStructure
  }

  const processFolder = (folder, parentNode) => {
    if (folder.nestedFolders)
      for (const childFolder of folder.nestedFolders) {
        const folderNode = {
          key: childFolder.name + '-folder',
          label: childFolder.name,
          data: folder.name,
          icon: 'mdi mdi-folder-outline',
          nodeType: 'folder',
          type: 'folder',
          leaf: false,
          selectable: false,
          children: []
        }
        parentNode.children.push(folderNode)
        processFolder(childFolder, folderNode)

      }
    if (folder.files)
      for (const file of folder.files) {
        const fileNode = {
          key: file.fullPath,
          label: file.name,
          data: file.fullPath,
          icon: 'mdi mdi-file-outline',
          nodeType: 'file',
          type: 'file',
          leaf: true,
          selectable: true,
          children: []
        }
        parentNode.children.push(fileNode)

      }
  }
  const getFilesTree = () => {
    const treeData = []
    if (filesAndFolders.value.nestedFolders)
      for (const folder of filesAndFolders.value.nestedFolders) {
        const folderNode = {
          key: folder.name + '-folder',
          label: folder.name,
          data: folder.name,
          icon: 'mdi mdi-folder-outline',
          nodeType: 'folder',
          type: 'folder',
          leaf: false,
          selectable: false,
          children: []
        }
        processFolder(folder, folderNode)
        treeData.push(folderNode)

      }
    if (filesAndFolders.value.files)
      for (const file of filesAndFolders.value.files) {
        const fileNode = {
          key: file.fullPath,
          label: file.name,
          data: file.fullPath,
          icon: 'mdi mdi-file-outline',
          nodeType: 'file',
          type: 'file',
          leaf: true,
          selectable: true,
          children: []
        }
        treeData.push(fileNode)
      }

    return treeData
  }


  const submitBlob = async (blob, filename, progressReport, targetBucketPAR = PAR, includeBucketContextFolderInFilename = true) => {
    const fetchOptions = {
      method: 'PUT',
      body: blob,
    };

    const targetURL = PAR.value + (bucketContextFolder.value && includeBucketContextFolderInFilename ? (bucketContextFolder.value + '/') : '') + filename
    console.log('targetURL', targetURL)
    fetch(targetURL, fetchOptions)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.status;
      })
      .then(data => {
        progressReport.uploadCount++
        progressReport.uploadSize += blob.size
        console.log('Success:', data);
        refreshFiles()
        return 0
      })
      .catch(error => {
        progressReport.uploadErrorCount++
        progressReport.uploadErrors.push(error)
        console.error('Error:', error);
        return 1
      });
  }



  return { refreshFiles, PAR, getFile, submitBlob, foldersInBucket, getFilesTree, setPAR, saveBucket, rememberedBuckets, removeBucket, setBucketContextFolder }
})
