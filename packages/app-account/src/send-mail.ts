import * as nodemailer from 'nodemailer';
import { CONFIG } from './config';

//

const transporter = nodemailer.createTransport({
  host: CONFIG.MAILING_HOST,
  port: CONFIG.MAILING_PORT,
  secure: true,
  auth: {
    user: CONFIG.MAILING_USER,
    pass: CONFIG.MAILING_PASSWORD,
  },
} as any);

//

type Mail = {
  from: string; // '"Fred Foo 👻" <foo@example.com>', // sender address
  to: string; // "bar@example.com, baz@example.com", // list of receivers
  subject: string; // 'Hello ✔', // Subject line
  // text: string; // 'Hello world?', // plain text body
  html: string; // '<b>Hello world?</b>', // html body
};

export async function sendMail({ from, to, subject, html }: Mail) {
  const mail = {
    from,
    to,
    subject,
    html,
  };
  // send mail with defined transport object
  const info = await transporter.sendMail(mail);
  return info.accepted.length === 1;
}
