// Sends email through Brevo's HTTP API (https://developers.brevo.com/reference/sendtransacemail).
// HTTP instead of SMTP because free hosts usually block SMTP ports.

type Email = {
    to: string;
    subject: string;
    text: string;
    html: string;
};

// Returns true when the email was handed to the provider.
export async function sendEmail(email: Email) {
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.EMAIL_FROM;

    // No email provider configured (local development): print the email instead of sending it.
    if (!apiKey || !from) {
        console.log(`[email not sent: BREVO_API_KEY or EMAIL_FROM missing]\nTo: ${email.to}\n${email.text}`);
        return false;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            sender: { email: from, name: 'Day Planner' },
            to: [{ email: email.to }],
            subject: email.subject,
            textContent: email.text,
            htmlContent: email.html,
        }),
    });

    if (!response.ok) {
        console.error('email failed', response.status, await response.text());
        return false;
    }

    return true;
}
