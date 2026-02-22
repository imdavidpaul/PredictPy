"""
Authentication helpers
======================
- User registry backed by a local JSON file (no database required)
- bcrypt password hashing via passlib
- JWT access tokens via PyJWT
"""

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from passlib.context import CryptContext

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

_USERS_FILE = Path(__file__).parent / "users.json"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# In-memory user store  {username: {user_id, hashed_password}}
# ---------------------------------------------------------------------------

_users: dict[str, dict] = {}


def _load() -> None:
    global _users
    if _USERS_FILE.exists():
        try:
            _users = json.loads(_USERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            _users = {}


def _save() -> None:
    _USERS_FILE.write_text(json.dumps(_users, indent=2), encoding="utf-8")


_load()

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_user(username: str, password: str) -> dict:
    """Register a new user. Raises ValueError if username is taken."""
    username = username.strip().lower()
    if not username or not password:
        raise ValueError("Username and password are required.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")
    if username in _users:
        raise ValueError("Username already taken.")
    user_id = str(uuid.uuid4())
    _users[username] = {
        "user_id": user_id,
        "hashed_password": pwd_context.hash(password),
    }
    _save()
    return {"user_id": user_id, "username": username}


def authenticate_user(username: str, password: str) -> dict | None:
    """Return user dict if credentials are valid, else None."""
    username = username.strip().lower()
    record = _users.get(username)
    if not record:
        return None
    if not pwd_context.verify(password, record["hashed_password"]):
        return None
    return {"user_id": record["user_id"], "username": username}


def create_access_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "username": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Returns {"user_id": ..., "username": ...} on success.
    Raises jwt.PyJWTError on failure.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return {"user_id": payload["sub"], "username": payload["username"]}
