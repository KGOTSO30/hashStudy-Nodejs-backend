const express = require('express');
const router = express.Router();

const User = require('./../models/User');
const UserVerification = require('./../models/UserVerification');
const PasswordReset = require('./../models/PasswordReset');

//email handler
const nodemailer = require("nodemailer");


//unique string

const {v4: uuidv4,} = require("uuid");

// env variables

require("dotenv").config();

//password handler
const bcrypt = require('bcrypt');

// path for static page
const path = require('path');
const { error } = require('console');

//nodemailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }
})

// testing success
transporter.verify((error, success) => {
    if(error){
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
})

// Signup
router.post('/signup', (req, res) => {
    let { FirstName, LastName, Mobile, email, password} = req.body;
        FirstName:FirstName.trim();
        LastName: LastName.trim();
        Mobile: Mobile.trim();
        email: email.trim();
        password: password.trim();
        
        

                // some form validations to be done!

                // check if user exists
                User.find({email}).then(result => {
                    if(result.length){
                        // user already exists
                        res.json({
                            status: "FAILED",
                            message: "User with this email already exists!"
                        })
                    }else{
                        // try to create new user

                        const saltRounds = 10;
                        bcrypt.hash(password, saltRounds).then(hashedPassword => {
                        const newUser = new User({
                            FirstName,
                            LastName,
                            Mobile,
                            email,
                            password: hashedPassword,
                            createdAt: Date.now(),
                            verified: false
                        });

                        newUser.save().then(result => {
                            // handle account verification
                            sendVerificationEmail(result, res);
                        })
                        .catch(err => {
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while saving user account!"
                            })
                        })
                        

                        })
                        .catch(err => {
                            
                            res.json({
                                status: "FAILED",
                                message: "An error occurred while hashing the password!"
                            })
                        })
                    }

                    }).catch(err => {
                        console.log(err);
                        res.json({
                            status: "FAILED",
                            message: "An error occurred while checking for existing user!"
                        })
                    })
})    

 // send verification email
 
 const sendVerificationEmail = ({_id, email}, res) => {
    // url to be used in the email
    const currentUrl = "http://localhost:5000/";

    const uniqueString = uuidv4() + _id;

    //mail optins
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify Your Email",
        html:` <p>Verify your email address to complete the signup and login into your account.</p>
                <p>This link <b>expires in 6 hours</b>.</p><p>Press <a href=${currentUrl + "user/verify/"+ _id + "/" + uniqueString}>here</a>
                 to proceed.</p>`,
        
    };
    const saltRounds = 10;
    bcrypt
        .hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {
            // set values in userVerification collection
            const newVerification = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now()+ 21600000,
            });
            newVerification
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then(() => {
                            //email sent and verification record saved
                            res.json({
                                status: "PENDING",
                                message: "Verification email sent!",
                        })

                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Verification email failed!",
                        })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Couldn't save verification email data!",
                    });
                })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "An error occurred while hashing email data!",
                date: data,
            })
        })
 });

}

//verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let {userId, uniqueString} = req.params;

    UserVerification
        .find({userId})
        .then((result) => {
            if(result.length > 0){
                // verification record exists so we proceed
                const {expiresAt} = result[0];
                const hashedUniqueString = result[0].uniqueString;

                if(expiresAt < Date.now()) {
                    //record has expired so we delete it 
                    UserVerification
                    .deleteOne({ userId})
                    .then((result) => {
                        User
                            .deleteOne({_id: userId})
                            .then(() => {
                                let message = "Link has expired. Please sign up again.";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            
                            })
                            .catch((error) => {
                                let message = "Clearing user with expired unique string failed";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            
                            })
                    })
                    .catch((error) => {
                        console.log(error);
                        let message = "An error occurred while clearing expired user verification record";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                    
                    })
                }else {
                    // valid record exists so we validate the user string 
                    // 1st compare the hashed unique string

                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then(result => {
                            if(result) {
                                //strings match

                                User
                                .updateOne({_id: userId}, {verified: true})
                                .then(() => {
                                    UserVerification
                                        .deleteOne({userId})
                                        .then(() =>{
                                            res.sendFile(path.join(__dirname, "./../views/verified.html"));
                                        })
                                        .catch(error => {
                                            console.log(error);
                                            let message = "An error occurred while finalising succesful verification.";
                                            res.redirect(`/user/verified/error=true&message=${message}`);
                                        })
                                })
                                .catch( error => {
                                    console.log(error);
                                    let message = "An error occurred while updating user record to show verified";
                                    res.redirect(`/user/verified/error=true&message=${message}`);
                                
                                })
                            }else {
                                //existing record but incorrect verification details passed. 
                                let message = "Invalid verification details passed. Check your inbox.";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            
                            }
                        })
                        .catch(error => {
                            let message = "An error occurred while comparing unique strings.";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        
                        })
                }

            }else{
                // verification record doesnt exist
                let message = "Account record doesn't exist or has been verified already. Please sign up or log in.";
                res.redirect(`/user/verified/error=true&message=${message}`);
            
            }
        })
        .catch((error) => {
            console.log(error);
            let message = "An error occurred while checking for existing user verification record";
            res.redirect(`/user/verified/error=true&message=${message}`);
        })
});

//verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
})



