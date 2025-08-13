import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import { createPinia } from 'pinia';
import router from './router';
import Tooltip from 'primevue/tooltip';
import ConfirmationService from 'primevue/confirmationservice';

// Global PrimeVue component imports
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Checkbox from 'primevue/checkbox';
import ConfirmDialog from 'primevue/confirmdialog';
import ContextMenu from 'primevue/contextmenu';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import FileUpload from 'primevue/fileupload';
import InputNumber from 'primevue/inputnumber';
import InputSwitch from 'primevue/inputswitch';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Paginator from 'primevue/paginator';
import ProgressSpinner from 'primevue/progressspinner';
import RadioButton from 'primevue/radiobutton';
import Slider from 'primevue/slider';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import TriStateCheckbox from 'primevue/tristatecheckbox';

// Import global theme management system (initializes immediately)
import './composables/useTheme';

import 'primeicons/primeicons.css';
import './styles/main.css';

import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(PrimeVue);
app.use(ConfirmationService);
app.use(pinia);
app.use(router);

// Global PrimeVue component registration
app.component('Accordion', Accordion);
app.component('AccordionTab', AccordionTab);
app.component('Badge', Badge);
app.component('Button', Button);
app.component('Card', Card);
app.component('Checkbox', Checkbox);
app.component('ConfirmDialog', ConfirmDialog);
app.component('ContextMenu', ContextMenu);
app.component('Dialog', Dialog);
app.component('Dropdown', Dropdown);
app.component('FileUpload', FileUpload);
app.component('InputNumber', InputNumber);
app.component('InputSwitch', InputSwitch);
app.component('InputText', InputText);
app.component('MultiSelect', MultiSelect);
app.component('Paginator', Paginator);
app.component('ProgressSpinner', ProgressSpinner);
app.component('RadioButton', RadioButton);
app.component('Slider', Slider);
app.component('TabView', TabView);
app.component('TabPanel', TabPanel);
app.component('Tag', Tag);
app.component('Textarea', Textarea);
app.component('TriStateCheckbox', TriStateCheckbox);

// Global directives
app.directive('tooltip', Tooltip);

app.mount('#app');