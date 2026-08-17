mod database;
mod error;
mod models;

use crate::{
    database::Database,
    error::{AppError, AppResult},
    models::*,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, State};

fn normalize_visual_comparison_mode(value: Option<&str>) -> &'static str {
    match value {
        Some("baseline") => "baseline",
        Some("candidate") => "candidate",
        Some("split") => "split",
        _ => "normal",
    }
}

#[tauri::command]
fn get_visual_comparison_mode() -> String {
    let value = std::env::var("BLACKHOLE_VISUAL_COMPARE").ok();
    normalize_visual_comparison_mode(value.as_deref()).to_owned()
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

const COMPACT_SCENE_SIZE: (u32, u32) = (240, 180);
const EXPANDED_SCENE_SIZE: (u32, u32) = (920, 700);

fn set_scene_expanded_inner(app: &tauri::AppHandle, expanded: bool, focus: bool) -> AppResult<()> {
    let window = app
        .get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞任务窗口不存在".into()))?;
    let position = window.outer_position().map_err(map_window)?;
    let current_size = window.outer_size().map_err(map_window)?;
    let monitor = window
        .current_monitor()
        .map_err(map_window)?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| AppError::Window("未找到显示器".into()))?;
    let scale = monitor.scale_factor();
    let logical_size = if expanded {
        EXPANDED_SCENE_SIZE
    } else {
        COMPACT_SCENE_SIZE
    };
    let area = monitor.work_area();
    let target_size = PhysicalSize::new(
        ((logical_size.0 as f64 * scale).round() as u32).min(area.size.width),
        ((logical_size.1 as f64 * scale).round() as u32).min(area.size.height),
    );
    let center_x = position.x + current_size.width as i32 / 2;
    let center_y = position.y + current_size.height as i32 / 2;
    let max_x = area.position.x + area.size.width as i32 - target_size.width as i32;
    let max_y = area.position.y + area.size.height as i32 - target_size.height as i32;
    let target_x = (center_x - target_size.width as i32 / 2).clamp(area.position.x, max_x);
    let target_y = (center_y - target_size.height as i32 / 2).clamp(area.position.y, max_y);

    window.set_size(target_size).map_err(map_window)?;
    window
        .set_position(PhysicalPosition::new(target_x, target_y))
        .map_err(map_window)?;
    if focus {
        window.set_focus().map_err(map_window)?;
    }
    let _ = app.emit("scene:expanded-changed", expanded);
    log::info!(
        "single scene {} at {},{} size={}x{}",
        if expanded { "expanded" } else { "collapsed" },
        target_x,
        target_y,
        target_size.width,
        target_size.height
    );
    Ok(())
}

#[tauri::command]
fn set_scene_expanded(expanded: bool, app: tauri::AppHandle) -> AppResult<()> {
    set_scene_expanded_inner(&app, expanded, true)
}

fn toggle_scene_inner(app: &tauri::AppHandle) -> AppResult<()> {
    let window = app
        .get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞任务窗口不存在".into()))?;
    let scale = window.scale_factor().map_err(map_window)?;
    let width = window.outer_size().map_err(map_window)?.width;
    let compact_width = (COMPACT_SCENE_SIZE.0 as f64 * scale).round() as u32;
    set_scene_expanded_inner(app, width <= compact_width + 4, true)
}

