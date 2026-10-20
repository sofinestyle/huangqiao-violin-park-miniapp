// Admin and its API share the dedicated Staging origin. Legacy entry pages
// redirect before mounting, without transferring credentials or query data.
export const STAGING_STATIC_ORIGIN = 'https://huangqiao-admin-staging-huangqiao-staging-d2d1dj1bb4ad90.webapps.tcloudbase.com';
export const STAGING_GATEWAY_ORIGIN = 'https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com';
export const STAGING_ADMIN_ORIGIN = 'https://admin.yorray.com';

export function startAdmin(location, mount) {
  if (location.origin === STAGING_STATIC_ORIGIN || location.origin === STAGING_GATEWAY_ORIGIN) {
    // Fixed destination: no query-supplied redirect, credentials or session transfer.
    location.replace(STAGING_ADMIN_ORIGIN + '/');
    return 'redirected';
  }
  mount();
  return 'mounted';
}
