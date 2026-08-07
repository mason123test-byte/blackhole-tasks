# BlackHole Tasks（黑洞任务）

BlackHole Tasks 是一个 Windows 优先、本地优先的四象限桌面任务管理工具。黑洞、四象限、任务新增和详情编辑全部位于同一个透明 `orb` 场景窗口中；窗口展开或收起时始终以黑洞中心为桌面锚点。

> 当前仓库已完成可编译的前端和 Tauri/Rust 项目源码。前端检查、测试和真实 Chromium 交互已通过；本机尚未安装 Rust/Cargo，因此最新 Rust 检查与 Windows 安装包仍需在 Windows CI 执行。详见“验证状态”。

## 功能预览

- 透明、无边框、置顶的 WebGL2 黑洞；WebGL2 不可用时明确报错，不渲染等价替代效果
- 同一个原生窗口围绕黑洞中心在 `240×180` 收起态和 `920×700` 任务态之间伸缩
- 四象限与任务先绘制为场景纹理，再由黑洞 Shader 进行引力透镜采样
- 在象限中直接新增，在任务原位置直接编辑，不打开工作区、快速新增或详情窗口
- 任务拖入另一个引力象限时立即更新象限；完成、状态、优先级和删除均可原地操作
- 父子、依赖、普通关联模型与循环检测；折叠父任务时隐藏后代及相关边
- 标题/描述/标签搜索与状态、标签筛选
- SQLite WAL 本地持久化、参数化 SQL、迁移表、批量坐标事务
- JSON 合并/覆盖导入，覆盖导入前自动备份；SQLite 在线备份及 14 份保留策略
- 系统托盘、单实例、全局快捷键、穿透模式、始终置顶、开机启动插件
- NSIS 与 MSI Windows 安装器配置

## 技术栈

- Tauri 2 / Rust / rusqlite（bundled SQLite）
- React 19 / TypeScript / Vite
- Zustand
- Vitest / Testing Library / ESLint

## 环境要求

Windows 10/11：

1. Node.js 20 或更高版本（当前已用 Node 24 验证）。
2. Rust stable MSVC 工具链与 Cargo。
3. Microsoft C++ Build Tools，包含“使用 C++ 的桌面开发”和 Windows SDK。
4. WebView2 Runtime（Windows 11 通常已包含）。

Rust 官方安装后建议验证：

```powershell
rustc --version
cargo --version
```

## 安装依赖

```powershell
cd C:\codex\HDDB
npm install
```

项目统一使用 npm，锁文件为 `package-lock.json`。

## 开发启动

完整桌面应用：

```powershell
npm run tauri dev
```

仅预览单窗口前端：

```powershell
npm run dev
```

然后访问 `http://127.0.0.1:1420/`。使用 `?compact=1` 可单独预览 `240×180` 收起态。

也可以双击 [dev.bat](./dev.bat)。

