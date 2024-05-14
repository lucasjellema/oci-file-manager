import { createRouter, createWebHistory } from 'vue-router'
import FileList from '../components/FileList.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: FileList
    }

  ]
})

export default router
