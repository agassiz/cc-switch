//! 请求/响应体文件存储模块
//!
//! 将请求和响应的原始数据保存到文件系统，供后续查看。
//! 存储路径: ~/.cc-switch/request_logs/{request_id}.json
//! 最多保留 MAX_FILES 个文件，超出时删除最旧的文件。

use crate::config::get_app_config_dir;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

/// 最大保留文件数
const MAX_FILES: usize = 1000;

/// 请求/响应 payload 数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestPayload {
    /// 请求体
    pub request: Value,
    /// 响应体（非流式为完整 JSON，流式为 SSE 事件数组）
    pub response: Value,
    /// 是否为流式请求
    pub is_streaming: bool,
    /// 时间戳（Unix 秒）
    pub timestamp: i64,
}

/// 获取存储目录
fn get_logs_dir() -> PathBuf {
    get_app_config_dir().join("request_logs")
}

/// 保存 payload 到文件
///
/// 异步友好：在 spawn_blocking 中执行文件 I/O
pub fn save_payload(request_id: &str, payload: &RequestPayload) {
    let dir = get_logs_dir();

    // 确保目录存在
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!("[PAYLOAD] 创建目录失败: {e}");
        return;
    }

    let file_path = dir.join(format!("{request_id}.json"));

    // 序列化并写入（使用 temp + rename 保证原子性）
    let tmp_path = dir.join(format!("{request_id}.json.tmp"));
    match serde_json::to_vec(payload) {
        Ok(data) => {
            if let Err(e) = std::fs::write(&tmp_path, &data) {
                log::warn!("[PAYLOAD] 写入临时文件失败: {e}");
                return;
            }
            if let Err(e) = std::fs::rename(&tmp_path, &file_path) {
                log::warn!("[PAYLOAD] 重命名文件失败: {e}");
                // 清理临时文件
                let _ = std::fs::remove_file(&tmp_path);
                return;
            }
            log::debug!("[PAYLOAD] 已保存: {}", file_path.display());
        }
        Err(e) => {
            log::warn!("[PAYLOAD] 序列化失败: {e}");
        }
    }

    // 清理旧文件
    cleanup_old_files(&dir);
}

/// 读取 payload 文件
pub fn read_payload(request_id: &str) -> Option<RequestPayload> {
    let file_path = get_logs_dir().join(format!("{request_id}.json"));
    let data = std::fs::read(&file_path).ok()?;
    serde_json::from_slice(&data).ok()
}

/// 清理旧文件，保留最新的 MAX_FILES 个
fn cleanup_old_files(dir: &PathBuf) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    // 收集 .json 文件及其修改时间
    let mut files: Vec<(PathBuf, std::time::SystemTime)> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "json")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((e.path(), modified))
        })
        .collect();

    if files.len() <= MAX_FILES {
        return;
    }

    // 按修改时间排序（旧的在前）
    files.sort_by_key(|(_, time)| *time);

    // 删除超出部分
    let to_delete = files.len() - MAX_FILES;
    for (path, _) in files.iter().take(to_delete) {
        if let Err(e) = std::fs::remove_file(path) {
            log::warn!("[PAYLOAD] 删除旧文件失败: {} - {e}", path.display());
        } else {
            log::debug!("[PAYLOAD] 已清理旧文件: {}", path.display());
        }
    }

    log::debug!("[PAYLOAD] 清理完成，删除了 {to_delete} 个旧文件");
}

/// 清空所有 payload 文件
pub fn clear_all_payloads() -> u64 {
    let dir = get_logs_dir();
    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(_) => return 0,
    };

    let mut count = 0u64;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|ext| ext == "json").unwrap_or(false) {
            if std::fs::remove_file(&path).is_ok() {
                count += 1;
            }
        }
    }
    log::info!("[PAYLOAD] 已清空 {count} 个 payload 文件");
    count
}

/// 异步保存 payload（在后台线程执行）
pub fn spawn_save_payload(request_id: String, payload: RequestPayload) {
    tokio::task::spawn_blocking(move || {
        save_payload(&request_id, &payload);
    });
}
