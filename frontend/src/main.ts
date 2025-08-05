import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import { createPinia } from 'pinia';
import router from './router';

import 'primeicons/primeicons.css';
import 'primevue/resources/themes/aura-light-teal/theme.css';
import './styles/main.css';

import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(PrimeVue);
app.use(pinia);
app.use(router);

app.mount('#app');