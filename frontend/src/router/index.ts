import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import {
  ensureVersionsLoaded,
  isAcceptableVersion,
  reserveRouteSegments,
  resolveVersion,
  setCurrentVersion,
} from '@/composables/useGameVersion';

/**
 * Every app route lives under a game version segment: /<version>/items/123.
 * The version is validated in the beforeEach guard against the registry; a
 * path without a valid version (old bookmarks, shared links from before
 * versions existed) is redirected to the same path under the resolved version.
 *
 * Navigate with named routes so the `version` param is inherited from the
 * current route, or build string paths with versionedPath() from
 * useGameVersion.
 */
const versionedRoutes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: 'items',
    name: 'TinkerItems',
    component: () => import('@/views/TinkerItems.vue'),
  },
  {
    path: 'profiles',
    name: 'TinkerProfiles',
    component: () => import('@/views/TinkerProfiles.vue'),
  },
  {
    path: 'profiles/:profileId',
    name: 'TinkerProfileDetail',
    component: () => import('@/views/TinkerProfileDetail.vue'),
    props: (route) => ({ profileId: route.params.profileId }),
  },
  {
    path: 'items/:aoid',
    name: 'ItemDetail',
    component: () => import('@/views/ItemDetail.vue'),
    props: (route) => ({ aoid: route.params.aoid }),
  },
  {
    // Legacy URL redirect: /item/:aoid -> /items/:aoid
    path: 'item/:aoid',
    redirect: (to) => ({
      name: 'ItemDetail',
      params: { version: to.params.version, aoid: to.params.aoid },
      query: to.query,
    }),
  },
  {
    path: 'nanos',
    name: 'TinkerNanos',
    component: () => import('@/views/TinkerNanos.vue'),
  },
  {
    path: 'tinkernukes',
    name: 'TinkerNukes',
    component: () => import('@/views/TinkerNukes.vue'),
    meta: { title: 'TinkerNukes - Offensive Nano Analysis' },
  },
  {
    path: 'fite',
    name: 'TinkerFite',
    component: () => import('@/views/TinkerFite.vue'),
    meta: {
      title: 'TinkerFite - Weapon Analysis',
      description: 'Analyze and compare weapons for your character',
    },
  },
  {
    path: 'plants',
    name: 'TinkerPlants',
    component: () => import('@/views/TinkerPlants.vue'),
  },
  {
    path: 'pocket',
    name: 'TinkerPocket',
    component: () => import('@/views/TinkerPocket.vue'),
  },
  {
    path: 'pocket/bosses/:id',
    name: 'BossDetail',
    component: () => import('@/views/BossDetail.vue'),
    props: (route) => ({ id: route.params.id }),
  },
  {
    path: 'versions',
    name: 'GameVersions',
    component: () => import('@/views/GameVersions.vue'),
    meta: { title: 'TinkerTools - Game Versions' },
  },
  {
    // Unknown path under a version. Not a redirect record: redirects resolve
    // before guards, and the guard must first decide whether the leading
    // segment is a version at all (see beforeEach below).
    path: ':pathMatch(.*)*',
    name: 'VersionNotFound',
    component: () => import('@/components/shared/VersionLayout.vue'),
  },
];

const routes: RouteRecordRaw[] = [
  {
    path: '/:version([a-z0-9][a-z0-9.-]{0,39})',
    component: () => import('@/components/shared/VersionLayout.vue'),
    children: versionedRoutes,
  },
  {
    // Anything else (including '/') is handled by the guard below, which
    // prefixes the resolved version.
    path: '/:pathMatch(.*)*',
    name: 'Unversioned',
    component: () => import('@/components/shared/VersionLayout.vue'),
  },
];

// A legacy bookmark's first segment (/nanos) must never be taken for a version.
reserveRouteSegments(versionedRoutes.map((route) => route.path.split('/')[0]));

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * Validate the version segment. Paths whose first segment is not a known
 * version (e.g. a pre-version bookmark like /items/123, which matches the
 * `:version` param as "items") are redirected under the resolved version.
 */
router.beforeEach(async (to) => {
  await ensureVersionsLoaded();

  const segment = to.params.version as string | undefined;
  if (segment && isAcceptableVersion(segment)) {
    await setCurrentVersion(segment);
    if (to.name === 'VersionNotFound') {
      return { name: 'Home', params: { version: segment }, replace: true };
    }
    return true;
  }

  const version = resolveVersion();
  const target = `/${version}${to.fullPath === '/' ? '' : to.fullPath}`;
  if (target === to.fullPath) {
    // Guard against redirect loops if resolution somehow yields the same path.
    return true;
  }
  return { path: target, replace: true };
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
