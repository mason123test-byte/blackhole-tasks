mod database;
mod error;
mod models;
mod placement;

use crate::{
    database::Database,
    error::{AppError, AppResult},
    models::*,
};
use serde_json::Value;
use std::{
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, State};

struct WindowState {
    inner: Mutex<WindowInteraction>,
}
#[derive(Default)]
struct WindowInteraction {
    orb_hovered: bool,
    workspace_hovered: bool,
    pinned: bool,
    orb_entered_at: Option<Instant>,
    close_deadline: Option<Instant>,
    close_worker_running: bool,
}

#[tauri::command]
fn list_tasks(db: State<Database>) -> AppResult<Vec<Task>> {
    db.list_tasks()
}
#[tauri::command]
fn get_task(id: String, db: State<Database>) -> AppResult<Task> {
    db.get_task(&id)
}
#[tauri::command]
fn create_task(input: CreateTaskInput, db: State<Database>) -> AppResult<Task> {
    db.create_task(input)
}
#[tauri::command]
fn update_task(id: String, patch: Value, db: State<Database>) -> AppResult<Task> {
    db.update_task(&id, patch)
}
#[tauri::command]
fn delete_task(id: String, db: State<Database>) -> AppResult<()> {
    db.delete_task(&id)
}
#[tauri::command]
fn complete_task(id: String, db: State<Database>, app: tauri::AppHandle) -> AppResult<Task> {
    let task = db.complete_task(&id)?;
    let _ = app.emit("task:completed", &task);
    let _ = app.emit("orb:render-pulse", ());
    Ok(task)
}
#[tauri::command]
fn restore_task(id: String, db: State<Database>) -> AppResult<Task> {
    db.update_task(
        &id,
        serde_json::json!({"status":"todo","progress":0,"completedAt":null}),
    )
}
#[tauri::command]
fn archive_task(id: String, db: State<Database>) -> AppResult<Task> {
    db.update_task(&id, serde_json::json!({"status":"archived"}))
}
#[tauri::command]
fn restore_archived_task(id: String, db: State<Database>) -> AppResult<Task> {
    db.update_task(&id, serde_json::json!({"status":"todo"}))
}
#[tauri::command]
fn duplicate_task(id: String, db: State<Database>) -> AppResult<Task> {
    let task = db.get_task(&id)?;
    db.create_task(CreateTaskInput {
        title: format!("{}（副本）", task.title),
        description: Some(task.description),
        quadrant: Some(task.quadrant),
        priority: Some(task.priority),
        canvas_x: Some(task.canvas_x + 30.0),
        canvas_y: Some(task.canvas_y + 30.0),
        due_at: task.due_at,
        parent_id: task.parent_id,
    })
}
#[tauri::command]
fn update_task_position(update: TaskPositionUpdate, db: State<Database>) -> AppResult<()> {
    db.update_positions(vec![update])
}
#[tauri::command]
fn update_tasks_positions(updates: Vec<TaskPositionUpdate>, db: State<Database>) -> AppResult<()> {
    db.update_positions(updates)
}

#[tauri::command]
fn list_relations(db: State<Database>) -> AppResult<Vec<TaskRelation>> {
    db.list_relations()
}
#[tauri::command]
fn create_relation(input: CreateRelationInput, db: State<Database>) -> AppResult<TaskRelation> {
    db.create_relation(input)
}
#[tauri::command]
fn delete_relation(id: String, db: State<Database>) -> AppResult<()> {
    db.delete_relation(&id)
}
#[tauri::command]
fn validate_parent_relation(
    source_task_id: String,
    target_task_id: String,
    db: State<Database>,
) -> AppResult<bool> {
    db.validate_cycle(&source_task_id, &target_task_id, "parent_child")
}
#[tauri::command]
fn validate_dependency_relation(
    source_task_id: String,
    target_task_id: String,
    db: State<Database>,
) -> AppResult<bool> {
    db.validate_cycle(&source_task_id, &target_task_id, "dependency")
}

