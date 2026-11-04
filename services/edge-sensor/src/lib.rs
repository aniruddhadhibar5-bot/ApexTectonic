use hmac::{Hmac, Mac};
use sha3::Sha3_256;
use tokio::sync::mpsc;

const FRAME_BYTES: usize = 28;
const TAG_BYTES: usize = 32;
const DOMAIN: &[u8] = b"sentinel.telemetry.v1\0";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SensorFrame<'a> {
    pub captured_ms: u64,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub encoded: &'a [u8],
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SignedFrame<'a> {
    pub frame: SensorFrame<'a>,
    pub authentication_tag: [u8; TAG_BYTES],
}

#[derive(Debug, PartialEq)]
pub enum SensorError {
    InvalidLength,
    InvalidMagic,
    NonFiniteSample,
    InvalidReservedField,
    InvalidKey,
    InvalidKeyId,
    AuthenticationFailed,
    QueueClosed,
}

type HmacSha3 = Hmac<Sha3_256>;

fn checked_mac(key: &[u8]) -> Result<HmacSha3, SensorError> {
    if key.len() < 32 {
        return Err(SensorError::InvalidKey);
    }
    HmacSha3::new_from_slice(key).map_err(|_| SensorError::InvalidKey)
}

fn update_context(mac: &mut HmacSha3, key_id: &[u8], encoded: &[u8]) -> Result<(), SensorError> {
    if key_id.is_empty()
        || key_id.len() > 64
        || !key_id
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-' || *byte == b'_')
    {
        return Err(SensorError::InvalidKeyId);
    }
    mac.update(DOMAIN);
    mac.update(&(key_id.len() as u16).to_le_bytes());
    mac.update(key_id);
    mac.update(encoded);
    Ok(())
}

pub fn parse_frame(encoded: &[u8]) -> Result<SensorFrame<'_>, SensorError> {
    if encoded.len() != FRAME_BYTES {
        return Err(SensorError::InvalidLength);
    }
    if &encoded[0..4] != b"SEIS" {
        return Err(SensorError::InvalidMagic);
    }

    let captured_ms = u64::from_le_bytes(encoded[4..12].try_into().unwrap());
    let x = f32::from_le_bytes(encoded[12..16].try_into().unwrap());
    let y = f32::from_le_bytes(encoded[16..20].try_into().unwrap());
    let z = f32::from_le_bytes(encoded[20..24].try_into().unwrap());
    let reserved = u32::from_le_bytes(encoded[24..28].try_into().unwrap());
    if !x.is_finite() || !y.is_finite() || !z.is_finite() {
        return Err(SensorError::NonFiniteSample);
    }
    if reserved != 0 {
        return Err(SensorError::InvalidReservedField);
    }

    Ok(SensorFrame {
        captured_ms,
        x,
        y,
        z,
        encoded,
    })
}

pub fn sign_frame<'a>(
    key: &[u8],
    key_id: &[u8],
    encoded: &'a [u8],
) -> Result<SignedFrame<'a>, SensorError> {
    let frame = parse_frame(encoded)?;
    let mut mac = checked_mac(key)?;
    update_context(&mut mac, key_id, encoded)?;
    let tag = mac.finalize().into_bytes();
    let mut authentication_tag = [0; TAG_BYTES];
    authentication_tag.copy_from_slice(&tag);
    Ok(SignedFrame {
        frame,
        authentication_tag,
    })
}

pub fn verify_frame<'a>(
    key: &[u8],
    key_id: &[u8],
    encoded: &'a [u8],
    authentication_tag: &[u8],
) -> Result<SensorFrame<'a>, SensorError> {
    if authentication_tag.len() != TAG_BYTES {
        return Err(SensorError::AuthenticationFailed);
    }
    let frame = parse_frame(encoded)?;
    let mut mac = checked_mac(key)?;
    update_context(&mut mac, key_id, encoded)?;
    mac.verify_slice(authentication_tag)
        .map_err(|_| SensorError::AuthenticationFailed)?;
    Ok(frame)
}

pub async fn publish<'a>(
    sender: &mpsc::Sender<SignedFrame<'a>>,
    frame: SignedFrame<'a>,
) -> Result<(), SensorError> {
    sender
        .send(frame)
        .await
        .map_err(|_| SensorError::QueueClosed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded_frame() -> [u8; FRAME_BYTES] {
        let mut bytes = [0; FRAME_BYTES];
        bytes[0..4].copy_from_slice(b"SEIS");
        bytes[4..12].copy_from_slice(&1_730_000_000_u64.to_le_bytes());
        bytes[12..16].copy_from_slice(&0.25_f32.to_le_bytes());
        bytes[16..20].copy_from_slice(&(-0.5_f32).to_le_bytes());
        bytes[20..24].copy_from_slice(&1.0_f32.to_le_bytes());
        bytes
    }

    #[test]
    fn parses_borrowed_frame_and_authenticates_it() {
        let encoded = encoded_frame();
        let key = b"0123456789abcdef0123456789abcdef";
        let signed = sign_frame(key, b"station-1", &encoded).unwrap();
        assert_eq!(signed.frame.encoded.as_ptr(), encoded.as_ptr());
        let verified =
            verify_frame(key, b"station-1", &encoded, &signed.authentication_tag).unwrap();
        assert_eq!(verified.captured_ms, 1_730_000_000);
    }

    #[test]
    fn rejects_tampering_invalid_values_and_wrong_length() {
        let encoded = encoded_frame();
        let key = b"0123456789abcdef0123456789abcdef";
        let signed = sign_frame(key, b"station-1", &encoded).unwrap();
        let mut altered = encoded;
        altered[8] ^= 0x01;
        assert_eq!(
            verify_frame(key, b"station-1", &altered, &signed.authentication_tag),
            Err(SensorError::AuthenticationFailed)
        );
        assert_eq!(
            verify_frame(key, b"station-2", &encoded, &signed.authentication_tag),
            Err(SensorError::AuthenticationFailed)
        );
        assert_eq!(
            sign_frame(b"short", b"station-1", &encoded),
            Err(SensorError::InvalidKey)
        );
        assert_eq!(
            sign_frame(key, b"bad id", &encoded),
            Err(SensorError::InvalidKeyId)
        );

        assert_eq!(parse_frame(&encoded[..10]), Err(SensorError::InvalidLength));
        let mut bad_magic = encoded;
        bad_magic[0] = 0;
        assert_eq!(parse_frame(&bad_magic), Err(SensorError::InvalidMagic));
        let mut non_finite = encoded;
        non_finite[12..16].copy_from_slice(&f32::NAN.to_le_bytes());
        assert_eq!(parse_frame(&non_finite), Err(SensorError::NonFiniteSample));
    }
}
