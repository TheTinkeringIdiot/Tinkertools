import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import { createPinia } from 'pinia';
import router from './router';
import Tooltip from 'primevue/tooltip';

import 'primeicons/primeicons.css';
import './styles/main.css';

import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(PrimeVue);
app.use(pinia);
app.use(router);

// Global directives
app.directive('tooltip', Tooltip);

app.mount('#app');