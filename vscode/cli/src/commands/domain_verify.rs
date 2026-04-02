/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use super::{
	args::{OutputFormat, VerifyDomainAddressType, VerifyDomainArgs, VerifyDomainMode},
	CommandContext,
};
use crate::{
	domain_association::{self, AddressTag, VerificationInput, VerificationMode},
	util::errors::AnyError,
};

impl From<VerifyDomainMode> for VerificationMode {
	fn from(value: VerifyDomainMode) -> Self {
		match value {
			VerifyDomainMode::Strict => VerificationMode::Strict,
			VerifyDomainMode::Compat => VerificationMode::Compat,
			VerifyDomainMode::Minimal => VerificationMode::Minimal,
		}
	}
}

impl From<VerifyDomainAddressType> for AddressTag {
	fn from(value: VerifyDomainAddressType) -> Self {
		match value {
			VerifyDomainAddressType::Program => AddressTag::Program,
			VerifyDomainAddressType::Mint => AddressTag::Mint,
			VerifyDomainAddressType::Address => AddressTag::Address,
		}
	}
}

pub async fn verify_domain(ctx: CommandContext, args: VerifyDomainArgs) -> Result<i32, AnyError> {
	let input = VerificationInput {
		domain: args.domain.clone(),
		address: args.address.clone(),
		mode: args.mode.into(),
		network: args.network.clone(),
		address_tag: args.address_type.map(Into::into),
	};

	let verdict = match domain_association::verify_domain_association(&ctx.http, input).await {
		Ok(v) => v,
		Err(e) => {
			let output = serde_json::json!({
				"domain": args.domain,
				"address": args.address,
				"matched": false,
				"denied": false,
				"mode": format!("{:?}", args.mode).to_ascii_lowercase(),
				"network": args.network,
				"source": [],
				"record_type": args.address_type.map(|t| format!("{:?}", t).to_ascii_lowercase()),
				"reason": format!("verification transport/parse failure: {e}"),
				"warnings": [],
				"records_considered": 0
			});
			ctx.log.result(output.to_string());
			return Ok(2);
		}
	};

	match args.output_format.format {
		OutputFormat::Json => {
			ctx.log.result(serde_json::to_string(&verdict).unwrap());
		}
		OutputFormat::Text => {
			ctx.log.result(format!(
				"domain={} address={} matched={} denied={} mode={:?} network={} reason={}",
				verdict.domain,
				verdict.address,
				verdict.matched,
				verdict.denied,
				verdict.mode,
				verdict.network,
				verdict.reason
			));
			if !verdict.warnings.is_empty() {
				ctx.log.result(format!("warnings={}", verdict.warnings.join(" | ")));
			}
		}
	}

	Ok(if verdict.matched && !verdict.denied {
		0
	} else {
		1
	})
}
