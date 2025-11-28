use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Disable WebView data persistence (form history, autofill, etc.)
            if let Some(webview) = app.get_webview_window("main") {
                // Clear any cached form data and disable autofill
                webview.eval(r#"
                    // Clear stored form data
                    try {
                        sessionStorage.clear();
                    } catch(e) {}
                    
                    // Disable form autofill on all inputs
                    const disableAutofill = () => {
                        document.querySelectorAll('input').forEach(input => {
                            input.setAttribute('autocomplete', 'off');
                            input.setAttribute('autocorrect', 'off');
                            input.setAttribute('autocapitalize', 'off');
                            input.setAttribute('spellcheck', 'false');
                        });
                        document.querySelectorAll('form').forEach(form => {
                            form.setAttribute('autocomplete', 'off');
                        });
                    };
                    
                    // Run on load and observe for new elements
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', disableAutofill);
                    } else {
                        disableAutofill();
                    }
                    
                    // Observer for dynamically added inputs
                    const observer = new MutationObserver(disableAutofill);
                    observer.observe(document.body || document.documentElement, {
                        childList: true,
                        subtree: true
                    });
                "#).ok();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
