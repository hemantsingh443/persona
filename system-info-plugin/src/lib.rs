use wasm_bindgen::prelude::*;
use serde::Serialize;

#[derive(Serialize)]
pub struct SystemStatus {
    cpu_load: Vec<f64>,
    free_memory: f64,
    total_memory: f64,
}

#[wasm_bindgen(module = "/os-adapter.js")]
extern "C" {
    #[wasm_bindgen(js_name = getCpuLoad)]
    fn get_cpu_load() -> Vec<f64>;

    #[wasm_bindgen(js_name = getFreeMemory)]
    fn get_free_memory() -> f64;

    #[wasm_bindgen(js_name = getTotalMemory)]
    fn get_total_memory() -> f64;
}

#[wasm_bindgen(js_name = getStatus)]
pub fn get_status() -> String {
    let status = SystemStatus {
        cpu_load: get_cpu_load(),
        free_memory: get_free_memory(),
        total_memory: get_total_memory(),
    };

    serde_json::to_string(&status).unwrap_or_else(|_| "{}".to_string())
}