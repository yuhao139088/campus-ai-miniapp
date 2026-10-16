import { config } from "./config";
App({
  onLaunch() {
    if (wx.cloud) wx.cloud.init({ env: config.envId, traceUser: false });
  },
  globalData: { config },
});
