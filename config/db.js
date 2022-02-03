require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect("mongodb://localhost:27017/auth", {
    useUnifiedTopology: true,
    useNewUrlParser: true,
})
.then(() =>{
    console.log("Database connected");
})
.catch((err)  => console.log(err));

