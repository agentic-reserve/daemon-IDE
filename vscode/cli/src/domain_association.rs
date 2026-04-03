/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::util::errors::{wrap, AnyError};
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationMode {
	Strict,
	Compat,
	Minimal,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AddressTag {
	Program,
	Mint,
	Address,
}

impl AddressTag {
	pub fn as_record_tag(self) -> &'static str {
		match self {
			Self::Program => "solana-program-address",
			Self::Mint => "solana-mint-address",
			Self::Address => "solana-address",
		}
	}
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AssociationSource {
	DnsTxt,
	WellKnown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationInput {
	pub domain: String,
	pub address: String,
	pub mode: VerificationMode,
	pub network: String,
	pub address_tag: Option<AddressTag>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationVerdict {
	pub domain: String,
	pub address: String,
	pub matched: bool,
	pub denied: bool,
	pub mode: VerificationMode,
	pub network: String,
	pub source: Vec<AssociationSource>,
	pub record_type: Option<AddressTag>,
	pub reason: String,
	pub warnings: Vec<String>,
	pub records_considered: usize,
}

#[derive(Clone)]
struct AssociationRecord {
	source: AssociationSource,
	raw: String,
	address_tag: Option<AddressTag>,
	address: Option<String>,
	allow: Option<bool>,
	deny: Option<bool>,
	network: Option<String>,
	deny_all: bool,
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct DnsResolveResponse {
	Answer: Option<Vec<DnsAnswer>>,
}

#[derive(Deserialize)]
struct DnsAnswer {
	data: String,
}

/// Rejects hostnames that could break HTTPS URL construction or inject query/path segments (SSRF-style abuse).
pub(crate) fn validate_domain_hostname(domain: &str) -> Result<(), AnyError> {
	let d = domain.trim();
	if d.is_empty() {
		return Err(wrap(
			std::io::Error::new(std::io::ErrorKind::InvalidInput, "domain is empty"),
			"invalid domain",
		)
		.into());
	}
	if d.len() > 253 {
		return Err(wrap(
			std::io::Error::new(std::io::ErrorKind::InvalidInput, "domain too long"),
			"invalid domain",
		)
		.into());
	}
	for ch in d.chars() {
		if !ch.is_ascii_alphanumeric() && ch != '.' && ch != '-' {
			return Err(wrap(
				std::io::Error::new(
					std::io::ErrorKind::InvalidInput,
					"domain contains invalid characters",
				),
				"invalid domain",
			)
			.into());
		}
	}
	if d.contains("..") || d.starts_with('.') || d.ends_with('.') {
		return Err(wrap(
			std::io::Error::new(std::io::ErrorKind::InvalidInput, "domain malformed"),
			"invalid domain",
		)
		.into());
	}
	Ok(())
}

/// Rejects strings that are not valid base58-encoded 32-byte Solana public keys.
pub fn validate_solana_address_input(address: &str) -> Result<(), AnyError> {
	if solana_address_decodes_to_32_bytes(address) {
		Ok(())
	} else {
		Err(wrap(
			std::io::Error::new(
				std::io::ErrorKind::InvalidInput,
				"invalid Solana address",
			),
			"address must be a base58-encoded 32-byte public key",
		)
		.into())
	}
}

fn solana_address_decodes_to_32_bytes(address: &str) -> bool {
	bs58::decode(address.trim()).into_vec().map(|v| v.len() == 32).unwrap_or(false)
}

pub async fn verify_domain_association(
	http: &reqwest::Client,
	mut input: VerificationInput,
) -> Result<VerificationVerdict, AnyError> {
	input.domain = input.domain.trim().to_string();
	validate_domain_hostname(&input.domain)?;
	input.address = input.address.trim().to_string();
	validate_solana_address_input(&input.address)?;
	let mut warnings = Vec::new();
	let txt_records = fetch_dns_txt(http, &input.domain)
		.await
		.map_err(|e| wrap(e, "failed to resolve DNS TXT records"))?;

	let well_known_records = match fetch_well_known(http, &input.domain).await {
		Ok(v) => v,
		Err(e) => {
			warnings.push(format!("well-known lookup failed: {e}"));
			Vec::new()
		}
	};
	let mut records = Vec::new();
	for rec in txt_records {
		if let Some(parsed) = parse_record_strict(AssociationSource::DnsTxt, &rec) {
			records.push(parsed);
		} else if matches!(input.mode, VerificationMode::Compat | VerificationMode::Minimal) {
			records.push(parse_record_compat(AssociationSource::DnsTxt, &rec));
		}
	}
	for rec in well_known_records {
		if let Some(parsed) = parse_record_strict(AssociationSource::WellKnown, &rec) {
			records.push(parsed);
		} else if matches!(input.mode, VerificationMode::Compat | VerificationMode::Minimal) {
			records.push(parse_record_compat(AssociationSource::WellKnown, &rec));
		}
	}

	let verdict = evaluate(records, input, warnings);
	Ok(verdict)
}

fn evaluate(
	records: Vec<AssociationRecord>,
	input: VerificationInput,
	mut warnings: Vec<String>,
) -> VerificationVerdict {
	let mut sources = Vec::new();
	for record in &records {
		if !sources.contains(&record.source) {
			sources.push(record.source);
		}
	}

	let mut matched = false;
	let mut denied = false;
	let mut saw_address_match = false;
	let mut saw_denyall = false;

	for record in &records {
		if record.deny_all {
			saw_denyall = true;
		}

		let Some(address) = &record.address else {
			if matches!(input.mode, VerificationMode::Minimal)
				&& solana_address_decodes_to_32_bytes(&input.address)
				&& record.raw.contains(input.address.trim())
			{
				matched = true;
			}
			continue;
		};

		if !address.eq_ignore_ascii_case(input.address.trim()) {
			continue;
		}

		saw_address_match = true;

		if let Some(required_tag) = input.address_tag {
			if record.address_tag != Some(required_tag) {
				continue;
			}
		}

		if !matches_network(&input.network, record.network.as_deref()) {
			continue;
		}

		let explicitly_denied = record.deny.unwrap_or(false) || record.allow == Some(false);
		if explicitly_denied {
			denied = true;
		} else {
			matched = true;
		}
	}

	if saw_denyall {
		denied = true;
		matched = false;
	}

	let reason = if denied {
		"Association denied by record".to_string()
	} else if matched {
		"Association matched".to_string()
	} else if saw_address_match {
		"No eligible allow record matched network/tag filters".to_string()
	} else {
		"No matching association record found".to_string()
	};

	if records.is_empty() {
		warnings.push("No association records discovered in DNS TXT or well-known file".to_string());
	}

	VerificationVerdict {
		domain: input.domain,
		address: input.address,
		matched,
		denied,
		mode: input.mode,
		network: input.network,
		source: sources,
		record_type: input.address_tag,
		reason,
		warnings,
		records_considered: records.len(),
	}
}

fn matches_network(expected: &str, record_network: Option<&str>) -> bool {
	let expected = expected.to_ascii_lowercase();
	match record_network {
		None => expected == "mainnet",
		Some(v) => v.eq_ignore_ascii_case(&expected),
	}
}

fn parse_record_strict(source: AssociationSource, line: &str) -> Option<AssociationRecord> {
	let mut address_tag = None;
	let mut address = None;
	let mut allow = None;
	let mut deny = None;
	let mut network = None;
	let mut deny_all = false;

	let tokens = line.split_whitespace().collect::<Vec<_>>();
	if tokens.is_empty() {
		return None;
	}

	for token in tokens {
		let (k, v) = token.split_once('=')?;
		let value = v.trim().trim_matches('"');

		match k {
			"solana-program-address" => {
				address_tag = Some(AddressTag::Program);
				address = Some(value.to_string());
			}
			"solana-mint-address" => {
				address_tag = Some(AddressTag::Mint);
				address = Some(value.to_string());
			}
			"solana-address" => {
				if value.eq_ignore_ascii_case("denyall") {
					deny_all = true;
				} else {
					address_tag = Some(AddressTag::Address);
					address = Some(value.to_string());
				}
			}
			"allow" => allow = parse_bool(value),
			"deny" => deny = parse_bool(value),
			"network" => network = Some(value.to_string()),
			_ => {}
		}
	}

	if deny_all || address.is_some() {
		Some(AssociationRecord {
			source,
			raw: line.to_string(),
			address_tag,
			address,
			allow,
			deny,
			network,
			deny_all,
		})
	} else {
		None
	}
}

fn parse_record_compat(source: AssociationSource, line: &str) -> AssociationRecord {
	let parsed = extract_value(line, "solana-address")
		.or_else(|| extract_value(line, "solana-program-address"))
		.or_else(|| extract_value(line, "solana-mint-address"));

	AssociationRecord {
		source,
		raw: line.to_string(),
		address_tag: if line.contains("solana-program-address") {
			Some(AddressTag::Program)
		} else if line.contains("solana-mint-address") {
			Some(AddressTag::Mint)
		} else if line.contains("solana-address") {
			Some(AddressTag::Address)
		} else {
			None
		},
		address: parsed,
		allow: parse_bool_opt(extract_value(line, "allow").as_deref()),
		deny: parse_bool_opt(extract_value(line, "deny").as_deref()),
		network: extract_value(line, "network"),
		deny_all: line.contains("solana-address=denyall"),
	}
}

fn extract_value(line: &str, key: &str) -> Option<String> {
	let needle = format!("{key}=");
	let start = line.find(&needle)?;
	let value = &line[(start + needle.len())..];
	let value = value
		.split_whitespace()
		.next()
		.unwrap_or("")
		.trim_matches('"')
		.trim_matches('\'')
		.trim_end_matches(',');
	if value.is_empty() {
		None
	} else {
		Some(value.to_string())
	}
}

fn parse_bool_opt(v: Option<&str>) -> Option<bool> {
	v.and_then(parse_bool)
}

fn parse_bool(v: &str) -> Option<bool> {
	match v.to_ascii_lowercase().as_str() {
		"1" | "true" | "yes" | "allow" => Some(true),
		"0" | "false" | "no" | "deny" => Some(false),
		_ => None,
	}
}

async fn fetch_dns_txt(http: &reqwest::Client, domain: &str) -> Result<Vec<String>, AnyError> {
	let mut url = Url::parse("https://dns.google/resolve")
		.map_err(|e| wrap(e, "invalid DNS resolver URL"))?;
	url.query_pairs_mut()
		.append_pair("name", domain)
		.append_pair("type", "TXT");
	let response = http
		.get(url)
		.send()
		.await
		.map_err(|e| wrap(e, "failed to call DNS over HTTPS resolver"))?;
	let parsed = response
		.json::<DnsResolveResponse>()
		.await
		.map_err(|e| wrap(e, "failed to parse DNS resolver response"))?;

	Ok(parsed
		.Answer
		.unwrap_or_default()
		.into_iter()
		.map(|a| decode_txt_answer(&a.data))
		.collect())
}

fn decode_txt_answer(raw: &str) -> String {
	let mut out = String::new();
	let mut in_quote = false;
	for c in raw.chars() {
		match c {
			'"' => in_quote = !in_quote,
			_ if in_quote => out.push(c),
			_ => {}
		}
	}

	if out.is_empty() {
		raw.trim_matches('"').to_string()
	} else {
		out
	}
}

async fn fetch_well_known(http: &reqwest::Client, domain: &str) -> Result<Vec<String>, AnyError> {
	let url = format!("https://{domain}/.well-known/solana.txt");
	let response = http
		.get(url)
		.send()
		.await
		.map_err(|e| wrap(e, "failed to fetch /.well-known/solana.txt"))?;

	if !response.status().is_success() {
		return Ok(Vec::new());
	}

	let body = response
		.text()
		.await
		.map_err(|e| wrap(e, "failed to read /.well-known/solana.txt body"))?;
	Ok(body
		.lines()
		.map(str::trim)
		.filter(|l| !l.is_empty() && !l.starts_with('#'))
		.map(str::to_string)
		.collect())
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn domain_validation_rejects_path_and_query_injection() {
		assert!(validate_domain_hostname("evil.com/path").is_err());
		assert!(validate_domain_hostname("a&inject=1").is_err());
		assert!(validate_domain_hostname("").is_err());
	}

	#[test]
	fn domain_validation_accepts_plain_fqdn() {
		assert!(validate_domain_hostname("example.com").is_ok());
		assert!(validate_domain_hostname("sub.example.com").is_ok());
	}

	#[test]
	fn strict_parser_supports_program_tag() {
		let rec = parse_record_strict(
			AssociationSource::DnsTxt,
			"solana-program-address=SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu network=mainnet allow=1",
		)
		.unwrap();
		assert_eq!(rec.address_tag, Some(AddressTag::Program));
		assert_eq!(rec.network.as_deref(), Some("mainnet"));
		assert_eq!(rec.allow, Some(true));
	}

	#[test]
	fn strict_parser_detects_denyall() {
		let rec = parse_record_strict(AssociationSource::DnsTxt, "solana-address=denyall").unwrap();
		assert!(rec.deny_all);
	}

	#[test]
	fn compat_parser_extracts_legacy_value() {
		let rec = parse_record_compat(
			AssociationSource::WellKnown,
			"solana-address=9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
		);
		assert_eq!(
			rec.address.as_deref(),
			Some("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")
		);
	}

	#[test]
	fn malformed_strict_record_is_rejected() {
		let rec = parse_record_strict(
			AssociationSource::DnsTxt,
			"solana-address 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
		);
		assert!(rec.is_none());
	}

	#[test]
	fn network_filter_defaults_missing_record_network_to_mainnet() {
		assert!(matches_network("mainnet", None));
		assert!(!matches_network("devnet", None));
	}

	struct FixtureCase {
		name: &'static str,
		mode: VerificationMode,
		records: Vec<AssociationRecord>,
		expected_matched: bool,
		expected_denied: bool,
	}

	const TEST_PK: &str = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

	#[test]
	fn fixture_cases_cover_strict_compat_and_minimal() {
		let fixtures = vec![
			FixtureCase {
				name: "strict match",
				mode: VerificationMode::Strict,
				records: vec![AssociationRecord {
					source: AssociationSource::DnsTxt,
					raw: format!("solana-address={TEST_PK} network=mainnet"),
					address_tag: Some(AddressTag::Address),
					address: Some(TEST_PK.into()),
					allow: None,
					deny: None,
					network: Some("mainnet".into()),
					deny_all: false,
				}],
				expected_matched: true,
				expected_denied: false,
			},
			FixtureCase {
				name: "compat deny",
				mode: VerificationMode::Compat,
				records: vec![AssociationRecord {
					source: AssociationSource::WellKnown,
					raw: format!("solana-address={TEST_PK} deny=1"),
					address_tag: Some(AddressTag::Address),
					address: Some(TEST_PK.into()),
					allow: None,
					deny: Some(true),
					network: Some("mainnet".into()),
					deny_all: false,
				}],
				expected_matched: false,
				expected_denied: true,
			},
			FixtureCase {
				name: "minimal raw contains fallback",
				mode: VerificationMode::Minimal,
				records: vec![AssociationRecord {
					source: AssociationSource::WellKnown,
					raw: format!("legacy:{TEST_PK}"),
					address_tag: None,
					address: None,
					allow: None,
					deny: None,
					network: None,
					deny_all: false,
				}],
				expected_matched: true,
				expected_denied: false,
			},
			FixtureCase {
				name: "denyall wins",
				mode: VerificationMode::Strict,
				records: vec![
					AssociationRecord {
						source: AssociationSource::DnsTxt,
						raw: format!("solana-address={TEST_PK}"),
						address_tag: Some(AddressTag::Address),
						address: Some(TEST_PK.into()),
						allow: Some(true),
						deny: None,
						network: Some("mainnet".into()),
						deny_all: false,
					},
					AssociationRecord {
						source: AssociationSource::DnsTxt,
						raw: "solana-address=denyall".into(),
						address_tag: None,
						address: None,
						allow: None,
						deny: None,
						network: None,
						deny_all: true,
					},
				],
				expected_matched: false,
				expected_denied: true,
			},
		];

		for case in fixtures {
			let verdict = evaluate(
				case.records,
				VerificationInput {
					domain: "example.com".into(),
					address: TEST_PK.into(),
					mode: case.mode,
					network: "mainnet".into(),
					address_tag: None,
				},
				vec![],
			);
			assert_eq!(verdict.matched, case.expected_matched, "{}", case.name);
			assert_eq!(verdict.denied, case.expected_denied, "{}", case.name);
		}
	}

	#[test]
	fn deny_record_takes_precedence_for_result() {
		let records = vec![AssociationRecord {
			source: AssociationSource::DnsTxt,
			raw: format!("solana-address={TEST_PK} deny=1"),
			address_tag: Some(AddressTag::Address),
			address: Some(TEST_PK.into()),
			allow: None,
			deny: Some(true),
			network: Some("mainnet".into()),
			deny_all: false,
		}];

		let verdict = evaluate(
			records,
			VerificationInput {
				domain: "example.com".into(),
				address: TEST_PK.into(),
				mode: VerificationMode::Strict,
				network: "mainnet".into(),
				address_tag: None,
			},
			vec![],
		);
		assert!(verdict.denied);
		assert!(!verdict.matched);
	}

	#[test]
	fn invalid_base58_address_fails_validation() {
		assert!(validate_solana_address_input("abc").is_err());
		assert!(validate_solana_address_input("").is_err());
		assert!(validate_solana_address_input("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM").is_ok());
	}
}
