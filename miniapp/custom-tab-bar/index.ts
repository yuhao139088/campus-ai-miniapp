Component({
  data: {
    selected: 0,
    list: [
      { path: "/pages/home/home", name: "home", text: "首页" },
      { path: "/pages/assistant/assistant", name: "assistant", text: "助手" },
      { path: "/pages/tasks/tasks", name: "tasks", text: "任务" },
      { path: "/pages/profile/profile", name: "profile", text: "我的" },
    ],
  },
  methods: {
    switchTab(e: WechatMiniprogram.TouchEvent) {
      const i = Number(e.currentTarget.dataset.index);
      wx.switchTab({ url: this.data.list[i].path });
    },
  },
});
