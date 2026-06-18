#[cfg(test)]
mod crypto_integration_tests {
    use aes_gcm::{
        aead::{Aead, KeyInit, OsRng},
        Aes256Gcm, Nonce,
    };
    use aes_gcm::aead::rand_core::RngCore;
    use argon2::Argon2;

    #[test]
    fn test_aes_gcm_encrypt_decrypt_roundtrip() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = b"Hello, this is a secret message!";
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();

        assert_ne!(ciphertext, plaintext, "Ciphertext must differ from plaintext");

        let decrypted = cipher.decrypt(nonce, ciphertext.as_ref()).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_gcm_wrong_key_fails_decryption() {
        let mut key1 = [0u8; 32];
        let mut key2 = [0u8; 32];
        OsRng.fill_bytes(&mut key1);
        OsRng.fill_bytes(&mut key2);

        let cipher1 = Aes256Gcm::new_from_slice(&key1).unwrap();
        let cipher2 = Aes256Gcm::new_from_slice(&key2).unwrap();

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = b"secret data";
        let ciphertext = cipher1.encrypt(nonce, plaintext.as_ref()).unwrap();
        let result = cipher2.decrypt(nonce, ciphertext.as_ref());
        assert!(result.is_err(), "Decryption with wrong key should fail");
    }

    #[test]
    fn test_aes_gcm_wrong_nonce_fails_decryption() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce1_bytes = [0u8; 12];
        let mut nonce2_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce1_bytes);
        OsRng.fill_bytes(&mut nonce2_bytes);

        let nonce1 = Nonce::from_slice(&nonce1_bytes);
        let nonce2 = Nonce::from_slice(&nonce2_bytes);

        let plaintext = b"secret data";
        let ciphertext = cipher.encrypt(nonce1, plaintext.as_ref()).unwrap();
        let result = cipher.decrypt(nonce2, ciphertext.as_ref());
        assert!(result.is_err(), "Decryption with wrong nonce should fail");
    }

    #[test]
    fn test_aes_gcm_tampered_ciphertext_fails() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = b"secret data";
        let mut ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();

        if !ciphertext.is_empty() {
            let mid = ciphertext.len() / 2;
            ciphertext[mid] ^= 0xFF;
        }

        let result = cipher.decrypt(nonce, ciphertext.as_ref());
        assert!(result.is_err(), "Decryption of tampered ciphertext should fail");
    }

    #[test]
    fn test_aes_gcm_empty_plaintext() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext: &[u8] = &[];
        let ciphertext = cipher.encrypt(nonce, plaintext).unwrap();
        let decrypted = cipher.decrypt(nonce, ciphertext.as_ref()).unwrap();
        assert!(decrypted.is_empty());
    }

    #[test]
    fn test_aes_gcm_large_payload() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = vec![0x41u8; 10000];
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).unwrap();
        let decrypted = cipher.decrypt(nonce, ciphertext.as_ref()).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_gcm_different_nonce_different_ciphertext() {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();

        let mut nonce1_bytes = [0u8; 12];
        let mut nonce2_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce1_bytes);
        OsRng.fill_bytes(&mut nonce2_bytes);

        let nonce1 = Nonce::from_slice(&nonce1_bytes);
        let nonce2 = Nonce::from_slice(&nonce2_bytes);

        let plaintext = b"test payload";
        let ct1 = cipher.encrypt(nonce1, plaintext.as_ref()).unwrap();
        let ct2 = cipher.encrypt(nonce2, plaintext.as_ref()).unwrap();
        assert_ne!(ct1, ct2, "Different nonces should produce different ciphertexts");
    }

    #[test]
    fn test_argon2_key_derivation_deterministic_with_same_salt() {
        let argon2 = Argon2::default();
        let salt = b"my-fixed-salt-16";
        let mut salt_arr = [0u8; 16];
        salt_arr.copy_from_slice(salt);

        let password1 = b"correct-horse-battery-staple";
        let mut key1 = [0u8; 32];
        argon2
            .hash_password_into(password1, &salt_arr, &mut key1)
            .unwrap();

        let mut key2 = [0u8; 32];
        argon2
            .hash_password_into(password1, &salt_arr, &mut key2)
            .unwrap();

        assert_eq!(key1, key2, "Same password + salt must produce same key");
    }

    #[test]
    fn test_argon2_different_password_different_key() {
        let argon2 = Argon2::default();
        let salt = b"some-salt-16byte";

        let mut key1 = [0u8; 32];
        argon2
            .hash_password_into(b"password1", salt, &mut key1)
            .unwrap();

        let mut key2 = [0u8; 32];
        argon2
            .hash_password_into(b"password2", salt, &mut key2)
            .unwrap();

        assert_ne!(key1, key2, "Different passwords must produce different keys");
    }

    #[test]
    fn test_argon2_different_salt_different_key() {
        let argon2 = Argon2::default();
        let password = b"same-password";

        let mut key1 = [0u8; 32];
        argon2
            .hash_password_into(password, b"salt-one-16bytes", &mut key1)
            .unwrap();

        let mut key2 = [0u8; 32];
        argon2
            .hash_password_into(password, b"salt-two-16bytes", &mut key2)
            .unwrap();

        assert_ne!(key1, key2, "Different salts must produce different keys");
    }

    #[test]
    fn test_argon2_key_length_is_32() {
        let argon2 = Argon2::default();
        let mut key = [0u8; 32];
        argon2
            .hash_password_into(b"password", b"salt-16-bytes!!", &mut key)
            .unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_full_vault_encrypt_decrypt_cycle() {
        let mut key_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut key_bytes);

        let cipher = Aes256Gcm::new_from_slice(&key_bytes).unwrap();

        let secret = r#"{"api_key":"sk-12345","endpoint":"https://api.example.com"}"#;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, secret.as_bytes()).unwrap();
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);

        let stored_nonce = Nonce::from_slice(&combined[..12]);
        let stored_ct = &combined[12..];

        let decrypted = cipher.decrypt(stored_nonce, stored_ct).unwrap();
        let decrypted_str = String::from_utf8(decrypted).unwrap();
        assert_eq!(decrypted_str, secret);
    }
}