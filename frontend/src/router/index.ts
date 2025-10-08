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
    path: '/profiles',
    name: 'TinkerProfiles',
    component: () => import('@/views/TinkerProfiles.vue')
  },
  {
    path: '/profiles/:profileId',
    name: 'TinkerProfileDetail',
    component: () => import('@/views/TinkerProfileDetail.vue'),
    props: true
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
    path: '/tinkernukes',
    name: 'TinkerNukes',
    component: () => import('@/views/TinkerNukes.vue'),
    meta: { title: 'TinkerNukes - Offensive Nano Analysis' }
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
    path: '/pocket/bosses/:id',
    name: 'BossDetail',
    component: () => import('@/views/BossDetail.vue'),
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Set page title from route meta
router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  } else {
    document.title = 'TinkerTools';
  }
  next();
});

export default router;