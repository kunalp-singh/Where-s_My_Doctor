from __future__ import annotations

import base64
import hashlib
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from jose import JWTError, jwt
import bcrypt

from ..config import get_settings
from ..models.enums import UserRole


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        pwd_bytes = password.encode("utf-8")[:72]
        hash_bytes = password_hash.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def create_token_pair(subject: str, role: UserRole) -> tuple[str, str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    access_exp = now + timedelta(minutes=settings.access_token_exp_minutes)
    refresh_exp = now + timedelta(days=settings.refresh_token_exp_days)
    access_token = jwt.encode(
        {"sub": subject, "role": role.value, "exp": int(access_exp.timestamp()), "iat": int(now.timestamp()), "type": "access"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    refresh_token = jwt.encode(
        {"sub": subject, "role": role.value, "exp": int(refresh_exp.timestamp()), "iat": int(now.timestamp()), "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return access_token, refresh_token, access_exp


def decode_token(token: str, expected_type: str | None = None) -> dict[str, str]:
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if expected_type is not None and payload.get("type") != expected_type:
        raise JWTError("Invalid token type")
    return payload


def get_token_fernet() -> Fernet:
    settings = get_settings()
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.google_token_encryption_secret.encode()).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return get_token_fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return get_token_fernet().decrypt(value.encode()).decode()
