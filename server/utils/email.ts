import nodemailer from "nodemailer";

// eslint-disable-next-line node/no-process-env
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
// eslint-disable-next-line node/no-process-env
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "587");
// eslint-disable-next-line node/no-process-env
const SMTP_USER = process.env.SMTP_USER;
// eslint-disable-next-line node/no-process-env
const SMTP_PASS = process.env.SMTP_PASS;
// eslint-disable-next-line node/no-process-env
const SMTP_FROM = process.env.SMTP_FROM || "noreply@tourbooking.innopolis.university";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter)
    return transporter;

  if (!SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const mailer = getTransporter();

  if (!mailer) {
    return;
  }

  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
  }
  catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

export async function sendTimeslotChangeNotification(
  to_email: string,
  agency_name: string,
  original_date: string,
  original_time: string,
  new_date?: string,
  new_time?: string,
  cancellation: boolean = false,
) {
  const subject = cancellation
    ? "Отмена бронирования: Innopolis TourBooking"
    : "Изменение времени бронирования: Innopolis TourBooking";

  let html = "";
  let text = "";

  if (cancellation) {
    html = `
      <html>
        <body>
          <p>Уважаемое агенство <strong>${agency_name}</strong>!</p>
          <p>Ваше бронирование было отменено администратором.</p>
          <p><strong>Дата:</strong> ${original_date}</p>
          <p><strong>Время:</strong> ${original_time}</p>
          <p>При возникновении вопросов обращайтесь в 
          <a href="https://t.me/NPggL">Telegram</a>.</p>
          <p>С уважением,<br>Команда Innopolis TourBooking</p>
        </body>
      </html>
    `;
    text = `Ваше бронирование было отменено.\nДата: ${original_date}\nВремя: ${original_time}`;
  }
  else {
    html = `
      <html>
        <body>
          <p>Уважаемое агенство <strong>${agency_name}</strong>!</p>
          <p>Ваше бронирование было изменено администратором.</p>
          <p><strong>Было:</strong> ${original_date} ${original_time}</p>
          ${new_date && new_time ? `<p><strong>Стало:</strong> ${new_date} ${new_time}</p>` : ""}
          <p>При возникновении вопросов обращайтесь в 
          <a href="https://t.me/NPggL">Telegram</a>.</p>
          <p>С уважением,<br>Команда Innopolis TourBooking</p>
        </body>
      </html>
    `;
    text = `Ваше бронирование было изменено.\nБыло: ${original_date} ${original_time}\n${new_date && new_time ? `Стало: ${new_date} ${new_time}` : ""}`;
  }

  await sendEmail(to_email, subject, text, html);
}

export async function sendGuestListDeletionNotification(
  to_email: string,
  agency_name: string,
  booking_date: string,
  booking_time: string,
  people_count: number,
) {
  const subject = "Удаление списка гостей: Innopolis TourBooking";

  const html = `
    <html>
      <body>
        <p>Уважаемое агенство <strong>${agency_name}</strong>!</p>
        <p>Список гостей для вашего бронирования был удален администратором.</p>
        <p><strong>Дата:</strong> ${booking_date}</p>
        <p><strong>Время:</strong> ${booking_time}</p>
        <p><strong>Количество гостей:</strong> ${people_count}</p>
        <p>Пожалуйста, загрузите новый список гостей.</p>
        <p>При возникновении вопросов обращайтесь в 
        <a href="https://t.me/NPggL">Telegram</a>.</p>
        <p>С уважением,<br>Команда Innopolis TourBooking</p>
      </body>
    </html>
  `;

  const text = `Список гостей удален.\nДата: ${booking_date}\nВремя: ${booking_time}\nКоличество: ${people_count}`;

  await sendEmail(to_email, subject, text, html);
}

export async function sendGuestListModificationNotification(
  to_email: string,
  agency_name: string,
  booking_date: string,
  booking_time: string,
  people_count: number,
) {
  const subject = "Изменение списка гостей: Innopolis TourBooking";

  const html = `
    <html>
      <body>
        <p>Уважаемое агенство <strong>${agency_name}</strong>!</p>
        <p>Список гостей для вашего бронирования был изменен.</p>
        <p><strong>Дата:</strong> ${booking_date}</p>
        <p><strong>Время:</strong> ${booking_time}</p>
        <p><strong>Количество гостей:</strong> ${people_count}</p>
        <p>При возникновении вопросов обращайтесь в 
        <a href="https://t.me/NPggL">Telegram</a>.</p>
        <p>С уважением,<br>Команда Innopolis TourBooking</p>
      </body>
    </html>
  `;

  const text = `Список гостей изменен.\nДата: ${booking_date}\nВремя: ${booking_time}\nКоличество: ${people_count}`;

  await sendEmail(to_email, subject, text, html);
}

export async function sendAgencyCredentials(
  email: string,
  password: string,
  agency_name: string,
) {
  const subject = "Данные аккаунта: Innopolis TourBooking";

  const html = `
    <html>
      <body>
        <p>Аккаунт Вашего агенства был успешно создан!</p>
        <h3>Данные для входа:</h3>
        <table border="0" cellpadding="5">
          <tr>
            <td><strong>Название агенства:</strong></td>
            <td>${agency_name}</td>
          </tr>
          <tr>
            <td><strong>Почта (логин):</strong></td>
            <td>${email}</td>
          </tr>
          <tr>
            <td><strong>Пароль:</strong></td>
            <td>${password}</td>
          </tr>
        </table>
        <p>При возникновении технических проблем обращаться в 
        <a href="https://t.me/NPggL">Telegram</a>.</p>
        <p>С уважением,<br>Команда Innopolis TourBooking</p>
      </body>
    </html>
  `;

  const text = `Аккаунт создан!\nНазвание: ${agency_name}\nПочта: ${email}\nПароль: ${password}`;

  await sendEmail(email, subject, text, html);
}
