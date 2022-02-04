const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    FirstName: String,
    LastName: String,
    Mobile: String,
    email:String,
    password: String,
    createdAt: Date,

    status: {
        type: String,
        enum: ['Inactive','Active'],
        default: 'Inactive'
    },
   
    role: {
        type: String,
        default: 'Customer',
        enum: ["Manufacturer","Logistic", "Seller", "Distributor","Customer"]
       },
    verified: Boolean
});

const User = mongoose.model("User", UserSchema);

module.exports = User;