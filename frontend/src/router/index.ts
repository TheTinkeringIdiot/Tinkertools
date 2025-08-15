import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/items',
    name: 'TinkerItems',
    component: () => import('@/views/TinkerItems.vue')
  },
  {
    path: '/items/:aoid',
    name: 'ItemDetail',
    component: () => import('@/views/ItemDetail.vue'),
    props: true
  },
  {
    path: '/nanos',
    name: 'TinkerNanos',
    component: () => import('@/views/TinkerNanos.vue')
  },
  {
    path: '/fite',
    name: 'TinkerFite',
    component: () => import('@/views/TinkerFiteMinimal.vue')
  },
  {
    path: '/plants',
    name: 'TinkerPlants',
    component: () => import('@/views/TinkerPlants.vue')
  },
  {
    path: '/pocket',
    name: 'TinkerPocket',
    component: () => import('@/views/TinkerPocket.vue')
  },
  {
    path: '/nukes',
    name: 'TinkerNukes',
    component: () => import('@/views/TinkerNukes.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;