#[tauri::command]
fn list_tags(db: State<Database>) -> AppResult<Vec<Tag>> {
    db.list_tags()
}
#[tauri::command]
fn create_tag(name: String, db: State<Database>) -> AppResult<Tag> {
    db.create_tag(&name)
}
#[tauri::command]
fn rename_tag(id: String, name: String, db: State<Database>) -> AppResult<Tag> {
    db.rename_tag(&id, &name)
}
#[tauri::command]
fn delete_tag(id: String, db: State<Database>) -> AppResult<()> {
    db.delete_tag(&id)
}
#[tauri::command]
fn set_task_tags(task_id: String, tag_ids: Vec<String>, db: State<Database>) -> AppResult<()> {
    db.set_task_tags(&task_id, tag_ids)
}

#[tauri::command]
fn get_settings(db: State<Database>) -> AppResult<AppSettings> {
    db.get_settings()
}
#[tauri::command]
fn update_settings(patch: Value, db: State<Database>) -> AppResult<AppSettings> {
    let current = db.get_settings()?;
    let mut value = serde_json::to_value(current)?;
    merge_json(&mut value, &patch);
    let settings: AppSettings = serde_json::from_value(value)?;
    db.save_settings(&settings)?;
    Ok(settings)
}
#[tauri::command]
fn reset_settings(db: State<Database>) -> AppResult<AppSettings> {
    let settings = AppSettings::default();
    db.save_settings(&settings)?;
    Ok(settings)
}

fn merge_json(target: &mut Value, patch: &Value) {
    if let (Some(target), Some(patch)) = (target.as_object_mut(), patch.as_object()) {
        for (key, value) in patch {
            target.insert(key.clone(), value.clone());
        }
    }
}
fn map_window(error: tauri::Error) -> AppError {
    AppError::Window(error.to_string())
}

fn workspace(app: &tauri::AppHandle) -> AppResult<tauri::WebviewWindow> {
    app.get_webview_window("workspace")
        .ok_or_else(|| AppError::Window("工作区窗口不存在".into()))
}
fn show_workspace_inner(app: &tauri::AppHandle, focus: bool) -> AppResult<()> {
    let window = workspace(app)?;
    let was_visible = window.is_visible().map_err(map_window)?;
    if !was_visible {
        reposition_workspace_inner(app)?;
        window.show().map_err(map_window)?;
        // Windows may apply the configured initial centering when a hidden WebView is first shown.
        // Reapply the orb-relative placement after show so the two windows never overlap.
        reposition_workspace_inner(app)?;
        let _ = app.emit("workspace:visibility-changed", true);
    }
    if focus {
        window.set_focus().map_err(map_window)?;
    }
    if let Some(state) = app.try_state::<WindowState>() {
        if let Ok(mut interaction) = state.inner.lock() {
            interaction.close_deadline = None;
        }
    }
    Ok(())
}
fn hide_workspace_inner(app: &tauri::AppHandle) -> AppResult<()> {
    let window = workspace(app)?;
    if window.is_visible().map_err(map_window)? {
        window.hide().map_err(map_window)?;
        let _ = app.emit("workspace:visibility-changed", false);
    }
    if let Some(state) = app.try_state::<WindowState>() {
        if let Ok(mut interaction) = state.inner.lock() {
            interaction.workspace_hovered = false;
            interaction.close_deadline = None;
        }
    }
    Ok(())
}
fn set_workspace_pinned_inner(app: &tauri::AppHandle, pinned: bool) -> AppResult<()> {
    let state = app
        .try_state::<WindowState>()
        .ok_or_else(|| AppError::Window("窗口状态尚未初始化".into()))?;
    state
        .inner
        .lock()
        .map_err(|_| AppError::Window("窗口状态锁已损坏".into()))?
        .pinned = pinned;
    let _ = app.emit("workspace:pin-changed", pinned);
    Ok(())
}

