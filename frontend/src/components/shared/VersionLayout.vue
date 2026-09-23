<!--
  Passthrough layout for the /:version/... route subtree.
  The version segment itself is validated by the router guard; this component
  only renders the matched child route.

  The child view is keyed by version so a version switch remounts it: views
  load their data on mount and watch only their own params (ItemDetail watches
  `aoid`), so without the key they would keep showing the old version's data.
-->
<template>
  <router-view :key="String($route.params.version ?? '')" />
</template>
