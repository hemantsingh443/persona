use wasm_bindgen::prelude::*;
use chrono::{DateTime, Utc, Duration};
use serde::Serialize; 
use std::collections::HashMap;
use std::sync::Mutex;

#[macro_use]
extern crate lazy_static;

#[derive(Serialize, Clone)] 
struct ScheduledTask {
    execute_at: DateTime<Utc>,
    message: String,
}

lazy_static! {
    static ref TASKS: Mutex<HashMap<String, ScheduledTask>> = Mutex::new(HashMap::new());
}

fn parse_time(time_str: &str) -> Result<DateTime<Utc>, String> {
    let parts: Vec<&str> = time_str.split_whitespace().collect();
    if parts.len() != 2 {
        return Err("Invalid time format. Use 'amount unit', e.g., '1 minute'".to_string());
    }
    let amount: i64 = parts[0].parse().map_err(|_| "Invalid number".to_string())?;
    let unit = parts[1].to_lowercase().replace("s", "");

    let duration = match unit.as_str() {
        "minute" => Duration::minutes(amount),
        "hour" => Duration::hours(amount),
        "second" => Duration::seconds(amount),
        _ => return Err("Unsupported unit. Use seconds, minutes, or hours.".to_string()),
    };

    Ok(Utc::now() + duration)
}

#[wasm_bindgen(js_name = addTask)]
pub fn add_task(execute_at_timestamp: &str, message: &str) -> Result<String, String> {
    let timestamp: i64 = execute_at_timestamp.parse().map_err(|_| "Invalid timestamp".to_string())?;
    let execute_at = DateTime::from_timestamp(timestamp, 0).ok_or("Invalid timestamp")?;

    let task = ScheduledTask { execute_at, message: message.to_string() };
    let task_id = format!("task_{}", Utc::now().timestamp_nanos());
    TASKS.lock().unwrap().insert(task_id, task);

    Ok(format!("Task scheduled for {}", execute_at.to_rfc2822()))
}

#[wasm_bindgen(js_name = checkTasks)]
pub fn check_tasks() -> JsValue {
    let mut due_tasks_messages: Vec<String> = Vec::new();
    let now = Utc::now();

    let mut tasks = TASKS.lock().unwrap();
    let mut tasks_to_remove: Vec<String> = Vec::new();

    for (id, task) in tasks.iter() {
        if now >= task.execute_at {
            due_tasks_messages.push(task.message.clone());
            tasks_to_remove.push(id.clone());
        }
    }

    for id in tasks_to_remove {
        tasks.remove(&id);
    }
    JsValue::from_serde(&due_tasks_messages).unwrap_or(JsValue::NULL)
}