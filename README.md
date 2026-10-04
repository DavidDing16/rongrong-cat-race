# 猫猫冲冲 v9

绒绒、胖橘和美短的空中赛猫小游戏：800 米、两只 AI、轻松与挑战难度、拾取罐罐、跳过障碍、排名、暂停和重开。

手机左下换道，右下跳跃和按住加速。桌面 A/D 或左右箭头换道，空格跳跃，W 或上箭头加速，Esc/P 暂停，R 重开。开始按钮的真实触摸/点击解锁音频，声音设置分别控制音乐与音效。

基速 23.4 m/s，加速额外增加 15.6 m/s，玩家与 AI 共用相同速度及物理。加速每秒消耗 50 体力；罐罐 +35 体力，冻干 +10 分、不补体力。

这是 GitHub Pages 浏览器试玩版。微信小游戏平台注册、上传和发布尚未进行；大陆网络与微信内置浏览器的真机表现仍需实测。

## 本地运行

在已有 Python 3 的环境中运行：
```sh
python3 scripts/serve.py
```
打开 http://127.0.0.1:8767/ 。无需下载依赖或使用 CDN。

`shared/core.js` 是共享玩法核心；其余 shared 模块、browser.js 与本地 Three.js 组成浏览器版本。当前模型通过项目自带的 GLB 加载器解析。Pages 资源均使用相对路径，支持仓库子路径。

## 发布

GitHub Pages 的发布源为 main 分支根目录。`.nojekyll` 保证按静态文件发布，构建/部署使用 GitHub 内置 Pages 流程。修改后推送 main 即更新。

## 许可

第三方 Three.js 的 MIT 许可见 vendor/THREE-LICENSE；原创音频的既有 CC0 声明见 assets/audio/LICENSE.txt。原创项目代码与角色/背景美术未授予通用复用许可，见 LICENSE.md 与 THIRD-PARTY-NOTICES.md。
