import { ref, computed } from 'vue'
import { defineStore } from 'pinia'


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

  const saveBucket = (bucketName, bucketPAR, label, description) => {
    const bucket = rememberedBuckets.value.find(bucket => bucket.bucketName === bucketName);
    if (!bucket) {
      rememberedBuckets.value.push({ bucketName, bucketPAR, label, description })
    } else {
      bucket.bucketPAR = bucketPAR
      bucket.label = label
      bucket.description = description
    }
    localStorage.setItem(localStorageKeyForRememberedBuckets, JSON.stringify(rememberedBuckets.value));

  }

  const removeBucket = (bucketName) => {
    rememberedBuckets.value = rememberedBuckets.value.filter(bucket => bucket.bucketName !== bucketName)
    localStorage.setItem(localStorageKeyForRememberedBuckets, JSON.stringify(rememberedBuckets.value));
  }

  const setPAR = (newPAR) => {
    PAR.value = newPAR
    refreshFiles()
  }


  const refreshFiles = () => {

    fetch(PAR.value, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        bucketContents.value = data.objects
        processFileObjects(data.objects)
      })
  }

  const getFile = (filename) => {
    return new Promise((resolve, reject) => {
      fetch(PAR.value, { method: 'GET' })
        .then(response => response.blob())
        .then(blob => {
          resolve(blob);
        });
    })
  }

  const foldersInBucket = ref([])
  const bucketContents = ref([])
  const filesAndFolders = ref([])

  function createNestedStructure(paths) {
    const root = { name: "root", nestedFolders: [], files: [] };
    paths.forEach((path) => {
      const parts = path.split('/');
      addPath(root, parts, path);
    });

    return root;
  }

  function addPath(currentFolder, parts, fullPath) {
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



  const findFolders = (name, folderNames, path, parent) => {
    console.log(name, path)
    if (name.includes('/')) {
      let folderName = (path ? path + '/' : '') + name.split('/')[0]
      // let name be name without the folder prefix
      if (!folderNames.includes(folderName)) {
        console.log('in find folders' + folderName)
        folderNames.push(folderName)
        const folder = parent.children.push({ name: folderName, children: [] })
        findFolders(name.substring(folderName.length + 1), folderNames, folder)
      }
    }
  }

  const processFileObjects = (fileObjects) => {
    // if a fileObject name contains a slash, then the text before the slash is a folder name ; for now only one level of nesting is supported
    const folderNames = []
    const rootFolder = { name: '', children: [] }
    fileObjects.forEach(fileObject => {
      let name = fileObject.name
      findFolders(name, folderNames, "", rootFolder)


    })

    const nestedStructure = createNestedStructure(fileObjects.map(fileObject => fileObject.name));
    foldersInBucket.value = foldersInBucket.value.sort()
    filesAndFolders.value = nestedStructure
    console.log(JSON.stringify(nestedStructure, null, 2));

  }

  const processFolder = (folder, parentNode) => {
    if (folder.nestedFolders)
      for (const childFolder of folder.nestedFolders) {
        const folderNode = {
          key: childFolder.name + '-folder',
          label: childFolder.name,
          data: folder.name,
          icon: 'mdi mdi-folder-outline',
          styleClass: `treekey|folder|${childFolder.name}`,
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
          styleClass: `treekey|file|${file.name}`,
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
          styleClass: `treekey|folder|${folder.name}`,
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
          styleClass: `treekey|file|${file.name}`,
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


  const submitBlob = (blob, filename) => {
    const fetchOptions = {
      method: 'PUT',
      body: blob,
    };

    fetch(PAR.value + filename, fetchOptions)
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

  return { refreshFiles, PAR, getFile, submitBlob, foldersInBucket, getFilesTree, setPAR, saveBucket, rememberedBuckets, removeBucket }
})
