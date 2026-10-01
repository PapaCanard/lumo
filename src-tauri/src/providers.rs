// Appels vers les IA. Aucune dépendance à Tauri : tout est testable seul.
//
// Claude, Gemini et toutes les API compatibles OpenAI (OpenAI, Mistral, OpenRouter,
// Groq, DeepSeek, Ollama, LM Studio…) : la clé est ajoutée ici (côté Rust),
// l'interface ne la voit jamais.
// Copilot : pas d'API « clé + HTTP » publique pour Copilot. On passe par la CLI
// officielle GitHub Copilot en mode non interactif, authentifiée par un jeton
// GitHub (variable COPILOT_GITHUB_TOKEN). Aucun outil n'est autorisé : la CLI
// ne peut ni lire ni écrire de fichiers, elle ne fait que répondre.

use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const HTTP_TIMEOUT: Duration = Duration::from_secs(120);
// Un modèle local peut mettre du temps à se charger en mémoire.
const LOCAL_TIMEOUT: Duration = Duration::from_secs(300);
const CLI_TIMEOUT: Duration = Duration::from_secs(180);

/// Empêche une console de clignoter quand on lance la CLI.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn valid_model(model: &str) -> bool {
    !model.is_empty()
        && model.len() <= 100
        && model.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':'))
}

/// Erreur lisible : « http 401: message » — l'interface s'en sert pour choisir l'animation.
pub(crate) fn http_error(status: u16, body: &str) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            v.pointer("/error/message")
                .or_else(|| v.get("message"))
                .and_then(|m| m.as_str().map(str::to_owned))
        })
        .unwrap_or_else(|| body.chars().take(300).collect());
    format!("http {status}: {message}")
}

/// Adresse d'une API compatible OpenAI (cloud ou locale), sans « / » final.
pub fn clean_base_url(url: &str) -> Result<String, String> {
    let u = url.trim().trim_end_matches('/');
    if !(u.starts_with("http://") || u.starts_with("https://")) || u.contains(char::is_whitespace) || u.len() > 300 {
        return Err("adresse du serveur invalide (attendu : http://localhost:11434/v1 ou https://…/v1)".into());
    }
    Ok(u.to_string())
}

/// Claude (Anthropic Messages API), Gemini (generateContent) ou API compatible OpenAI (`openai`).
/// `key` est vide pour un serveur local sans authentification.
pub async fn http_call(provider: &str, model: &str, body: Value, key: &str, base_url: Option<&str>) -> Result<Value, String> {
    // Le nom du modèle entre dans l'URL pour Gemini : on le contrôle. Ailleurs il va dans le JSON
    // (OpenRouter utilise « éditeur/modèle », Ollama « hf.co/x/y:Q4 »…).
    if provider == "gemini" && !valid_model(model) {
        return Err("nom de modèle invalide".into());
    }
    let timeout = if provider == "openai" { LOCAL_TIMEOUT } else { HTTP_TIMEOUT };
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| e.to_string())?;

    let request = match provider {
        "claude" => client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01"),
        "gemini" => client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            ))
            .header("x-goog-api-key", key),
        "openai" => {
            let base = clean_base_url(base_url.unwrap_or(""))?;
            let r = client.post(format!("{base}/chat/completions"));
            if key.is_empty() { r } else { r.bearer_auth(key) }
        }
        other => return Err(format!("fournisseur HTTP inconnu : {other}")),
    };

    let response = request.json(&body).send().await.map_err(|e| {
        if e.is_timeout() {
            "timeout: la réponse a pris trop de temps".to_string()
        } else {
            format!("network: {e}")
        }
    })?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("network: {e}"))?;
    if !status.is_success() {
        return Err(http_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text).map_err(|e| format!("réponse illisible : {e}"))
}

