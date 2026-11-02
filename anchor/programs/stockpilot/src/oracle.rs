use anchor_lang::prelude::*;

use crate::StockPilotError;

/// Pyth Solana Receiver program, owner of every `PriceUpdateV2` account.
pub const PYTH_RECEIVER_PROGRAM_ID: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

/// sha256("account:PriceUpdateV2")[..8]
const PRICE_UPDATE_V2_DISCRIMINATOR: [u8; 8] = [34, 241, 35, 99, 157, 126, 244, 205];

/// Reject prices whose confidence interval is wider than 2% of the price.
pub const MAX_CONFIDENCE_BPS: u128 = 200;

/// Value of 1 USD in the internal fixed-point unit (micro-dollars).
const USD_DECIMALS: i32 = 6;

pub struct OraclePrice {
    pub price: u64,
    pub exponent: i32,
}

/// Parses a Pyth `PriceUpdateV2` account by hand so the program does not need
/// the receiver SDK (and its dependency tree) just to read five fields.
///
/// Layout: discriminator(8) | write_authority(32) | verification_level(1 or 2)
///         | feed_id(32) | price(i64) | conf(u64) | exponent(i32) | publish_time(i64) | ...
pub fn read_pyth_price(
    account: &AccountInfo,
    expected_feed_id: &[u8; 32],
    now: i64,
    max_age_secs: u32,
) -> Result<OraclePrice> {
    require_keys_eq!(*account.owner, PYTH_RECEIVER_PROGRAM_ID, StockPilotError::InvalidPriceAccount);

    let data = account.try_borrow_data()?;
    require!(data.len() >= 8 + 32 + 1, StockPilotError::InvalidPriceAccount);
    require!(data[..8] == PRICE_UPDATE_V2_DISCRIMINATOR, StockPilotError::InvalidPriceAccount);

    // Only fully verified updates (every Wormhole guardian signature checked) are accepted.
    // VerificationLevel::Partial { num_signatures } = 0, VerificationLevel::Full = 1.
    require!(data[40] == 1, StockPilotError::InvalidPriceAccount);
    let msg = &data[41..];
    require!(msg.len() >= 32 + 8 + 8 + 4 + 8, StockPilotError::InvalidPriceAccount);

    require!(&msg[..32] == expected_feed_id, StockPilotError::InvalidPriceAccount);
    let price = i64::from_le_bytes(msg[32..40].try_into().unwrap());
    let conf = u64::from_le_bytes(msg[40..48].try_into().unwrap());
    let exponent = i32::from_le_bytes(msg[48..52].try_into().unwrap());
    let publish_time = i64::from_le_bytes(msg[52..60].try_into().unwrap());

    // Pyth stops publishing US equity feeds while the market is closed, so a stale
    // price is also how the program knows not to trade outside market hours.
    require!(
        now.saturating_sub(publish_time) <= max_age_secs as i64,
        StockPilotError::StalePriceOrMarketClosed
    );
    require!(price > 0, StockPilotError::InvalidPriceAccount);
    require!(
        (conf as u128) * 10_000 <= (price as u128) * MAX_CONFIDENCE_BPS,
        StockPilotError::PriceTooUncertain
    );
    require!((-18..=0).contains(&exponent), StockPilotError::InvalidPriceAccount);

    Ok(OraclePrice { price: price as u64, exponent })
}

fn pow10(exp: u32) -> Result<u128> {
    10u128.checked_pow(exp).ok_or_else(|| error!(StockPilotError::CalculationOverflow))
}

/// Scale between token base units and micro-dollars: 6 + exponent - decimals.
fn scale(price: &OraclePrice, decimals: u8) -> i32 {
    USD_DECIMALS + price.exponent - decimals as i32
}

/// USD value of `amount` base units, in micro-dollars.
pub fn usd_value(amount: u64, price: &OraclePrice, decimals: u8) -> Result<u128> {
    let raw = (amount as u128)
        .checked_mul(price.price as u128)
        .ok_or(StockPilotError::CalculationOverflow)?;
    let k = scale(price, decimals);
    if k >= 0 {
        raw.checked_mul(pow10(k as u32)?).ok_or_else(|| error!(StockPilotError::CalculationOverflow))
    } else {
        Ok(raw / pow10((-k) as u32)?)
    }
}

/// Base units of a token worth `value` micro-dollars (rounded down).
pub fn amount_for_value(value: u128, price: &OraclePrice, decimals: u8) -> Result<u64> {
    let k = scale(price, decimals);
    let amount = if k >= 0 {
        let denom = (price.price as u128)
            .checked_mul(pow10(k as u32)?)
            .ok_or(StockPilotError::CalculationOverflow)?;
        value / denom
    } else {
        value
            .checked_mul(pow10((-k) as u32)?)
            .ok_or(StockPilotError::CalculationOverflow)?
            / price.price as u128
    };
    u64::try_from(amount).map_err(|_| error!(StockPilotError::CalculationOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn values_round_trip() {
        // $180.12345 with Pyth exponent -5, token with 6 decimals.
        let p = OraclePrice { price: 18_012_345, exponent: -5 };
        let two_shares = 2_000_000u64;
        let v = usd_value(two_shares, &p, 6).unwrap();
        assert_eq!(v, 360_246_900); // $360.2469
        assert_eq!(amount_for_value(v, &p, 6).unwrap(), two_shares);
    }

    #[test]
    fn handles_positive_scale() {
        // exponent -2, 0 decimals => k = 4
        let p = OraclePrice { price: 15_000, exponent: -2 }; // $150.00
        assert_eq!(usd_value(3, &p, 0).unwrap(), 450_000_000);
        assert_eq!(amount_for_value(450_000_000, &p, 0).unwrap(), 3);
    }
}