#[tauri::command]
fn show_workspace(app: tauri::AppHandle) -> AppResult<()> {
    set_workspace_pinned_inner(&app, true)?;
    show_workspace_inner(&app, true)
}
#[tauri::command]
fn hide_workspace(app: tauri::AppHandle) -> AppResult<()> {
    set_workspace_pinned_inner(&app, false)?;
    hide_workspace_inner(&app)
}
#[tauri::command]
fn toggle_workspace(app: tauri::AppHandle) -> AppResult<()> {
    if workspace(&app)?.is_visible().map_err(map_window)? {
        set_workspace_pinned_inner(&app, false)?;
        hide_workspace_inner(&app)
    } else {
        set_workspace_pinned_inner(&app, true)?;
        show_workspace_inner(&app, true)
    }
}
#[tauri::command]
fn pin_workspace(pinned: bool, _state: State<WindowState>, app: tauri::AppHandle) -> AppResult<()> {
    set_workspace_pinned_inner(&app, pinned)?;
    if pinned {
        show_workspace_inner(&app, true)?
    } else {
        schedule_close(app.clone());
    }
    Ok(())
}
#[tauri::command]
fn unpin_workspace(state: State<WindowState>, app: tauri::AppHandle) -> AppResult<()> {
    pin_workspace(false, state, app)
}
#[tauri::command]
fn toggle_workspace_pin(state: State<WindowState>, app: tauri::AppHandle) -> AppResult<()> {
    let pinned = {
        let interaction = state
            .inner
            .lock()
            .map_err(|_| AppError::Window("窗口状态锁已损坏".into()))?;
        !interaction.pinned
    };
    pin_workspace(pinned, state, app)
}
#[tauri::command]
fn set_orb_hovered(
    hovered: bool,
    state: State<WindowState>,
    app: tauri::AppHandle,
) -> AppResult<()> {
    {
        let mut interaction = state
            .inner
            .lock()
            .map_err(|_| AppError::Window("窗口状态锁已损坏".into()))?;
        interaction.orb_hovered = hovered;
        if hovered {
            interaction.orb_entered_at.get_or_insert_with(Instant::now);
            interaction.close_deadline = None;
        } else {
            interaction.orb_entered_at = None;
        }
    }
    let _ = app.emit("orb:hover-changed", hovered);
    if hovered {
        show_workspace_inner(&app, false)
    } else {
        schedule_close(app);
        Ok(())
    }
}
#[tauri::command]
fn set_workspace_hovered(
    hovered: bool,
    state: State<WindowState>,
    app: tauri::AppHandle,
) -> AppResult<()> {
    {
        let mut s = state
            .inner
            .lock()
            .map_err(|_| AppError::Window("窗口状态锁已损坏".into()))?;
        s.workspace_hovered = hovered;
        if hovered {
            s.close_deadline = None;
        }
    }
    let _ = app.emit("workspace:hover-changed", hovered);
    if !hovered {
        schedule_close(app)
    }
    Ok(())
}
fn schedule_close(app: tauri::AppHandle) {
    let delay = app
        .try_state::<Database>()
        .and_then(|db| db.get_settings().ok())
        .map(|settings| settings.close_delay_ms)
        .unwrap_or(350);
    let Some(state) = app.try_state::<WindowState>() else {
        return;
    };
    let should_start = state
        .inner
        .lock()
        .map(|mut interaction| {
            interaction.close_deadline = Some(Instant::now() + Duration::from_millis(delay));
            if interaction.close_worker_running {
                false
            } else {
                interaction.close_worker_running = true;
                true
            }
        })
        .unwrap_or(false);
    if !should_start {
        return;
    }
    std::thread::spawn(move || loop {
        let wait_for = {
            let Some(state) = app.try_state::<WindowState>() else {
                return;
            };
            let Ok(mut interaction) = state.inner.lock() else {
                return;
            };
            match interaction.close_deadline {
                Some(deadline) => deadline.saturating_duration_since(Instant::now()),
                None => {
                    interaction.close_worker_running = false;
                    return;
                }
            }
        };
        if !wait_for.is_zero() {
            std::thread::sleep(wait_for);
        }
        let should_close = {
            let Some(state) = app.try_state::<WindowState>() else {
                return;
            };
            let Ok(mut interaction) = state.inner.lock() else {
                return;
            };
            let deadline_reached = interaction
                .close_deadline
                .is_some_and(|deadline| deadline <= Instant::now());
            if !deadline_reached {
                false
            } else if interaction.orb_hovered || interaction.workspace_hovered || interaction.pinned
            {
                interaction.close_deadline = None;
                interaction.close_worker_running = false;
                return;
            } else {
                interaction.close_deadline = None;
                interaction.close_worker_running = false;
                true
            }
        };
        if should_close {
            log::info!("workspace auto-hidden after hover timeout");
            let _ = hide_workspace_inner(&app);
            return;
        }
    });
}