async fn run_copilot(program: &str, pre_args: &[&str], model: &str, prompt: &str, token: &str)
    -> std::io::Result<std::process::Output>
{
    let mut cmd = Command::new(program);
    cmd.args(pre_args)
        .arg("-s")
        .arg("--no-ask-user")
        .env("COPILOT_GITHUB_TOKEN", token)
        .current_dir(std::env::temp_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if !model.is_empty() {
        cmd.arg("--model").arg(model);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        // Le prompt passe par l'entrée standard : pas de souci de guillemets.
        // Si la CLI s'arrête avant d'avoir tout lu, l'erreur utile est dans sa sortie, pas ici.
        let _ = stdin.write_all(prompt.as_bytes()).await;
        let _ = stdin.shutdown().await;
    }
    match tokio::time::timeout(CLI_TIMEOUT, child.wait_with_output()).await {
        Ok(result) => result,
        Err(_) => Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout")),
    }
}

/// Copilot via la CLI officielle.
pub async fn copilot_call(model: &str, prompt: &str, token: &str) -> Result<String, String> {
    if !model.is_empty() && !valid_model(model) {
        return Err("nom de modèle invalide".into());
    }
    // `copilot.exe` (winget) d'abord ; `copilot.cmd` (npm) via cmd.exe ensuite.
    let output = match run_copilot("copilot", &[], model, prompt, token).await {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            run_copilot("cmd", &["/C", "copilot"], model, prompt, token).await
        }
        other => other,
    };
    let output = match output {
        Ok(o) => o,
        Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
            return Err("timeout: Copilot n'a pas répondu à temps".into())
        }
        Err(e) => return Err(format!("cli-missing: {e}")),
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() && !stdout.is_empty() {
        return Ok(stdout);
    }
    let tail: String = stderr.chars().rev().take(400).collect::<Vec<_>>().into_iter().rev().collect();
    let lower = tail.to_lowercase();
    if lower.contains("not recognized") || lower.contains("introuvable") || lower.contains("not found") {
        return Err("cli-missing: la CLI Copilot n'est pas installée".into());
    }
    if lower.contains("auth") || lower.contains("token") || lower.contains("login") || lower.contains("401") {
        return Err(format!("http 401: {tail}"));
    }
    Err(if tail.is_empty() { "copilot: réponse vide".into() } else { format!("copilot: {tail}") })
}

/// Vérifie que la CLI est installée ; renvoie sa version.
pub async fn copilot_version() -> Result<String, String> {
    async fn version(program: &str, pre: &[&str]) -> std::io::Result<std::process::Output> {
        let mut cmd = Command::new(program);
        cmd.args(pre).arg("--version").stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        tokio::time::timeout(Duration::from_secs(15), cmd.output())
            .await
            .unwrap_or_else(|_| Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout")))
    }
    let out = match version("copilot", &[]).await {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => version("cmd", &["/C", "copilot"]).await,
        other => other,
    }
    .map_err(|e| format!("cli-missing: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() && !text.is_empty() {
        Ok(text.lines().next().unwrap_or("").to_string())
    } else {
        Err("cli-missing: la CLI Copilot n'est pas installée".into())
    }
}

/// Liste les modèles proposés par une IA, pour le menu déroulant des réglages.
/// Copilot n'a pas de liste publique : on renvoie une liste vide (saisie libre).
pub async fn list_models(kind: &str, key: &str, base_url: Option<&str>) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let request = match kind {
        "claude" => client
            .get("https://api.anthropic.com/v1/models?limit=100")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01"),
        "gemini" => client
            .get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200")
            .header("x-goog-api-key", key),
        "openai" => {
            let base = clean_base_url(base_url.unwrap_or(""))?;
            let r = client.get(format!("{base}/models"));
            if key.is_empty() { r } else { r.bearer_auth(key) }
        }
        _ => return Ok(Vec::new()),
    };
    let response = request.send().await.map_err(|e| format!("network: {e}"))?;
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("network: {e}"))?;
    if !status.is_success() {
        return Err(http_error(status.as_u16(), &text));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("réponse illisible : {e}"))?;
    let mut ids: Vec<String> = if kind == "gemini" {
        v.get("models")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter(|m| {
                        m.get("supportedGenerationMethods")
                            .and_then(Value::as_array)
                            .map_or(true, |g| g.iter().any(|x| x.as_str() == Some("generateContent")))
                    })
                    .filter_map(|m| m.get("name").and_then(Value::as_str))
                    .map(|n| n.trim_start_matches("models/").to_owned())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        v.get("data")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(|m| m.get("id").and_then(Value::as_str).map(str::to_owned)).collect())
            .unwrap_or_default()
    };
    ids.sort();
    ids.dedup();
    Ok(ids)
}

/// Réponse factice utilisée par les tests.
#[allow(dead_code)]
pub fn echo(text: &str) -> Value {
    json!({ "text": text })
}
