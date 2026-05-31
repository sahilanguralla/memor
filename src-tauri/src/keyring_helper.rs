use keyring::Entry;

const SERVICE_NAME: &str = "memor-app";
const USER_NAME: &str = "master-password";

pub fn save_password(password: &str) -> Result<(), String> {
    match Entry::new(SERVICE_NAME, USER_NAME) {
        Ok(entry) => {
            if let Err(e) = entry.set_password(password) {
                Err(format!("Failed to set password in keyring: {}", e))
            } else {
                Ok(())
            }
        }
        Err(e) => Err(format!("Failed to access keyring: {}", e)),
    }
}

pub fn get_password() -> Result<String, String> {
    match Entry::new(SERVICE_NAME, USER_NAME) {
        Ok(entry) => match entry.get_password() {
            Ok(pass) => Ok(pass),
            Err(e) => Err(format!("Failed to retrieve password: {}", e)),
        },
        Err(e) => Err(format!("Failed to access keyring: {}", e)),
    }
}

pub fn delete_password() -> Result<(), String> {
    match Entry::new(SERVICE_NAME, USER_NAME) {
        Ok(entry) => match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(format!("Failed to delete password: {}", e)),
        },
        Err(e) => Err(format!("Failed to access keyring: {}", e)),
    }
}