## 运行测试

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
cargo fmt --manifest-path src-tauri\Cargo.toml --check
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri\Cargo.toml
```

## 构建 Windows 安装包

```powershell
.\build-installer.ps1
```

或：

```powershell
npm run tauri build
```

成功后安装包位于：

```text
C:\codex\HDDB\src-tauri\target\release\bundle\nsis\BlackHole Tasks_0.1.4_x64-setup.exe
C:\codex\HDDB\src-tauri\target\release\bundle\msi\BlackHole Tasks_0.1.4_x64_en-US.msi
```

实际文件名可能包含 Tauri 根据平台生成的架构或语言后缀；构建脚本会在结束时列出真实路径。

## 项目结构

```text
HDDB/
├─ src/
│  ├─ app/                 # 单一黑洞任务场景入口
│  ├─ components/          # 黑洞、离屏任务纹理与四象限交互组件
│  ├─ services/            # Tauri Command + 浏览器 localStorage 降级
│  ├─ shader/              # WebGL2 测地线 Shader（无等价降级）
│  ├─ stores/              # Zustand 任务、设置、历史状态
│  ├─ styles/
│  ├─ types/
│  └─ utils/               # 象限、筛选、图关系算法及测试
├─ src-tauri/
│  ├─ capabilities/        # 最小权限配置
│  ├─ icons/               # Windows/macOS/移动端图标产物
│  ├─ migrations/          # SQLite 迁移
│  ├─ src/                 # Rust Commands、SQLite、单窗口锚点伸缩、托盘
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ build-installer.ps1
├─ dev.bat
├─ package.json
└─ README.md
```

## 数据位置

安装版默认使用 Tauri 应用数据目录：

```text
%APPDATA%\com.blackhole.tasks\blackhole-tasks.db
%APPDATA%\com.blackhole.tasks\backups\
```

日志目录由 Tauri `app_log_dir` 决定，通常位于：

```text
%LOCALAPPDATA%\com.blackhole.tasks\logs\
```

浏览器单独预览时使用该页面来源的 `localStorage`，与 SQLite 数据互不混用。

## 默认快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + Shift + Space` | 展开或收起黑洞任务空间 |
| `Ctrl + Shift + B` | 切换黑洞穿透模式 |
| `Ctrl + Shift + N` | 展开场景并在 Q1 原地新增任务 |
| `Enter` | 编辑聚焦的任务 |
| `Esc` | 结束当前原地编辑 |

## 数据隐私与安全

- 默认不联网、不要求登录、不上传任务、不包含遥测。
- 所有 SQL 使用 rusqlite 参数绑定。
- 导入数据检查格式名和版本，并在事务中执行。
- 覆盖导入前创建数据库备份。
- CSP 与 Tauri capability 按最小权限配置；前端没有任意 shell 权限。
- 日志不记录任务描述和导出原文。

## 验证状态

已实际通过：

- `npm run typecheck`：通过
- `npm run test`：4 个测试文件、9 项测试全部通过
- `npm run lint`：通过，0 warning
- `npm run build`：通过
- 真实 Chrome/WebGL2 收起态 `240×180`：像素能量 5747，控制台 0 error
- 真实 Chrome/WebGL2 展开态 `920×700`：像素能量 30772，四个象限和离屏场景纹理均存在
- 同一场景内任务新增、原地编辑、拖动换象限、完成和收起：通过
- 禁用 WebGL2 时显示明确错误，`canvas2d` 渲染器数量为 0

仍需在 Windows CI 验证最新 Rust 单窗口命令和安装包，并在真实多显示器及不同 DPI 桌面上验收透明窗口锚点伸缩。

## 黑洞视觉参考

黑洞渲染器基于 [s0xDk/ghostty-blackhole](https://github.com/s0xDk/ghostty-blackhole) 的 Schwarzschild 光子测地线积分进行适配：实际运行路径逐像素执行 leapfrog 积分，由光线与倾斜吸积盘的多次交点自然产生事件视界、光子环、上下引力透镜像、温度色彩与相对论多普勒增亮。参考项目把终端画面作为 `iChannel0`；本项目则把四象限和非编辑任务绘制为 `u_scene_texture`，让任务边界和文字在黑洞附近参与同样的重新采样。正在编辑的任务保留为清晰 DOM 层，以保证输入法、光标和无障碍能力。完整第三方许可见 `THIRD_PARTY_NOTICES.md`。

## 已知问题

- 撤销/重做 Store 和数据结构已建立，但第一版 UI 操作尚未全部写入历史命令栈。
- 任务关系画布连接默认创建“依赖”关系；父子/普通关联的后端能力已实现，专用关系选择器仍待补充。
- 标签后端和筛选已实现，标签维护/任务标签编辑 UI 仍待补充。
- 导入和备份 Command 已实现，设置页中的文件选择与恢复确认 UI 仍待补充。
- 黑洞右键入口已预留，当前完整菜单主要由系统托盘提供。
