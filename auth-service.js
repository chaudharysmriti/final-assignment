const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

let User; // to be defined on new connection

// Create a Schema variable
const Schema = mongoose.Schema;

// Define userSchema
const userSchema = new Schema({
    userName: {
        type: String,
        unique: true
    },
    password: String,
    email: String,
    loginHistory: [{
        dateTime: Date,
        userAgent: String
    }]
});

// initialize function
function initialize() {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(process.env.MONGODB);

        db.on('error', (err) => {
            reject(err); // reject the promise with the provided error
        });

        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
}

// registerUser function
function registerUser(userData) {
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        bcrypt.hash(userData.password, 10)
            .then(hash => {
                let newUser = new User({
                    userName: userData.userName,
                    password: hash,
                    email: userData.email,
                    loginHistory: []
                });

                newUser.save()
                    .then(() => resolve())
                    .catch(err => {
                        if (err.code === 11000) {
                            reject("User Name already taken");
                        } else {
                            reject("There was an error creating the user: " + err);
                        }
                    });
            })
            .catch(err => {
                reject("There was an error encrypting the password");
            });
    });
}

// checkUser function
function checkUser(userData) {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName })
            .then(users => {
                if (users.length === 0) {
                    reject("Unable to find user: " + userData.userName);
                } else {
                    bcrypt.compare(userData.password, users[0].password)
                        .then(result => {
                            if (!result) {
                                reject("Incorrect Password for user: " + userData.userName);
                            } else {
                                // limit login history to max 8 entries
                                if (users[0].loginHistory.length === 8) {
                                    users[0].loginHistory.pop();
                                }

                                users[0].loginHistory.unshift({
                                    dateTime: (new Date()).toString(),
                                    userAgent: userData.userAgent
                                });

                                User.updateOne(
                                    { userName: users[0].userName },
                                    { $set: { loginHistory: users[0].loginHistory } }
                                )
                                    .then(() => {
                                        resolve(users[0]);
                                    })
                                    .catch(err => {
                                        reject("There was an error verifying the user: " + err);
                                    });
                            }
                        })
                        .catch(err => {
                            reject("There was an error comparing passwords");
                        });
                }
            })
            .catch(() => {
                reject("Unable to find user: " + userData.userName);
            });
    });
}

// Export the functions
module.exports = {
    initialize,
    registerUser,
    checkUser
};
