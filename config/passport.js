// Licensed under the Apache License. See footer for details.
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');

// load up the user model
const dba = 'account';
let Account;

// =====================================
// EXPORT LOGIN & SIGNUP ===============
// =====================================
module.exports = function(passport, appEnv, fabric, readyCallback) {
  // TODO :: use fabric connection object to initialize and set identities.
  Account = require('./database')(appEnv, dba,
    path.resolve(`${__dirname}/../seed/account.json`), () => {
      readyCallback();
    });

  const bcrypt = require('bcrypt-nodejs');

  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // passport needs ability to serialize and unserialize users out of session

  // used to serialize the user for the session
  passport.serializeUser((user, done) => {
    done(null, user.email);
  });

  // used to deserialize the user
  passport.deserializeUser((email, done) => {
    Account.find({
      selector: {
        email
      }
    }, (err, result) => {
      if (err) {
        return done(err);
      }
      const user = result.docs[0];
      return done(null, user);
    });
  });

  passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true },
    (req, email, password, done) => {
      console.log('Got login request');

      // Use Cloudant query to find the user
      Account.find({
        selector: {
          email
        }
      }, (err, result) => {
        if (err) {
          console.log('There was an error finding the user:', err);
          return done(null, null, err);
        }
        if (result.docs.length === 0) {
          console.log('Email was not found');
          return done(null, false, 'Email or password incorrect.');
        }

        // user was found, now determine if password matches
        const user = result.docs[0];

        // don't specify an org if you did not sign up with one
        if (req.body.organization && !user.organization) {
          console.log('Not an organization user');
          return done(null, null, 'Not an organization user');
        }

        if (bcrypt.compareSync(password, user.password)) {
          console.log('Password matches');
          return done(null, user, null);
        } else { // eslint-disable-line
          console.log('Password is not correct');
          return done(null, null, 'Email or password incorrect.');
        }
      });
    }
  ));

  // =========================================================================
  // LOCAL SIGNUP ============================================================
  // =========================================================================
  // we are using named strategies since we have one for login and one for signup
  // by default, if there was no name, it would just be called 'local'
  passport.use('local-signup', new LocalStrategy({
    usernameField: 'email', passwordField: 'password', passReqToCallback: true // allows us to pass back the entire request to the callback
  }, (req, email, password, done) => {
    console.log('Signup for: ', email);

    const firstName = req.body.fname;
    const lastName = req.body.lname;
    const organization = req.body.organization;

    // Use Cloudant query to find the user just based on user name
    Account.find({
      selector: {
        email
      }
    }, (err, result) => { // eslint-disable-line
      if (err) {
        console.log('There was an error registering the user:', err);
        return done(null, null, err);
      } else if (result.docs.length > 0) {
        console.log('Email was found');
        return done(null, null, 'User already exists. Use another email address.');
      }

      // create the new user
      const user = {
        _id: email,
        email,
        password: bcrypt.hashSync(password),
        firstName,
        lastName,
        organization,
      };

      Account.insert(user, (insertErr) => {
        if (insertErr) {
          console.log('There was an error registering the user:', insertErr);
          done(null, null, err);
        } else {
          console.log('User successfully registered.');
          done(null, user, null);
        }
      });
    });
  }));
};
