use wasm_bindgen::prelude::*;
//for the testing
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Rust, {}!", name)
}
#[wasm_bindgen]
pub fn read_file(path: &str) -> Result<String, JsValue> {
    if path == "test.txt" {
        Ok("This is the content of test.txt, read via a Wasm plugin!".to_string())
    } else {
        Err(JsValue::from_str("File not found"))
    }
}