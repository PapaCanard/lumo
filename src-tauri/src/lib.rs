// Lumo — câblage de l'application et commandes appelées par l'interface.

mod appbar;
mod providers;
mod secrets;
mod web;

use std::collections::HashMap;

use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use tauri_plugin_autostart::MacosLauncher;

const WINDOW: &str = "main";

/// Pour chaque IA demandée : a-t-elle un identifiant enregistré ? (jamais la valeur)
#[tauri::command]
fn cred_status(ids: Vec<String>) -> HashMap<String, bool> {
    ids.into_iter()
        .map(|id| {
            let ok = secrets::valid_id(&id) && secrets::present(&id);
            (id, ok)
        })
        .collect()
}

#[tauri::command]
fn cred_save(id: String, secret: String) -> Result<(), String> {
    secrets::set(&id, &secret)
}

#[tauri::command]
fn cred_delete(id: String) -> Result<(), String> {
    secrets::clear(&id)
}

fn key_for(cred: &str) -> String {
    if cred.is_empty() { String::new() } else { secrets::get(cred).unwrap_or_default() }
}

/// `kind` : claude | gemini | openai | copilot. `cred` : l'id de l'IA dont on prend la clé.
/// `body` est la requête déjà construite par l'interface (format propre à chaque IA),
/// sauf pour Copilot où c'est `{ "prompt": "..." }`.
#[tauri::command]
async fn ask_provider(kind: String, cred: String, model: String, body: Value, base_url: Option<String>) -> Result<Value, String> {
    let key = key_for(&cred);
    match kind.as_str() {
        "claude" | "gemini" => {
            if key.is_empty() {
                return Err("http 401: aucun identifiant enregistré".to_string());
            }
            providers::http_call(&kind, &model, body, &key, None).await
        }
        // Un serveur local n'a pas forcément de clé : on laisse l'API répondre.
        "openai" => providers::http_call("openai", &model, body, &key, base_url.as_deref()).await,
        "copilot" => {
            if key.is_empty() {
                return Err("http 401: aucun jeton GitHub enregistré".to_string());
            }
            let prompt = body
                .get("prompt")
                .and_then(Value::as_str)
                .ok_or_else(|| "requête Copilot invalide".to_string())?;
            let text = providers::copilot_call(&model, prompt, &key).await?;
            Ok(json!({ "text": text }))
        }
        other => Err(format!("type d'IA inconnu : {other}")),
    }
}

#[tauri::command]
async fn list_models(kind: String, cred: String, base_url: Option<String>) -> Result<Vec<String>, String> {
    providers::list_models(&kind, &key_for(&cred), base_url.as_deref()).await
}

/// Lit une page publique d'internet pour une IA (les adresses locales et privées sont refusées).
#[tauri::command]
async fn web_fetch(url: String) -> Result<web::Page, String> {
    web::fetch(&url).await
}

/// Recherche avec un moteur à clé ; la clé est rangée sous « search-<moteur> ».
#[tauri::command]
async fn web_search_api(engine: String, query: String, count: u32) -> Result<Value, String> {
    let key = key_for(&format!("search-{engine}"));
    web::search_api(&engine, &key, &query, count).await
}

#[tauri::command]
async fn copilot_check() -> Result<String, String> {
    providers::copilot_version().await
}

/// Colle la fenêtre en haut de l'écran principal, sur toute sa largeur, à `height` pixels logiques.
#[tauri::command]
fn dock(app: AppHandle, height: f64) -> Result<(), String> {
    let w = app.get_webview_window(WINDOW).ok_or("fenêtre introuvable")?;
    let monitor = w
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .or(w.current_monitor().map_err(|e| e.to_string())?)
        .ok_or("aucun écran détecté")?;
    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    w.set_size(PhysicalSize::new(size.width, (height * scale).round() as u32))
        .map_err(|e| e.to_string())?;
    w.set_position(PhysicalPosition::new(pos.x, pos.y)).map_err(|e| e.to_string())?;
    Ok(())
}

/// Réserve (ou libère) la bande du haut : les fenêtres maximisées s'arrêtent sous la barre.
#[tauri::command]
fn appbar(app: AppHandle, enable: bool, height: f64) -> Result<(), String> {
    let w = app.get_webview_window(WINDOW).ok_or("fenêtre introuvable")?;
    let monitor = w
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("aucun écran détecté")?;
    let pos = monitor.position();
    let size = monitor.size();
    let h = (height * monitor.scale_factor()).round() as i32;
    #[cfg(windows)]
    {
        let hwnd = w.hwnd().map_err(|e| e.to_string())?;
        appbar::set(hwnd.0 as isize, enable, (pos.x, pos.y, pos.x + size.width as i32, pos.y + h));
    }
    #[cfg(not(windows))]
    let _ = (enable, pos, size, h);
    Ok(())
}

/// Libère la place réservée en haut de l'écran, puis quitte.
fn shutdown(app: &AppHandle) {
    #[cfg(windows)]
    if let Some(w) = app.get_webview_window(WINDOW) {
        if let Ok(h) = w.hwnd() {
            appbar::set(h.0 as isize, false, (0, 0, 0, 0));
        }
    }
    app.exit(0);
}

#[tauri::command]
fn quit(app: AppHandle) {
    shutdown(&app);
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WINDOW) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Afficher / masquer Lumo", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Réglages…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &settings, &sep, &quit])?;

    let mut builder = TrayIconBuilder::with_id("lumo")
        .tooltip("Lumo")
        .menu(&menu)
        .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
            "quit" => shutdown(app),
            "settings" => {
                show_main(app);
                let _ = app.emit_to(WINDOW, "open-settings", ());
            }
            "toggle" => {
                if let Some(w) = app.get_webview_window(WINDOW) {
                    if w.is_visible().unwrap_or(true) {
                        let _ = w.hide();
                    } else {
                        show_main(app);
                    }
                }
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // Une seule instance : relancer Lumo ramène simplement le compagnon.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            cred_status,
            cred_save,
            cred_delete,
            ask_provider,
            copilot_check,
            list_models,
            web_fetch,
            web_search_api,
            dock,
            appbar,
            quit
        ])
        .setup(|app| {
            build_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Lumo");
}
