import { ref, computed } from 'vue'
import { defineStore } from 'pinia'


export const useFilesStore = defineStore('filesStore', () => {
  const PAR = 'https://objectstorage.us-ashburn-1.oraclecloud.com/p/kwEUouf1vfoUJA6gDR_urH6eIebGB1RPiU9V4lePAjYN_-guecBpDCDaDJFoIIwC/n/idtwlqf2hanz/b/TwoDrive/o/'

  const files = ref([])
  const refreshFiles = () => {

    fetch(PAR, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        files.value = data.objects
      })
  }

  return { files, refreshFiles }
})