fn open_scene_quick_add(app: &tauri::AppHandle) -> AppResult<()> {
    set_scene_expanded_inner(app, true, true)?;
    let _ = app.emit("scene:quick-add", ());
    Ok(())
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

#[tauri::command]
fn save_orb_position(
    x: i32,
    y: i32,
    app: tauri::AppHandle,
    db: State<Database>,
) -> AppResult<AppSettings> {
    let window = app
        .get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞任务窗口不存在".into()))?;
    let size = window.outer_size().map_err(map_window)?;
    let scale = window.scale_factor().map_err(map_window)?;
    let compact_width = (COMPACT_SCENE_SIZE.0 as f64 * scale).round() as i32;
    let compact_height = (COMPACT_SCENE_SIZE.1 as f64 * scale).round() as i32;
    let mut settings = db.get_settings()?;
    // Persist the compact-window origin even when the expanded scene is moved,
    // so the black-hole center returns to exactly the same desktop anchor.
    settings.orb_position_x = x + size.width as i32 / 2 - compact_width / 2;
    settings.orb_position_y = y + size.height as i32 / 2 - compact_height / 2;
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
fn show_orb_menu(_app: tauri::AppHandle) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
fn report_orb_render(
    renderer: String,
    energy: u32,
    width: u32,
    height: u32,
    diagnostic: String,
    app: tauri::AppHandle,
) -> AppResult<()> {
    if renderer != "webgl2" {
        return Err(AppError::Window("未知的黑洞渲染器".into()));
    }
    let diagnostic_suffix = if diagnostic.is_empty() {
        String::new()
    } else {
        format!("|diag={diagnostic}")
    };
    let title = format!(
        "黑洞任务|renderer={renderer}|frame=ready|energy={energy}|size={width}x{height}{diagnostic_suffix}"
    );
    app.get_webview_window("orb")
        .ok_or_else(|| AppError::Window("黑洞窗口不存在".into()))?
        .set_title(&title)
        .map_err(map_window)?;
    log::info!(
        "orb frame ready renderer={renderer} energy={energy} size={width}x{height} diagnostic={diagnostic}"
    );
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
    let open = MenuItem::with_id(app, "open", "展开黑洞任务空间", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "在黑洞中新增任务", true, None::<&str>)?;
    let passthrough = MenuItem::with_id(app, "passthrough", "切换穿透模式", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &quick, &passthrough, &separator, &quit])?;
    TrayIconBuilder::with_id("main")
        .tooltip("黑洞任务")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = set_scene_expanded_inner(app, true, true);
            }
            "quick" => {
                let _ = open_scene_quick_add(app);
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

#[derive(Debug, PartialEq, Eq)]
enum SmokeCommand {
    Toggle(u64),
    Snapshot(u64),
}

fn parse_smoke_command(command: &str) -> Option<SmokeCommand> {
    let (name, sequence) = command.trim().split_once(':')?;
    let sequence = sequence.parse::<u64>().ok()?;
    match name {
        "toggle" => Some(SmokeCommand::Toggle(sequence)),
        "snapshot" => Some(SmokeCommand::Snapshot(sequence)),
        _ => None,
    }
}

fn pending_smoke_command_paths(command_path: &Path) -> Vec<PathBuf> {
    let Some(parent) = command_path.parent() else {
        return Vec::new();
    };
    let Some(command_name) = command_path.file_name().and_then(|name| name.to_str()) else {
        return Vec::new();
    };
    let prefix = format!("{command_name}.");
    let Ok(entries) = std::fs::read_dir(parent) else {
        return Vec::new();
    };
    let mut paths = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_name = entry.file_name();
            let file_name = file_name.to_str()?;
            (file_name.starts_with(&prefix) && file_name.ends_with(".cmd")).then(|| entry.path())
        })
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn start_smoke_command_monitor(app: tauri::AppHandle, command_path: PathBuf) {
    let snapshot_path = command_path.with_extension("snapshot.json");
    std::thread::spawn(move || loop {
        for published_path in pending_smoke_command_paths(&command_path) {
            let Ok(raw_command) = std::fs::read_to_string(&published_path) else {
                continue;
            };
            if let Some(command) = parse_smoke_command(&raw_command) {
                match command {
                    SmokeCommand::Toggle(_) => {
                        if let Err(error) = toggle_scene_inner(&app) {
                            log::error!("smoke toggle command failed: {error}");
                        }
                    }
                    SmokeCommand::Snapshot(sequence) => {
                        let snapshot = app.state::<Database>().list_tasks().and_then(|tasks| {
                            serde_json::to_vec_pretty(&serde_json::json!({
                                "sequence": sequence,
                                "tasks": tasks,
                            }))
                            .map_err(AppError::from)
                        });
                        match snapshot {
                            Ok(snapshot) => {
                                if let Err(error) = std::fs::write(&snapshot_path, snapshot) {
                                    log::error!("smoke snapshot write failed: {error}");
                                }
                            }
                            Err(error) => {
                                log::error!("smoke snapshot failed: {error}");
                            }
                        }
                    }
                }
            }
            if let Err(error) = std::fs::remove_file(&published_path) {
                log::warn!("smoke command cleanup failed: {error}");
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let smoke_diagnostics = std::env::var_os("BLACKHOLE_SMOKE_DIAGNOSTICS_PATH")
        .map(PathBuf::from)
        .or_else(diagnostics_path_from_args)
        .or_else(diagnostics_path_from_marker);
    let smoke_command_path = smoke_diagnostics
        .as_ref()
        .map(|path| path.with_extension("command"));
    if let Some(path) = &smoke_diagnostics {
        let _ = std::fs::write(path, "build=native-cursor-v5 phase=process-started");
    }
    let smoke_mode = smoke_diagnostics.is_some();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("orb") {
                let _ = window.show();
            }
            let _ = set_scene_expanded_inner(app, true, true);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match shortcut.to_string().as_str() {
                        "Ctrl+Shift+Space" => {
                            let _ = toggle_scene_inner(app);
                        }
                        "Ctrl+Shift+N" => {
                            let _ = open_scene_quick_add(app);
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
        );
    let builder = if smoke_mode {
        builder
    } else {
        builder.plugin(tauri_plugin_autostart::Builder::new().build())
    };
    builder
        .setup(move |app| {
            if let Some(path) = &smoke_diagnostics {
                let _ = std::fs::write(path, "build=native-cursor-v5 phase=setup-entered");
            }
            let data_dir = app.path().app_data_dir()?;
            let db = Database::open(&data_dir)
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            if let Some(path) = &smoke_diagnostics {
                let _ = std::fs::write(path, "build=native-cursor-v5 phase=database-opened");
            }
            let settings = db.get_settings().unwrap_or_default();
            app.manage(db);
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
            if let Some(orb) = app.get_webview_window("orb") {
                orb.show()?;
            }
            if let Some(path) = smoke_command_path.clone() {
                start_smoke_command_monitor(app.handle().clone(), path);
            }
            if !smoke_mode {
                if let Err(error) = setup_tray(app) {
                    log::error!("system tray initialization failed: {error}");
                }
            }
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let shortcuts: &[&str] = if smoke_mode {
                &["Ctrl+Shift+Space"]
            } else {
                &["Ctrl+Shift+Space", "Ctrl+Shift+B", "Ctrl+Shift+N"]
            };
            for shortcut in shortcuts {
                if let Err(error) = app.global_shortcut().register(*shortcut) {
                    log::warn!("global shortcut {shortcut} unavailable: {error}");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_visual_comparison_mode,
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
            set_scene_expanded,
            save_orb_position,
            restore_orb_position,
            set_click_through,
            set_always_on_top,
            show_orb_menu,
            report_orb_render,
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

#[cfg(test)]
mod smoke_command_tests {
    use super::{
        normalize_visual_comparison_mode, parse_smoke_command, pending_smoke_command_paths,
        SmokeCommand,
    };

    #[test]
    fn normalizes_visual_comparison_modes() {
        assert_eq!(
            normalize_visual_comparison_mode(Some("baseline")),
            "baseline"
        );
        assert_eq!(
            normalize_visual_comparison_mode(Some("candidate")),
            "candidate"
        );
        assert_eq!(normalize_visual_comparison_mode(Some("split")), "split");
        assert_eq!(normalize_visual_comparison_mode(Some("invalid")), "normal");
        assert_eq!(normalize_visual_comparison_mode(None), "normal");
    }

    #[test]
    fn parses_toggle_and_snapshot_commands() {
        assert_eq!(
            parse_smoke_command("toggle:7"),
            Some(SmokeCommand::Toggle(7))
        );
        assert_eq!(
            parse_smoke_command("snapshot:11"),
            Some(SmokeCommand::Snapshot(11))
        );
        assert_eq!(parse_smoke_command("snapshot:x"), None);
        assert_eq!(parse_smoke_command("unknown:1"), None);
    }

    #[test]
    fn orders_only_published_command_files() {
        let unique = format!("blackhole-smoke-{}", std::process::id());
        let directory = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(&directory).expect("create smoke command test directory");
        let command_path = directory.join("transport.command");
        let first = directory.join("transport.command.000001.cmd");
        let second = directory.join("transport.command.000002.cmd");
        let temporary = directory.join("transport.command.000003.cmd.tmp");
        std::fs::write(&second, "toggle:2").expect("write second command");
        std::fs::write(&temporary, "toggle:3").expect("write temporary command");
        std::fs::write(&first, "toggle:1").expect("write first command");

        assert_eq!(
            pending_smoke_command_paths(&command_path),
            vec![first, second]
        );

        std::fs::remove_dir_all(directory).expect("remove smoke command test directory");
    }
}
