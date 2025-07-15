use wasm_bindgen::prelude::*;

// This section defines the host functions (from Node.js's 'fs' module)
// that we expect JavaScript to provide to us.
#[wasm_bindgen(module = "/fs-adapter.js")]
extern "C" {
    #[wasm_bindgen(js_name = readFileSync, catch)]
    fn read_file_sync(path: &str) -> Result<String, JsValue>;

    #[wasm_bindgen(js_name = writeFileSync, catch)]
    fn write_file_sync(path: &str, content: &str) -> Result<(), JsValue>;
}

// This is the function our AI will call. It calls the host function.
#[wasm_bindgen(js_name = readFile)]
pub fn read_file(path: &str) -> Result<String, JsValue> {
    read_file_sync(path)
}

// This is the function our AI will call. It calls the host function.
#[wasm_bindgen(js_name = writeFile)]
pub fn write_file(path: &str, content: &str) -> Result<(), JsValue> {
    write_file_sync(path, content)?;
    Ok(())
}