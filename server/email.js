const nodemailer = require('nodemailer');

const smtpPort = Number(process.env.SMTP_PORT || 465);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatDate(dateValue) {
    if (!dateValue) return '';
    return new Date(dateValue).toISOString().slice(0, 10);
}

function getFrontendUrl() {
    return process.env.FRONTEND_URL || 'https://hotel-frontend-vi9g.onrender.com';
}

async function sendEmail({ to, subject, text, html }) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('Email was not sent because SMTP_USER or SMTP_PASS is missing.');
        return;
    }

    if (!to) {
        console.warn('Email was not sent because recipient is missing.');
        return;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `Hotel Booking <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error('Could not send email:', error);
    }
}

async function sendRegistrationEmail({ email, username, fullName }) {
    const safeName = escapeHtml(fullName || username || 'there');
    const frontendUrl = getFrontendUrl();

    return sendEmail({
        to: email,
        subject: 'Welcome to Hotel Booking',
        text: `Hi ${fullName || username || 'there'}, your account has been created successfully. You can log in here: ${frontendUrl}/index.html`,
        html: `
            <h2>Welcome to Hotel Booking!</h2>
            <p>Hi ${safeName},</p>
            <p>Your account has been created successfully.</p>
            <p>
                <a href="${escapeHtml(frontendUrl)}/index.html">Go to Hotel Booking</a>
            </p>
        `
    });
}

async function sendBookingConfirmedEmail({
    to,
    fullName,
    bookingId,
    roomNumber,
    roomType,
    startDate,
    endDate
}) {
    const safeName = escapeHtml(fullName || 'there');

    return sendEmail({
        to,
        subject: `Booking confirmed #${bookingId}`,
        text:
            `Hi ${fullName || 'there'}, your booking has been confirmed.\n\n` +
            `Booking ID: #${bookingId}\n` +
            `Room: ${roomNumber} - ${roomType}\n` +
            `Check-in: ${formatDate(startDate)}\n` +
            `Check-out: ${formatDate(endDate)}\n`,
        html: `
            <h2>Booking confirmed</h2>
            <p>Hi ${safeName},</p>
            <p>Your booking has been confirmed.</p>
            <ul>
                <li><strong>Booking ID:</strong> #${escapeHtml(bookingId)}</li>
                <li><strong>Room:</strong> ${escapeHtml(roomNumber)} - ${escapeHtml(roomType)}</li>
                <li><strong>Check-in:</strong> ${escapeHtml(formatDate(startDate))}</li>
                <li><strong>Check-out:</strong> ${escapeHtml(formatDate(endDate))}</li>
            </ul>
            <p>Thank you for booking with us!</p>
        `
    });
}

async function sendBookingCancelledEmail({
    to,
    fullName,
    bookingId,
    roomNumber,
    roomType,
    startDate,
    endDate
}) {
    const safeName = escapeHtml(fullName || 'there');

    return sendEmail({
        to,
        subject: `Booking cancelled #${bookingId}`,
        text:
            `Hi ${fullName || 'there'}, your booking has been cancelled.\n\n` +
            `Booking ID: #${bookingId}\n` +
            `Room: ${roomNumber} - ${roomType}\n` +
            `Check-in: ${formatDate(startDate)}\n` +
            `Check-out: ${formatDate(endDate)}\n`,
        html: `
            <h2>Booking cancelled</h2>
            <p>Hi ${safeName},</p>
            <p>Your booking has been cancelled.</p>
            <ul>
                <li><strong>Booking ID:</strong> #${escapeHtml(bookingId)}</li>
                <li><strong>Room:</strong> ${escapeHtml(roomNumber)} - ${escapeHtml(roomType)}</li>
                <li><strong>Check-in:</strong> ${escapeHtml(formatDate(startDate))}</li>
                <li><strong>Check-out:</strong> ${escapeHtml(formatDate(endDate))}</li>
            </ul>
        `
    });
}

async function sendUserUpdatedEmail({ to, fullName }) {
    const safeName = escapeHtml(fullName || 'there');

    return sendEmail({
        to,
        subject: 'Your Hotel Booking account was updated',
        text: `Hi ${fullName || 'there'}, your account details were updated successfully. If this was not you, please contact support.`,
        html: `
            <h2>Account updated</h2>
            <p>Hi ${safeName},</p>
            <p>Your account details were updated successfully.</p>
            <p>If this was not you, please contact support immediately.</p>
        `
    });
}

async function sendPasswordResetEmail({ to, fullName, resetLink }) {
    const safeName = escapeHtml(fullName || 'there');
    const safeResetLink = escapeHtml(resetLink);

    return sendEmail({
        to,
        subject: 'Reset your Hotel Booking password',
        text:
            `Hi ${fullName || 'there'},\n\n` +
            `You requested a password reset for your Hotel Booking account.\n\n` +
            `Use this link to reset your password:\n${resetLink}\n\n` +
            `This link is valid for 30 minutes.\n\n` +
            `If you did not request this, you can ignore this email.`,
        html: `
            <h2>Reset your password</h2>
            <p>Hi ${safeName},</p>
            <p>You requested a password reset for your Hotel Booking account.</p>
            <p>
                <a href="${safeResetLink}" style="display:inline-block;padding:12px 18px;background:#d4af37;color:#111;text-decoration:none;border-radius:8px;font-weight:bold;">
                    Reset password
                </a>
            </p>
            <p>This link is valid for <strong>30 minutes</strong>.</p>
            <p>If you did not request this, you can ignore this email.</p>
        `
    });
}

module.exports = {
    sendRegistrationEmail,
    sendBookingConfirmedEmail,
    sendBookingCancelledEmail,
    sendUserUpdatedEmail,
    sendPasswordResetEmail
};