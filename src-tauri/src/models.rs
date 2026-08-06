use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub important: bool,
    pub urgent: bool,
    pub quadrant: String,
    pub priority: i64,
    pub progress: i64,
    pub canvas_x: f64,
    pub canvas_y: f64,
    pub width: f64,
    pub height: f64,
    pub parent_id: Option<String>,
    pub collapsed: bool,
    pub start_at: Option<String>,
    pub due_at: Option<String>,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
    pub estimated_minutes: Option<i64>,
    pub actual_minutes: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    #[serde(default)]
    pub tags: Vec<Tag>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub quadrant: Option<String>,
    pub priority: Option<i64>,
    pub canvas_x: Option<f64>,
    pub canvas_y: Option<f64>,
    pub due_at: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPositionUpdate {
    pub id: String,
    pub canvas_x: f64,
    pub canvas_y: f64,
    pub quadrant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRelation {
    pub id: String,
    pub source_task_id: String,
    pub target_task_id: String,
    pub relation_type: String,
    pub label: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRelationInput {
    pub source_task_id: String,
    pub target_task_id: String,
    pub relation_type: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub orb_always_on_top: bool,
    pub orb_click_through: bool,
    pub orb_position_x: i32,
    pub orb_position_y: i32,
    pub orb_monitor_id: Option<String>,
    pub render_quality: String,
    pub low_power_mode: bool,
    pub launch_at_startup: bool,
    pub close_delay_ms: u64,
    pub hover_open_delay_ms: u64,
    pub workspace_width: u32,
    pub workspace_height: u32,
    pub hide_completed_tasks: bool,
    pub complete_animation_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            orb_always_on_top: true,
            orb_click_through: false,
            orb_position_x: 0,
            orb_position_y: 0,
            orb_monitor_id: None,
            render_quality: "balanced".into(),
            low_power_mode: false,
            launch_at_startup: false,
            close_delay_ms: 350,
            hover_open_delay_ms: 120,
            workspace_width: 1100,
            workspace_height: 760,
            hide_completed_tasks: true,
            complete_animation_enabled: true,
        }
    }
}
