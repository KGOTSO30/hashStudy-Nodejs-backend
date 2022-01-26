require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require("method-override");
const User = require("./models/user");
const {
    checkAuthenticated,
    checkNotAuthenticated,
} = require("./middlewares/Auth");



const app = express();

const initializePassport = require('./passport-config');
const bcrypt = require("bcryptjs/dist/bcrypt");

initializePassport(
    passport,
    async(email) => {
        const userFound = await User.findOne({ email });
        return userFound;
    },
    async (id) => {
        const userFound = await User.findOne({_id: id});
        return userFound;
    }
);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true}));
app.use(express.static("public"));
app.use(flash());
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))


app.get("/", checkAuthenticated, (req, res) => {
    res.render("index");
});

app.get("/register", checkNotAuthenticated, (req, res) => {
    res.render("register");
});


app.get("/login", checkNotAuthenticated, (req, res) => {
    res.render("login");
});


app.post(
    "/login",
    checkNotAuthenticated,
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login",
        failureFlash: true,
    })
);

app.post("/register", checkNotAuthenticated, async (req, res) => {
    const userFound = await User.findOne({ email: req.body.email });

    if (userFound){
        req.flash("error", "User with email already exists");
        res.redirect("/register");
    }else {
        try{
            const hashedPassword = await bcrypt.hash(req.body.password, 10)
            const user = new User({
                FirstName: req.body.FirstName,
                LastName: req.body.LastName,
                Mobile: req.body.Mobile,
                email: req.body.email,
                role: req.body.role,
                password: hashedPassword,
                date: Date.now().toString()
            })

            await user.save();
            res.redirect('/login');
        }catch(error){
            console.log(error);
            res.redirect("/register");
        }
    }
});

app.delete('/logout', (req, res) => {
    req.logOut();
    res.redirect('/login');
});


mongoose.connect("mongodb://localhost:27017/auth", {
    useUnifiedTopology: true,
    useNewUrlParser: true,
})
.then(() =>{
    app.listen(3000, () => {
        console.log("Server is running on Port 3000")
    });

});


