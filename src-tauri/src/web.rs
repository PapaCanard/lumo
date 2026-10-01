// Accès à internet pour les IA : lecture de pages publiques et moteurs de recherche à clé.
//
// L'interface décide quoi chercher ou lire (selon l'IA) ; ici on ne fait que télécharger,
// en refusant toute adresse locale ou privée (localhost, 192.168.x.x…) pour qu'une IA
// ne puisse pas fouiller le PC ou le réseau de l'utilisateur.

use std::net::IpAddr;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const MAX_BYTES: usize = 3 * 1024 * 1024;

/// Vrai si l'adresse est une page publique d'internet (http/https, ni locale ni privée).
fn is_public(url: &reqwest::Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    let host = match url.host_str() {
        Some(h) => h.trim_start_matches('[').trim_end_matches(']').to_ascii_lowercase(),
        None => return false,
    };
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => {
            let o = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || o[0] == 0
                || (o[0] == 100 && (o[1] & 0xc0) == 64))
        }
        Ok(IpAddr::V6(ip)) => {
            let s = ip.segments()[0];
            !(ip.is_loopback() || ip.is_unspecified() || (s & 0xfe00) == 0xfc00 || (s & 0xffc0) == 0xfe80)
        }
        Err(_) => {
            host.contains('.')
                && !(host == "localhost"
                    || host.ends_with(".localhost")
                    || host.ends_with(".local")
                    || host.ends_with(".internal")
                    || host.ends_with(".lan")
                    || host.ends_with(".home"))
        }
    }
}

#[derive(Serialize)]
pub struct Page {
    pub url: String,
    pub status: u16,
    pub content_type: String,
    pub body: String,
}

fn network(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "timeout: la page met trop de temps à répondre".to_string()
    } else {
        format!("network: {e}")
    }
}

/// Télécharge une page publique (HTML, texte ou JSON), 3 Mo au plus.
pub async fn fetch(url: &str) -> Result<Page, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| "adresse invalide".to_string())?;
    if !is_public(&parsed) {
        return Err("adresse refusée : seules les pages publiques d'internet peuvent être lues".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(UA)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 8 {
                attempt.error("trop de redirections")
            } else if !is_public(attempt.url()) {
                attempt.error("redirection vers une adresse privée refusée")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|e| e.to_string())?;
    let mut resp = client
        .get(parsed)
        .header("Accept", "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5")
        .header("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8")
        .send()
        .await
        .map_err(network)?;
    let status = resp.status().as_u16();
    let final_url = resp.url().to_string();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let ct = content_type.to_ascii_lowercase();
    if !(ct.is_empty() || ct.contains("html") || ct.contains("text") || ct.contains("json") || ct.contains("xml")) {
        return Err(format!("contenu non lisible par Lumo ({content_type})"));
    }
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(network)? {
        buf.extend_from_slice(&chunk);
        if buf.len() > MAX_BYTES {
            buf.truncate(MAX_BYTES);
            break;
        }
    }
    Ok(Page { url: final_url, status, content_type, body: String::from_utf8_lossy(&buf).into_owned() })
}

/// Recherche via un moteur à clé (Tavily ou Brave Search). Renvoie la réponse brute du moteur.
pub async fn search_api(engine: &str, key: &str, query: &str, count: u32) -> Result<Value, String> {
    if key.is_empty() {
        return Err("http 401: aucune clé enregistrée pour ce moteur de recherche".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let n = count.clamp(1, 10).to_string();
    let request = match engine {
        "tavily" => client
            .post("https://api.tavily.com/search")
            .bearer_auth(key)
            .json(&json!({ "query": query, "max_results": count.clamp(1, 10), "search_depth": "basic" })),
        "brave" => {
            let url = reqwest::Url::parse_with_params(
                "https://api.search.brave.com/res/v1/web/search",
                &[("q", query), ("count", n.as_str()), ("search_lang", "fr")],
            )
            .map_err(|e| e.to_string())?;
            client.get(url).header("X-Subscription-Token", key).header("Accept", "application/json")
        }
        other => return Err(format!("moteur de recherche inconnu : {other}")),
    };
    let response = request.send().await.map_err(network)?;
    let status = response.status();
    let text = response.text().await.map_err(network)?;
    if !status.is_success() {
        return Err(crate::providers::http_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text).map_err(|e| format!("réponse illisible : {e}"))
}
