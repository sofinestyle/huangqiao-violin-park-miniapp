export default {
  "development": {
    "apiBase": "http://127.0.0.1:8787",
    "label": "DEV · 本地",
    "identityMode": "development",
    "enabled": true
  },
  "staging": {
    "apiBase": "https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com",
    "label": "STAGING · 云端",
    "identityMode": "wechat",
    "enabled": true
  },
  "production": {
    "apiBase": null,
    "label": "",
    "identityMode": "wechat",
    "enabled": false
  }
} as const;
