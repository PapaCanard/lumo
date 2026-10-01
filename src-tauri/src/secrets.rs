// Les identifiants vivent dans le Gestionnaire d'identifiants de Windows.
// Jamais sur disque, jamais renvoyés à l'interface : elle peut seulement
// demander « y a-t-il une clé pour cette IA ? ».
// Chaque IA ajoutée a son propre identifiant, rangé sous son id (ex. « claude », « c-k3j9x2 »).

use keyring::Entry;

const SERVICE: &str = "fr.doitconsulting.lumo";

/// Un id d'IA : minuscules, chiffres, « - » ou « _ », 48 caractères au plus.
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 48
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn entry(id: &str) -> Result<Entry, String> {
    if !valid_id(id) {
        return Err(format!("identifiant d'IA invalide : {id}"));
    }
    Entry::new(SERVICE, id).map_err(|e| e.to_string())
}

pub fn get(id: &str) -> Option<String> {
    entry(id).ok()?.get_password().ok().filter(|v| !v.is_empty())
}

pub fn set(id: &str, secret: &str) -> Result<(), String> {
    let secret = secret.trim();
    if secret.is_empty() {
        return clear(id);
    }
    entry(id)?.set_password(secret).map_err(|e| e.to_string())
}

pub fn clear(id: &str) -> Result<(), String> {
    match entry(id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn present(id: &str) -> bool {
    get(id).is_some()
}
