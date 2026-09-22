from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


def resend_api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def mail_from() -> str:
    return (os.getenv("MAIL_FROM") or "Arcanyx <noreply@mail.arcanyx.ru>").strip()


def mail_configured() -> bool:
    return bool(resend_api_key())


def send_email(to: str, subject: str, html: str, text: str) -> None:
    key = resend_api_key()
    if not key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    response = requests.post(
        RESEND_URL,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={
            "from": mail_from(),
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        },
        timeout=20,
    )
    if response.status_code >= 400:
        logger.warning("Resend error %s: %s", response.status_code, response.text[:400])
        raise RuntimeError("Не удалось отправить письмо")


def send_password_reset_code(to: str, code: str) -> None:
    subject = "Код для смены пароля Arcanyx"
    text = (
        f"Ваш код для смены пароля: {code}\n\n"
        "Код действует 15 минут. Если вы не запрашивали сброс, просто игнорируйте письмо."
    )
    html = f"""
    <div style="font-family:Georgia,serif;background:#121022;color:#FFF7EA;padding:32px;">
      <p style="letter-spacing:2px;color:#FFD79A;font-size:12px;">ARCANYX</p>
      <h1 style="font-weight:normal;font-size:28px;">Смена пароля</h1>
      <p>Ваш код:</p>
      <p style="font-size:32px;letter-spacing:8px;color:#FFD79A;">{code}</p>
      <p style="color:#B5AEC9;font-size:14px;">Код действует 15 минут.</p>
    </div>
    """
    send_email(to, subject, html, text)
