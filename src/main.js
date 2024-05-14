import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import App from './App.vue'

const app = createApp(App)
app.use(createPinia())

const vuetify = createVuetify({
    components,
    directives,
})

app.use(vuetify)

app.mount('#app')
