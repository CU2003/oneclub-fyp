// reporter signup approval email — cloud function
//
// when a new user document is created in firestore at users/{uid} with role "pending-reporter",
// this function runs and sends a plain text email to conor.usti@icloud.com so he can approve them.
// the actual email is sent using nodemailer and an smtp connection (icloud smtp). the smtp password
// is stored in google cloud secret manager and read via defineSecret so it is never in the code.
//
// references:
// - firebase cloud functions (listen to firestore, use secrets): https://firebase.google.com/docs/functions
// - nodemailer (send email via smtp): https://nodemailer.com/
// - step-by-step setup and verification (chatgpt conversation): https://chatgpt.com/share/69a71491-1c60-8004-9ced-fbd6221f28db

const nodemailer = require("nodemailer");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

// secret SMTP_PASSWORD must be created in google cloud secret manager (or via firebase).
// use the app-specific password for conor.usti@icloud.com from apple id settings, not the main account password.
const smtpPassword = defineSecret("SMTP_PASSWORD");

exports.sendReporterSignupEmail = onDocumentCreated(
  {
    document: "users/{uid}",
    location: "europe-west1",
    secrets: [smtpPassword],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userDoc = snap.data();
    if (!userDoc) return;

    // only send an email when the new user is a pending reporter; ignore other new users
    if (userDoc.role !== "pending-reporter") return;

    const reporterEmail = userDoc.email || "";

    const pass = smtpPassword.value();

    // create smtp transporter for icloud mail (smtp.mail.me.com, port 587, starttls)
    const transporter = nodemailer.createTransport({
      host: "smtp.mail.me.com",
      port: 587,
      secure: false,
      auth: {
        user: "conor.usti@icloud.com",
        pass,
      },
    });

    const subject = "OneClub - reporter signup awaiting approval";
    const text = `Someone has tried to sign up as a reporter on OneClub.

Reporter email: ${reporterEmail || "(no email field set)"}

If you recognise and trust this person, approve them by opening the Firebase console,
and changing them to a reporter. If further details are required by the requested sign up,
please reach out to them with questions

Once their role is "reporter" they will be able to use the reporter dashboard.`;

    await transporter.sendMail({
      from: '"OneClub" <conor.usti@icloud.com>',
      to: "conor.usti@icloud.com",
      subject,
      text,
    });
  }
);

