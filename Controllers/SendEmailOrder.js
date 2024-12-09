import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465, // Или 587 для TLS
    secure: true,
    auth: {
        user: "info@tibetskaya.kz",
        pass: process.env.MailSMTP,
    },
});

export const SendEmailOrder = (mail, subject, text) => {
    const mailOptions = {
        from: "info@tibetskaya.kz",
        to: mail,
        subject: subject === "add" ? "Добавлен новый заказ" : subject === "cancelled" ? "Заказ отменен" : "Заказ завершен",
        text,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log("Email sent: " + info.response);
        }
    });
}