fn cursor_inside_window(
    window: &tauri::WebviewWindow,
    cursor: tauri::PhysicalPosition<f64>,
) -> bool {
    let Ok(position) = window.inner_position() else {
        return false;
    };
    let Ok(size) = window.inner_size() else {
        return false;
    };
    cursor.x >= position.x as f64
        && cursor.y >= position.y as f64
        && cursor.x < (position.x + size.width as i32) as f64
        && cursor.y < (position.y + size.height as i32) as f64
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct NativePoint {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    #[link_name = "GetCursorPos"]
    fn get_cursor_position(point: *mut NativePoint) -> i32;
}

#[cfg(target_os = "windows")]
fn global_cursor_position(_window: &tauri::WebviewWindow) -> Option<PhysicalPosition<f64>> {
    let mut point = NativePoint { x: 0, y: 0 };
    // SAFETY: GetCursorPos only writes to the valid POINT pointer supplied here.
    let succeeded = unsafe { get_cursor_position(&mut point) };
    (succeeded != 0).then_some(PhysicalPosition::new(point.x as f64, point.y as f64))
}

#[cfg(not(target_os = "windows"))]
fn global_cursor_position(window: &tauri::WebviewWindow) -> Option<PhysicalPosition<f64>> {
    window.cursor_position().ok()
}

fn diagnostics_path_from_args() -> Option<PathBuf> {
    std::env::args_os().find_map(|argument| {
        argument
            .to_string_lossy()
            .strip_prefix("--smoke-diagnostics=")
            .map(PathBuf::from)
    })
}

fn diagnostics_path_from_marker() -> Option<PathBuf> {
    let marker_path = std::env::current_exe()
        .ok()?
        .with_extension("smoke-diagnostics");
    let configured_path = std::fs::read_to_string(marker_path).ok()?;
    let configured_path = configured_path.trim();
    (!configured_path.is_empty()).then(|| PathBuf::from(configured_path))
}

fn start_cursor_monitor(app: tauri::AppHandle, hover_delay_ms: u64) {
    let diagnostics_path = std::env::var_os("BLACKHOLE_SMOKE_DIAGNOSTICS_PATH")
        .map(PathBuf::from)
        .or_else(diagnostics_path_from_args)
        .or_else(diagnostics_path_from_marker);
    let diagnostics_enabled =
        diagnostics_path.is_some() || std::env::var_os("BLACKHOLE_SMOKE_DIAGNOSTICS").is_some();
    if let Some(path) = &diagnostics_path {
        let _ = std::fs::write(path, "build=native-cursor-v4 phase=monitor-started");
    }
    std::thread::spawn(move || loop {
        let Some(orb) = app.get_webview_window("orb") else {
            if let Some(path) = &diagnostics_path {
                let _ = std::fs::write(path, "build=native-cursor-v4 phase=orb-unavailable");
            }
            std::thread::sleep(Duration::from_millis(50));
            continue;
        };
        let Some(workspace) = app.get_webview_window("workspace") else {
            if let Some(path) = &diagnostics_path {
                let _ = std::fs::write(path, "build=native-cursor-v4 phase=workspace-unavailable");
            }
            std::thread::sleep(Duration::from_millis(50));
            continue;
        };
        let Some(cursor) = global_cursor_position(&orb) else {
            if let Some(path) = &diagnostics_path {
                let _ = std::fs::write(path, "build=native-cursor-v3 cursor=unavailable");
            }
            std::thread::sleep(Duration::from_millis(50));
            continue;
        };
        let workspace_visible = workspace.is_visible().unwrap_or(false);
        let orb_inside = cursor_inside_window(&orb, cursor);
        let workspace_inside = workspace_visible && cursor_inside_window(&workspace, cursor);
        let now = Instant::now();
        let (should_show, should_schedule_close) = {
            let Some(state) = app.try_state::<WindowState>() else {
                std::thread::sleep(Duration::from_millis(50));
                continue;
            };
            let Ok(mut interaction) = state.inner.lock() else {
                std::thread::sleep(Duration::from_millis(50));
                continue;
            };
            let was_inside = interaction.orb_hovered || interaction.workspace_hovered;
            interaction.orb_hovered = orb_inside;
            interaction.workspace_hovered = workspace_inside;
            if orb_inside {
                interaction.orb_entered_at.get_or_insert(now);
            } else {
                interaction.orb_entered_at = None;
            }
            if orb_inside || workspace_inside {
                interaction.close_deadline = None;
            }
            let hover_elapsed = interaction.orb_entered_at.is_some_and(|entered| {
                now.duration_since(entered) >= Duration::from_millis(hover_delay_ms)
            });
            (
                orb_inside && hover_elapsed && !workspace_visible,
                was_inside
                    && !orb_inside
                    && !workspace_inside
                    && workspace_visible
                    && !interaction.pinned,
            )
        };
        if should_show {
            log::info!("workspace opened by native cursor monitor");
            let show_result = show_workspace_inner(&app, false);
            if let Err(error) = &show_result {
                log::error!("native cursor monitor failed to open workspace: {error}");
            }
            if diagnostics_enabled {
                let _ = orb.set_title(&format!(
                    "黑洞任务|cursor={:.0},{:.0}|inside={}|show={:?}",
                    cursor.x, cursor.y, orb_inside, show_result
                ));
            }
        } else if should_schedule_close {
            schedule_close(app.clone());
        }
        if let Some(path) = &diagnostics_path {
            let position = orb.inner_position().ok();
            let size = orb.inner_size().ok();
            let executable = std::env::current_exe().ok();
            let _ = std::fs::write(
                path,
                format!(
                    "build=native-cursor-v4 exe={executable:?} cursor={cursor:?} inner={position:?},{size:?} inside={orb_inside} workspace_inside={workspace_inside} workspace_visible={workspace_visible} should_show={should_show} should_schedule_close={should_schedule_close}"
                ),
            );
        }
        std::thread::sleep(Duration::from_millis(50));
    });
}

#[tauri::command]
fn reposition_workspace(app: tauri::AppHandle) -> AppResult<()> {
    reposition_workspace_inner(&app)
}
fn reposition_workspace_inner(app: &tauri::AppHandle) -> AppResult<()> {
    let orb = app
        .get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞窗口不存在".into()))?;
    let work = workspace(app)?;
    let position = orb.outer_position().map_err(map_window)?;
    let size = orb.outer_size().map_err(map_window)?;
    let monitor = orb
        .current_monitor()
        .map_err(map_window)?
        .or_else(|| orb.primary_monitor().ok().flatten())
        .ok_or_else(|| AppError::Window("未找到显示器".into()))?;
    let area = monitor.work_area();
    let settings = app.state::<Database>().get_settings()?;
    let scale = monitor.scale_factor();
    let result = placement::calculate(placement::PlacementInput {
        orb_rect: placement::Rect {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        },
        monitor_work_area: placement::Rect {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        },
        preferred_workspace_width: (settings.workspace_width as f64 * scale).round() as u32,
        preferred_workspace_height: (settings.workspace_height as f64 * scale).round() as u32,
        gap: (8.0 * scale).round() as u32,
    });
    work.set_size(PhysicalSize::new(result.width, result.height))
        .map_err(map_window)?;
    work.set_position(PhysicalPosition::new(result.x, result.y))
        .map_err(map_window)?;
    Ok(())
}
#[tauri::command]
fn save_orb_position(x: i32, y: i32, db: State<Database>) -> AppResult<AppSettings> {
    let mut settings = db.get_settings()?;
    settings.orb_position_x = x;
    settings.orb_position_y = y;
    db.save_settings(&settings)?;
    Ok(settings)
}
#[tauri::command]
fn restore_orb_position(app: tauri::AppHandle, db: State<Database>) -> AppResult<()> {
    let settings = db.get_settings()?;
    if settings.orb_position_x != 0 || settings.orb_position_y != 0 {
        app.get_webview_window("orb")
            .ok_or_else(|| AppError::Window("黑洞窗口不存在".into()))?
            .set_position(PhysicalPosition::new(
                settings.orb_position_x,
                settings.orb_position_y,
            ))
            .map_err(map_window)?
    }
    Ok(())
}
#[tauri::command]
fn set_click_through(
    enabled: bool,
    app: tauri::AppHandle,
    db: State<Database>,
) -> AppResult<AppSettings> {
    let orb = app
        .get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞窗口不存在".into()))?;
    orb.set_ignore_cursor_events(enabled).map_err(map_window)?;
    let mut settings = db.get_settings()?;
    settings.orb_click_through = enabled;
    db.save_settings(&settings)?;
    Ok(settings)
}
#[tauri::command]
fn set_always_on_top(
    enabled: bool,
    app: tauri::AppHandle,
    db: State<Database>,
) -> AppResult<AppSettings> {
    app.get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞窗口不存在".into()))?
        .set_always_on_top(enabled)
        .map_err(map_window)?;
    let mut settings = db.get_settings()?;
    settings.orb_always_on_top = enabled;
    db.save_settings(&settings)?;
    Ok(settings)
}
#[tauri::command]
fn open_quick_add(app: tauri::AppHandle) -> AppResult<()> {
    let window = app
        .get_webview_window("quick-add")
        .ok_or_else(|| AppError::Window("快速新增窗口不存在".into()))?;
    window.show().map_err(map_window)?;
    window.set_focus().map_err(map_window)?;
    Ok(())
}
#[tauri::command]
fn hide_quick_add(app: tauri::AppHandle) -> AppResult<()> {
    app.get_webview_window("quick-add")
        .ok_or_else(|| AppError::Window("快速新增窗口不存在".into()))?
        .hide()
        .map_err(map_window)
}
#[tauri::command]
fn show_orb_menu(_app: tauri::AppHandle) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
fn export_data(db: State<Database>) -> AppResult<String> {
    db.export_json()
}
#[tauri::command]
fn import_data(json: String, mode: String, db: State<Database>) -> AppResult<Value> {
    db.import_json(&json, &mode)
}
#[tauri::command]
fn create_backup(db: State<Database>) -> AppResult<PathBuf> {
    db.backup()
}
#[tauri::command]
fn list_backups(db: State<Database>) -> AppResult<Vec<PathBuf>> {
    db.list_backups()
}
#[tauri::command]
fn restore_backup(path: PathBuf, db: State<Database>) -> AppResult<()> {
    db.restore_backup(&path)
}
#[tauri::command]
fn open_data_directory(app: tauri::AppHandle, db: State<Database>) -> AppResult<()> {
    tauri_plugin_opener::open_path(&db.data_dir, None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let _ = app;
    Ok(())
}
#[tauri::command]
fn open_log_directory(app: tauri::AppHandle) -> AppResult<()> {
    let path = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| AppError::Io(e.to_string()))
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;
    let open = MenuItem::with_id(app, "open", "打开任务面板", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "快速新增任务", true, None::<&str>)?;
    let passthrough = MenuItem::with_id(app, "passthrough", "切换穿透模式", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &quick, &passthrough, &separator, &quit])?;
    TrayIconBuilder::with_id("main")
        .tooltip("黑洞任务")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = set_workspace_pinned_inner(app, true);
                let _ = show_workspace_inner(app, true);
            }
            "quick" => {
                let _ = open_quick_add(app.clone());
            }
            "passthrough" => {
                if let Some(db) = app.try_state::<Database>() {
                    if let Ok(settings) = db.get_settings() {
                        let _ = set_click_through(!settings.orb_click_through, app.clone(), db);
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("orb") {
                let _ = window.show();
            }
            let _ = set_workspace_pinned_inner(app, true);
            let _ = show_workspace_inner(app, true);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match shortcut.to_string().as_str() {
                        "Ctrl+Shift+Space" => {
                            let _ = toggle_workspace(app.clone());
                        }
                        "Ctrl+Shift+N" => {
                            let _ = open_quick_add(app.clone());
                        }
                        "Ctrl+Shift+B" => {
                            if let Some(db) = app.try_state::<Database>() {
                                if let Ok(settings) = db.get_settings() {
                                    let _ = set_click_through(
                                        !settings.orb_click_through,
                                        app.clone(),
                                        db,
                                    );
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let db = Database::open(&data_dir)
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            let settings = db.get_settings().unwrap_or_default();
            app.manage(db);
            app.manage(WindowState {
                inner: Mutex::new(WindowInteraction::default()),
            });
            log::info!("application state initialized at {}", data_dir.display());
            if let Some(orb) = app.get_webview_window("orb") {
                let _ = orb.set_always_on_top(settings.orb_always_on_top);
                if settings.orb_position_x != 0 || settings.orb_position_y != 0 {
                    let _ = orb.set_position(PhysicalPosition::new(
                        settings.orb_position_x,
                        settings.orb_position_y,
                    ));
                } else if let Ok(Some(monitor)) = orb.primary_monitor() {
                    let area = monitor.work_area();
                    if let Ok(size) = orb.outer_size() {
                        let margin = (16.0 * monitor.scale_factor()).round() as i32;
                        let x =
                            area.position.x + area.size.width as i32 - size.width as i32 - margin;
                        let y =
                            area.position.y + (area.size.height as i32 - size.height as i32) / 2;
                        let _ = orb.set_position(PhysicalPosition::new(x, y));
                    }
                }
            }
            if let Some(workspace) = app.get_webview_window("workspace") {
                let _ = workspace.hide();
                let app_handle = app.handle().clone();
                workspace.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = set_workspace_pinned_inner(&app_handle, false);
                        let _ = hide_workspace_inner(&app_handle);
                    }
                });
            }
            if let Some(quick_add) = app.get_webview_window("quick-add") {
                let _ = quick_add.hide();
            }
            start_cursor_monitor(app.handle().clone(), settings.hover_open_delay_ms);
            if let Some(orb) = app.get_webview_window("orb") {
                orb.show()?;
            }
            if let Err(error) = setup_tray(app) {
                log::error!("system tray initialization failed: {error}");
            }
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            for shortcut in ["Ctrl+Shift+Space", "Ctrl+Shift+B", "Ctrl+Shift+N"] {
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    log::warn!("global shortcut {shortcut} unavailable: {error}");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            get_task,
            create_task,
            update_task,
            update_task_position,
            update_tasks_positions,
            delete_task,
            complete_task,
            restore_task,
            archive_task,
            restore_archived_task,
            duplicate_task,
            list_relations,
            create_relation,
            delete_relation,
            validate_parent_relation,
            validate_dependency_relation,
            list_tags,
            create_tag,
            rename_tag,
            delete_tag,
            set_task_tags,
            get_settings,
            update_settings,
            reset_settings,
            show_workspace,
            hide_workspace,
            toggle_workspace,
            pin_workspace,
            unpin_workspace,
            toggle_workspace_pin,
            set_orb_hovered,
            set_workspace_hovered,
            save_orb_position,
            restore_orb_position,
            reposition_workspace,
            set_click_through,
            set_always_on_top,
            open_quick_add,
            hide_quick_add,
            show_orb_menu,
            export_data,
            import_data,
            create_backup,
            list_backups,
            restore_backup,
            open_data_directory,
            open_log_directory
        ])
        .run(tauri::generate_context!())
        .expect("BlackHole Tasks failed to start")
}
