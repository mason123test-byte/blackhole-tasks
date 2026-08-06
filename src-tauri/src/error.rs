use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误：{0}")] Database(String),
    #[error("数据校验失败：{0}")] Validation(String),
    #[error("未找到：{0}")] NotFound(String),
    #[error("冲突：{0}")] Conflict(String),
    #[error("窗口操作失败：{0}")] Window(String),
    #[error("文件操作失败：{0}")] Io(String),
    #[error("序列化失败：{0}")] Serialization(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload { code: &'static str, message: String }

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
        let code = match self { Self::Database(_) => "DATABASE", Self::Validation(_) => "VALIDATION", Self::NotFound(_) => "NOT_FOUND", Self::Conflict(_) => "CONFLICT", Self::Window(_) => "WINDOW", Self::Io(_) => "IO", Self::Serialization(_) => "SERIALIZATION" };
        ErrorPayload { code, message: self.to_string() }.serialize(serializer)
    }
}

impl From<rusqlite::Error> for AppError { fn from(value: rusqlite::Error) -> Self { Self::Database(value.to_string()) } }
impl From<std::io::Error> for AppError { fn from(value: std::io::Error) -> Self { Self::Io(value.to_string()) } }
impl From<serde_json::Error> for AppError { fn from(value: serde_json::Error) -> Self { Self::Serialization(value.to_string()) } }
pub type AppResult<T> = Result<T, AppError>;

