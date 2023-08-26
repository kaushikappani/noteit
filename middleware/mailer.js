const nodemailer = require("nodemailer");

const mailer = (recipent,body) => {
    var transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        auth: {
            user: process.env.MAIL_ID ,
            pass: process.env.GOOGLE_APP_PASSWORD
        }
    })
    const mailOptions = {
        from: 'kaushikappani@gmail.com',
        to: recipent.email,
        subject: body.subject,
        text: body.text,
        html:body.html
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error occurred:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}
module.exports = {mailer}