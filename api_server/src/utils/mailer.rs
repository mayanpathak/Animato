use std::time::Duration;

use lettre::{
    message::{header::ContentType, Mailbox},
    transport::smtp::authentication::Credentials,
    Address, Message, SmtpTransport, Transport,
};

use crate::AppState;

// Each template has exactly one placeholder, filled in below.
const VERIFY_TEMPLATE: &str = include_str!("templates/verify_email.html");
const RESET_TEMPLATE: &str = include_str!("templates/reset_password.html");

const SMTP_TIMEOUT: Duration = Duration::from_secs(10);

struct SmtpConfig {
    host: String,
    port: u16,
    user: String,
    pass: String,
    sender_name: String,
}

impl SmtpConfig {
    fn from_state(state: &AppState) -> Self {
        Self {
            host: state.email_host.clone(),
            port: state.email_port,
            user: state.email_user.clone(),
            pass: state.email_pass.clone(),
            sender_name: state.sender_name.clone(),
        }
    }
}

/// Sends the 6-digit verification code. Returns immediately; the send runs
/// in the background and a failure is only logged.
pub fn send_verification_email(state: &AppState, to: &str, code: &str) {
    let html = VERIFY_TEMPLATE.replace("{{CODE}}", code);

    send_in_background(
        SmtpConfig::from_state(state),
        "verification",
        to.to_string(),
        "Verify your email",
        html,
    );
}

/// Sends the reset link (`FRONTEND_URL/reset-password/<token>`). Returns
/// immediately; the send runs in the background and a failure is only logged.
pub fn send_reset_email(state: &AppState, to: &str, token: &str) {
    let reset_url = format!(
        "{}/reset-password/{}",
        state.frontend_url.trim_end_matches('/'),
        token
    );
    let html = RESET_TEMPLATE.replace("{{RESET_URL}}", &reset_url);

    send_in_background(
        SmtpConfig::from_state(state),
        "password reset",
        to.to_string(),
        "Reset your password",
        html,
    );
}

// lettre's transport here is the blocking one, so the send runs on tokio's
// blocking pool and never ties up a server worker. The handle is dropped on
// purpose: nothing waits for the result.
fn send_in_background(
    config: SmtpConfig,
    kind: &'static str,
    to: String,
    subject: &'static str,
    html: String,
) {
    tokio::task::spawn_blocking(move || {
        // The reason comes from lettre (address or SMTP error). The email
        // body, and so the code or token, is never part of it.
        if let Err(reason) = deliver(&config, &to, subject, html) {
            eprintln!("❌ Failed to send {} email: {}", kind, reason);
        }
    });
}

fn deliver(config: &SmtpConfig, to: &str, subject: &str, html: String) -> Result<(), String> {
    let message = Message::builder()
        .from(sender(config))
        .to(to.parse::<Mailbox>().map_err(|e| e.to_string())?)
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(html)
        .map_err(|e| e.to_string())?;

    let transport = build_transport(config).map_err(|e| e.to_string())?;

    transport.send(&message).map_err(|e| e.to_string())?;

    Ok(())
}

fn sender(config: &SmtpConfig) -> Mailbox {
    let name = match config.sender_name.trim() {
        "" => None,
        n => Some(n.to_string()),
    };

    // EMAIL_USER is the sending address for most providers. A local mail
    // catcher has no account, so fall back to a placeholder address.
    let address = config
        .user
        .parse::<Address>()
        .unwrap_or_else(|_| Address::new("no-reply", "localhost").expect("valid fallback address"));

    Mailbox::new(name, address)
}

fn build_transport(config: &SmtpConfig) -> Result<SmtpTransport, lettre::transport::smtp::Error> {
    // No credentials: a local mail catcher such as Mailpit (plain SMTP, no login).
    if config.user.is_empty() {
        return Ok(SmtpTransport::builder_dangerous(config.host.as_str())
            .port(config.port)
            .timeout(Some(SMTP_TIMEOUT))
            .build());
    }

    // Real provider: implicit TLS on 465, STARTTLS on any other port (587).
    let builder = if config.port == 465 {
        SmtpTransport::relay(&config.host)?
    } else {
        SmtpTransport::starttls_relay(&config.host)?
    };

    Ok(builder
        .port(config.port)
        .credentials(Credentials::new(config.user.clone(), config.pass.clone()))
        .timeout(Some(SMTP_TIMEOUT))
        .build())
}