// Signin
router.post('/signin', (req, res) => {
    let { email, password} = req.body;
    email: email.trim();
    password: password.trim();

    // some validations to be done
    User.find({email}).then(data => {
        if(data.length) {
            //User exists

            //check if user is verified
            if(!data[0].verified) {
                res.json({
                    status: "FAILED",
                    message: "Email hasn't been verified yet. Check your inbox."
                });
            }else{
                const hashedPassword = data[0].password;
            bcrypt.compare(password, hashedPassword).then(result => {
                if(result) {
                    // password match
                    res.json({
                        status: "SUCCESS",
                        message: "Signin successful!",
                        date: data,
                    })
                }else {
                    res.json({
                        status: "FAILED",
                        message: "Invalid password entered!"
                    })
                }
            })
            .catch(err => {
               
                res.json({
                    status: "FAILED",
                    message: "An error occurred while comparing passwords"
                })
            })
            }    
        }else {
            res.json({
                status: "FAILED",
                message: "Invalid Credentials entered!"
            })
        }
    })
    .catch(err => {
        
        res.json({
            status: "FAILED",
            message: "An error occurred while checking for existing user!"
        })
    })
})

//password reset stuff
router.post("/requestPasswordReset", (req, res) => {
    const {email, redirectUrl} = req.body;

    // check email exists
    User
        .find({email})
        .then((data) => {
            if(data.length){
                //user exists

                //check if user is verified

                if(!data[0].verified) {
                    res.json({
                        status: "FAILED",
                        message: "Email hasn't been verified yet. Check your inbox"
                    });
                }else{
                    //proceed with email to reset password
                    sendResetEmail(data[0], redirectUrl, res);
                }

            }else {
                res.json({
                    status: "FAILED",
                    message: "No account with the supplied email exists"
                });

            }

        })
        .catch(error => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user!"
            })
        })
})

// send password reset email
const sendResetEmail = ({_id, email}, redirectUrl, res) =>{
    const resetString = uuidv4() + _id;

    PasswordReset
        .deleteMany({userId: _id})
        .then( result =>{
            //Reset records successfully
            // now we send the email

             //mail optins
        const mailOptions = {
            from: process.env.AUTH_EMAIL,
            to: email,
            subject: "Password Reset",
            html:` <p>We heard that you lost your password.</p><p>Don't worry, use the link below to reset it.</p>
                    <p>This link <b>expires in 60 minutes</b>.</p><p>Press <a href=${redirectUrl + "/"+ _id + "/" + resetString}>here</a>
                    to proceed.</p>`,
        
            };
            // hash the reset String
            const saltRounds= 10;
            bcrypt
                .hash(resetString, saltRounds)
                .then( hashedResetString => {
                    // set values in password reset collection
                    const newPasswordReset = new PasswordReset({
                        userId: _id,
                        resetString: hashedResetString,
                       
                        createdAt: Date.now(),
                        expiresAt: Date.now() + 3600000,
                    });

                    newPasswordReset
                        .save()
                        .then(() => {
                            transporter
                                .sendMail(mailOptions)
                                .then(() => {
                                    // reset email sent and password reset recoed saved
                                    res.json({
                                        status: "PENDING",
                                        message: "Password reset email sent"
                                    })
                                })
                                .catch(error =>{
                                    console.log(error);
                                    res.json({
                                        status: "FAILED",
                                        message: "Password reset email failed"
                                    })
                                })
                        })
                        .catch(error =>{
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Couldn't save password reset data!"
                            })
                        })
                })
                .catch(error =>{
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "An error occurred while hashing the password reset data!"
                    })
                })


        })
        .catch(error => {
            // error while clearing eexisting records
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Clearing existing password rest records failed"
            })
        })

}

// Actually reset the password
router.post("/resetPassword", (req,res)=>{

    let {userId, resetString, newPassword} = req.body;

    PasswordReset
        .find({userId})
        .then( result => {
            if(result.length > 0){
                // password reset record exists..... proceed
                const {expiresAt} = result[0];
                const hashedResetString = result[0].resetString;

                //check for expired reset string
                if(expiresAt < Date.now()) {
                    PasswordReset
                        .deleteOne({userId})
                        .then(() => {
                            // reset record deleted successfully
                                res.json({
                                    status: "FAILED",
                                    message: "Password reset Link has expired."
                                })
                           
                        })
                        .catch(error =>{
                            // deletion failed

                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Clearing password reset record failed."
                            })
                        })
                }else {
                    //valid reset record exists so we validate the reset string
                    
                    bcrypt
                        .compare(resetString, hashedResetString)
                        .then((result) => {
                            if (result){
                                //strings matched

                                     const saltRounds= 10;
                                  bcrypt
                                    .hash(newPassword, saltRounds)
                                    .then(hashedNewPassword => {
                                        // update user password
                                        User
                                            .updateOne({_id: userId}, {password: hashedNewPassword})
                                            .then(() => {
                                                // update complete. Now delete reset record
                                                PasswordReset
                                                    .deleteOne({userId})
                                                    .then(() =>{
                                                        // both user record and reset record updated
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Password has been reset Successfully."
                                                        })
                                                    }) 
                                                    .catch(error =>{
                                                        console.log(error);
                                                        res.json({
                                                            status: "FAILED",
                                                            message: "An error occurred while fianlizing password reset."
                                                        })
                                                    })

                                            })
                                            .catch(error =>{
                                                console.log(error);
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Updating user password failed."
                                                })
                                            })
                                    })
                                    .catch(error =>{
                                        console.log(error);
                                        res.json({
                                            status: "FAILED",
                                            message: "An error occurred while hashing new password"
                                        })
                                    })


                            }else{
                                //Existing record but incorrect reset string passed.
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password rest details passed."
                                })
                            }
                        })
                        .catch(error =>{
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Comparing password reset strings failed."
                            })
                        })

                }

            }else {
                //Password reset record doesn't exist
                res.json({
                    status: "FAILED",
                    message: "Password reset request not found."
                })

            }
        })
        .catch(error =>{
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Checking for existing password reset record failed."
            })
        })
})

module.exports = router;