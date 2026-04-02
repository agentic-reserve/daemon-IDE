/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

#[cfg(feature = "pq-kem")]
pub mod pq_session {
	use base64::{engine::general_purpose as b64, Engine as _};
	use libcrux_ml_kem::mlkem768;
	use rand::RngCore;
	use sha2::{Digest, Sha256};

	pub struct PqSessionKeys {
		pub session_key: [u8; 32],
	}

	pub fn server_generate_keypair(rng: &mut impl RngCore) -> (String, mlkem768::MlKem768PrivateKey) {
		let mut keygen_seed = [0u8; 64];
		rng.fill_bytes(&mut keygen_seed);
		let key_pair = mlkem768::generate_key_pair(keygen_seed);
		let ek_b64 = b64::URL_SAFE_NO_PAD.encode(key_pair.public_key().as_slice());
		(ek_b64, key_pair.private_key().clone())
	}

	pub fn client_encapsulate(
		ek_b64: &str,
		rng: &mut impl RngCore,
	) -> Result<(String, PqSessionKeys), &'static str> {
		let ek_bytes = b64::URL_SAFE_NO_PAD
			.decode(ek_b64)
			.map_err(|_| "invalid base64 ek")?;
		let public_key = mlkem768::MlKem768PublicKey::try_from(ek_bytes.as_slice())
			.map_err(|_| "invalid public key")?;
		let mut encaps_seed = [0u8; 32];
		rng.fill_bytes(&mut encaps_seed);
		let (ct, shared_secret) = mlkem768::encapsulate(&public_key, encaps_seed);
		let ct_b64 = b64::URL_SAFE_NO_PAD.encode(ct.as_slice());

		Ok((
			ct_b64,
			PqSessionKeys {
				session_key: derive_session_key(shared_secret.as_ref()),
			},
		))
	}

	pub fn server_decapsulate(
		private_key: &mlkem768::MlKem768PrivateKey,
		ct_b64: &str,
	) -> Result<PqSessionKeys, &'static str> {
		let ct_bytes = b64::URL_SAFE_NO_PAD
			.decode(ct_b64)
			.map_err(|_| "invalid base64 ct")?;
		let ciphertext = mlkem768::MlKem768Ciphertext::try_from(ct_bytes.as_slice())
			.map_err(|_| "invalid ciphertext")?;
		let shared_secret = mlkem768::decapsulate(private_key, &ciphertext);

		Ok(PqSessionKeys {
			session_key: derive_session_key(shared_secret.as_ref()),
		})
	}

	fn derive_session_key(shared_secret: &[u8]) -> [u8; 32] {
		let mut h = Sha256::new();
		h.update(b"argus-ide-pq-session-v1\0");
		h.update(shared_secret);
		h.finalize().into()
	}
}
