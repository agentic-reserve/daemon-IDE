/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// Compare two equal-length byte slices in constant time (mitigates timing probes on verify).
fn constant_time_eq_bytes(a: &[u8], b: &[u8]) -> bool {
	if a.len() != b.len() {
		return false;
	}
	let mut diff = 0u8;
	for (x, y) in a.iter().zip(b.iter()) {
		diff |= x ^ y;
	}
	diff == 0
}

#[cfg(not(feature = "vsda"))]
pub fn create_challenge() -> String {
	use rand::distributions::{Alphanumeric, DistString};
	// 32 alphanumeric chars (~190 bits) — reduces online guessing vs 16 chars.
	Alphanumeric.sample_string(&mut rand::thread_rng(), 32)
}

#[cfg(not(feature = "vsda"))]
pub fn sign_challenge(challenge: &str) -> String {
	use base64::{engine::general_purpose as b64, Engine as _};
	use sha2::{Digest, Sha256};
	let mut hash = Sha256::new();
	hash.update(challenge.as_bytes());
	let result = hash.finalize();
	b64::URL_SAFE_NO_PAD.encode(result)
}

#[cfg(not(feature = "vsda"))]
pub fn verify_challenge(challenge: &str, response: &str) -> bool {
	let expected = sign_challenge(challenge);
	constant_time_eq_bytes(expected.as_bytes(), response.as_bytes())
}

#[cfg(all(test, not(feature = "vsda")))]
mod tests {
	use super::*;

	#[test]
	fn verify_challenge_accepts_valid_response() {
		let c = "testchallenge12345678901234567890";
		let s = sign_challenge(c);
		assert!(verify_challenge(c, &s));
	}

	#[test]
	fn verify_challenge_rejects_wrong_response() {
		let c = "testchallenge12345678901234567890";
		assert!(!verify_challenge(c, "wrong"));
	}
}

#[cfg(feature = "vsda")]
pub fn create_challenge() -> String {
	use rand::distributions::{Alphanumeric, DistString};
	let str = Alphanumeric.sample_string(&mut rand::thread_rng(), 32);
	vsda::create_new_message(&str)
}

#[cfg(feature = "vsda")]
pub fn sign_challenge(challenge: &str) -> String {
	vsda::sign(challenge)
}

#[cfg(feature = "vsda")]
pub fn verify_challenge(challenge: &str, response: &str) -> bool {
	vsda::validate(challenge, response)
}
