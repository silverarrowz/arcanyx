from __future__ import annotations

import html as html_lib
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


def resend_api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def mail_from() -> str:
    return (os.getenv("MAIL_FROM") or "Arcanyx <noreply@mail.arcanyx.ru>").strip()


def mail_configured() -> bool:
    return bool(resend_api_key())


def support_recipient() -> str:
    explicit = (os.getenv("SUPPORT_EMAIL") or "").strip()
    if explicit:
        return explicit
    return next(
        (
            item.strip()
            for item in (os.getenv("ADMIN_EMAILS") or "").split(",")
            if item.strip()
        ),
        "",
    )


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str,
    *,
    reply_to: Optional[str] = None,
) -> None:
    key = resend_api_key()
    if not key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    payload = {
        "from": mail_from(),
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    response = requests.post(
        RESEND_URL,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
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


def send_support_notification(
    *,
    to: str,
    request_id: str,
    category: str,
    email: str,
    message: str,
    user_id: Optional[str],
    user_name: Optional[str],
    platform: Optional[str],
    app_version: Optional[str],
) -> None:
    short_id = request_id[-6:].upper()
    subject = f"[Arcanyx #{short_id}] {category}"
    identity = user_name or "Гость"
    account = user_id or "нет"
    environment = " · ".join(
        value for value in (platform, app_version and f"v{app_version}") if value
    ) or "не указано"
    text = (
        f"Новое обращение #{short_id}\n\n"
        f"Тема: {category}\n"
        f"Имя: {identity}\n"
        f"Email: {email}\n"
        f"ID аккаунта: {account}\n"
        f"Приложение: {environment}\n\n"
        f"{message}\n\n"
        f"Полный ID: {request_id}"
    )

    escaped_message = html_lib.escape(message).replace("\n", "<br>")
    html = f"""
    <div style="font-family:Arial,sans-serif;background:#121022;color:#FFF7EA;padding:32px;">
      <p style="letter-spacing:2px;color:#FFD79A;font-size:12px;">ARCANYX SUPPORT</p>
      <h1 style="font-weight:normal;font-size:26px;">Обращение #{short_id}</h1>
      <div style="color:#B5AEC9;font-size:14px;line-height:1.7;">
        <div><strong style="color:#FFF7EA;">Тема:</strong> {html_lib.escape(category)}</div>
        <div><strong style="color:#FFF7EA;">Имя:</strong> {html_lib.escape(identity)}</div>
        <div><strong style="color:#FFF7EA;">Email:</strong> {html_lib.escape(email)}</div>
        <div><strong style="color:#FFF7EA;">ID аккаунта:</strong> {html_lib.escape(account)}</div>
        <div><strong style="color:#FFF7EA;">Приложение:</strong> {html_lib.escape(environment)}</div>
      </div>
      <div style="margin:24px 0;padding:20px;border:1px solid rgba(255,215,154,.35);border-radius:14px;line-height:1.7;">
        {escaped_message}
      </div>
      <p style="color:#7C7696;font-size:12px;">Полный ID: {html_lib.escape(request_id)}</p>
      <p style="color:#B5AEC9;font-size:13px;">Ответьте на это письмо, чтобы написать пользователю.</p>
    </div>
    """
    send_email(to, subject, html, text, reply_to=email)
