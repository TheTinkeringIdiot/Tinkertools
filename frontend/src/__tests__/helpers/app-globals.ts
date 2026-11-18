/**
 * The real app globals, for mounting views the way main.ts runs them.
 *
 * Views and many components use PrimeVue components and the tooltip directive
 * without importing them, relying on main.ts registering them globally. Mount
 * with these (rather than the simplified mocks in vue-test-utils.ts) when a
 * test drives real widgets: typing into InputText, picking Dropdown options,
 * clicking Paginator buttons.
 */

import type { Component, Directive, Plugin } from 'vue';
import type { Pinia } from 'pinia';
import type { Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
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
import Menubar from 'primevue/menubar';
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

/** Components main.ts registers globally. */
export const appComponents: Record<string, Component> = {
  Accordion,
  AccordionTab,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  ContextMenu,
  Dialog,
  Dropdown,
  FileUpload,
  InputNumber,
  InputSwitch,
  InputText,
  Menubar,
  MultiSelect,
  Paginator,
  ProgressSpinner,
  RadioButton,
  Slider,
  TabView,
  TabPanel,
  Tag,
  Textarea,
  TriStateCheckbox,
};

/** Directives main.ts registers globally. */
export const appDirectives: Record<string, Directive> = {
  tooltip: Tooltip,
};

/**
 * `global` mount options matching main.ts: PrimeVue and its services, the
 * given Pinia (and router, if any), and the globally registered components.
 */
export function appGlobals(pinia: Pinia, router?: Router) {
  const plugins: Plugin[] = [PrimeVue, ConfirmationService, ToastService, pinia];
  if (router) plugins.push(router);
  return {
    plugins,
    components: appComponents,
    directives: appDirectives,
  };
}
