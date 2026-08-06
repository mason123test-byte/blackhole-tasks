# BlackHole Tasks（黑洞任务）

BlackHole Tasks 是一个 Windows 优先、本地优先的四象限桌面任务管理工具。应用采用独立的 `orb` 黑洞悬浮窗口和 `workspace` 任务工作区窗口；工作区关闭时只隐藏，不销毁任务状态。

> 当前仓库已完成可编译的前端和 Tauri/Rust 项目源码。前端检查已通过；本机尚未安装 Rust/Cargo，因此 Rust 检查与 Windows 安装包仍需安装工具链后执行。详见“验证状态”。

## 功能预览

- 透明、无边框、置顶的 WebGL2 黑洞悬浮球，WebGL2 不可用时自动降级 Canvas 2D
- 黑洞悬停展开、离开延迟收起、单击固定、拖动阈值、双击快速新增
- 独立四象限 React Flow 无限画布，支持缩放、平移、框选、多选、节点拖动和连线
- 任务新增、详情编辑、自动保存、删除确认、完成、恢复、归档、复制
- 跨中心线自动更新象限、重要/紧急字段一致性
- 父子、依赖、普通关联模型与循环检测；折叠父任务时隐藏后代及相关边
- 标题/描述/标签搜索与状态、标签筛选
- SQLite WAL 本地持久化、参数化 SQL、迁移表、批量坐标事务
- JSON 合并/覆盖导入，覆盖导入前自动备份；SQLite 在线备份及 14 份保留策略
- 系统托盘、单实例、全局快捷键、穿透模式、始终置顶、开机启动插件
- NSIS 与 MSI Windows 安装器配置

## 技术栈

- Tauri 2 / Rust / rusqlite（bundled SQLite）
- React 19 / TypeScript / Vite
- React Flow (`@xyflow/react`)
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

仅预览工作区前端：

```powershell
npm run dev
```

然后访问 `http://127.0.0.1:1420/?window=workspace`。黑洞预览使用 `?window=orb`。

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
C:\codex\HDDB\src-tauri\target\release\bundle\nsis\BlackHole Tasks_0.1.2_x64-setup.exe
C:\codex\HDDB\src-tauri\target\release\bundle\msi\BlackHole Tasks_0.1.2_x64_en-US.msi
```

实际文件名可能包含 Tauri 根据平台生成的架构或语言后缀；构建脚本会在结束时列出真实路径。

## 项目结构

```text
HDDB/
├─ src/
│  ├─ app/                 # orb/workspace/quick-add 三个前端入口
│  ├─ components/          # 黑洞、画布、工具栏、详情、快速新增
│  ├─ services/            # Tauri Command + 浏览器 localStorage 降级
│  ├─ shader/              # WebGL2 Shader 与 Canvas 2D 降级
│  ├─ stores/              # Zustand 任务、设置、历史状态
│  ├─ styles/
│  ├─ types/
│  └─ utils/               # 象限、筛选、图关系算法及测试
├─ src-tauri/
│  ├─ capabilities/        # 最小权限配置
│  ├─ icons/               # Windows/macOS/移动端图标产物
│  ├─ migrations/          # SQLite 迁移
│  ├─ src/                 # Rust Commands、SQLite、窗口定位、托盘
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
| `Ctrl + Shift + Space` | 显示或隐藏工作区 |
| `Ctrl + Shift + B` | 切换黑洞穿透模式 |
| `Ctrl + Shift + N` | 快速新增任务 |
| `Ctrl + N` | 工作区内新增任务 |
| `Ctrl + F` | 搜索（工具栏） |
| `Ctrl + Z` / `Ctrl + Shift + Z` | 撤销 / 重做 |
| `Delete` | 删除选中任务 |
| `Ctrl + Enter` | 完成选中任务 |
| `Esc` | 关闭详情或隐藏工作区 |

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
- `npm run test`：3 个测试文件、6 项测试全部通过
- `npm run lint`：通过，0 warning
- `npm run build`：通过
- 真实 `96×96` Chromium/WebGL2 视觉检查：平衡模式静止 24 FPS、悬停 45 FPS，控制台 0 error
- 四象限初始视图、任务新增、鼠标拖动和象限持久化：通过
- 500 节点/800 关系负载：约 1.4 秒装载；密集模式只保留可见节点、最多绘制 160 条优先关系且关闭连线动画
- 500 节点搜索：约 36ms，命中任务自动适应视图并保持可见
- GitHub Actions Windows Runner：`cargo fmt --check`、Clippy、Rust 测试、Tauri NSIS/MSI 构建均已通过；工作流现增加原生 EXE 启动/响应冒烟检查

仍需在真实多显示器和不同 DPI 桌面上做手工验收；自动化不能完全替代透明窗口、桌面合成和鼠标跨窗口体验检查。

## 黑洞视觉参考

黑洞的视觉结构参考了 [s0xDk/ghostty-blackhole](https://github.com/s0xDk/ghostty-blackhole) 的事件视界、光子环、倾斜吸积盘和上下引力透镜弧线。当前实现是针对 `96×96` 透明 Windows WebView 独立编写的低成本近似，不直接运行 Ghostty 的逐像素测地线积分，以避免常驻悬浮窗造成 GPU 卡顿。参考项目采用 MIT License。

## 已知问题

- 撤销/重做 Store 和数据结构已建立，但第一版 UI 操作尚未全部写入历史命令栈。
- 任务关系画布连接默认创建“依赖”关系；父子/普通关联的后端能力已实现，专用关系选择器仍待补充。
- 标签后端和筛选已实现，标签维护/任务标签编辑 UI 仍待补充。
- 导入和备份 Command 已实现，设置页中的文件选择与恢复确认 UI 仍待补充。
- 黑洞右键入口已预留，当前完整菜单主要由系统托盘提供。
