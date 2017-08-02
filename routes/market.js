// Licensed under the Apache License. See footer for details.
const express = require('express');
const path = require('path');
const async = require('async');

const router = express.Router();

const marketDbName = 'market';
const challengesDbName = 'challenges';
const workoutsDbName = 'workouts';

let fabric;
let Market;
let UserChallenges;
let UserWorkouts;

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.organization) {
    next();
  } else {
    res.status(401).send({ message: 'You need to be authenticated and part of an organization' });
  }
}

// | GET    | /api/market/challenges | view available challenges
router.get('/market/challenges', (req, res) => {
  console.log('Retrieving market challenges');

  fabric.listChallenges({state: "PUBLISHED"}).then((res) => {
    if (err) {
      res.status(500).send({ ok: false });
    } else {
      res.send(res);
    }
  });

  // Market.list({ include_docs: true }, (err, result) => {
  //   if (err) {
  //     res.status(500).send({ ok: false });
  //   } else {
  //     res.send(result.rows.map(row => row.doc));
  //   }
  // });
});

// | GET    | /api/organization/challenges | view challenges owned by the current organization
router.get('/organization/challenges', checkAuthenticated, (req, res) => {
  console.log(`Retrieving organization challenges for ${req.user._id} / ${req.user.organization}`);
  fabric.listChallenges({ownerID: req.user._id}).then((challenges) => {
    // parse RES object ==> 
      res.send(challenges);
  }).catch((err) => {
      res.status(500).send({ ok: false });
  });

  // Market.find({
  //   selector: {
  //     organization: req.user.organization
  //   }
  // }, (err, result) => {
  //   if (err) {
  //     res.status(500).send({ ok: false });
  //   } else {
  //     res.send(result.docs);
  //   }
  // });
});

// | GET    | /api/organization/challenges/:id | view challenge owned by the current organization
router.get('/organization/challenges/:id', checkAuthenticated, (req, res) => {
  console.log(`Retrieving organization challenge ${req.params.id} for ${req.user._id} / ${req.user.organization}`);
  if (!req.params.id) {
    res.status(500).send({ message: 'Missing _id' });
  } else {

    fabric.getChallenge(req.params.id).then((challenge) => {
      res.status(200).send(challenge);
    }).catch((err) => {
      // TODO :: parse error and respond with proper code.
      res.status(500).send({ok: false});
    });

    // Market.get(req.params.id, (err, challenge) => {
    //   if (err) {
    //     console.log(err);
    //     res.status(500).send({ ok: false });
    //   } else if (challenge.organization !== req.user.organization) {
    //     res.status(401).send({ ok: false, message: 'Not owner' });
    //   } else {
    //     res.status(200).send(challenge);
    //   }
    // });
  }
});

// | POST   | /api/organization/challenges | allows to submit a new challenge to draft stage
// requires authentication
// user must be an organization
router.post('/organization/challenges', checkAuthenticated, (req, res) => {

  console.log(`Storing new challenge for ${req.user._id} / ${req.user.organization}:`, req.body);
  

  const challengeData = req.body;

  // TODO :: how to determine challenge ID ?
  // UUID ?
  const challengeID = 'challengeID:0001';
  let challenge = fabric.newChallenge(challengeID, challengeData, true, true);

  // TODO :: assign to organization ?
  fabric.createChallenge(challenge, req.user._id).then(() => {
    res.status(201).send(challenge)
  }).catch((err) => {
    res.status(500).send({ok:false, msg: err});
  })
  

  // get requirement type


  // sanity check
  // delete challenge._id;
  // // delete challenge._rev;
  // // assign this workout to the current user
  // challenge.organization = req.user.organization;
  // Market.insert(challenge, (err, result) => {
  //   if (err) {
  //     res.status(500).send({ ok: false });
  //   } else {
  //     challenge._id = result.id;
  //     challenge._rev = result.rev;
  //     res.status(201).send(challenge);
  //   }
  // });
});



// | POST   | /api/organization/challenges/:ID/publish | allows to submit a new challenge to the market
// requires authentication
// user must be an organization
router.post('/organization/challenges/:id/publish', checkAuthenticated, (req, res) => {

  // TODO :: What to do about arenas?  Always use default ?
  fabric.businessPublishChallenge(req.params.id, 'arenaID:0000').then(() => {
    res.status(200).send();
  }).catch((err) => {
    res.status(500).send({ok:false, msg: err});
  });
});


// NOTE -- this is not currently allowed in composer app
// TODO :: allow updates for challenges in "Draft" stage

// | PUT   | /api/organization/challenges | allows an organization to update its challenge
// requires authentication
// user must be an organization
// challenge must be owned by user
router.put('/organization/challenges/:id', checkAuthenticated, (req, res) => {
  console.log(`Updating challenge for ${req.user._id} / ${req.user.organization}:`, req.body);
  const challenge = req.body;
  if (!challenge._id || !challenge._rev) {
    res.status(500).send({ message: 'Missing _id or _rev' });
  } else {
    Market.get(challenge._id, (err, existing) => {
      if (err) {
        console.log(err);
        res.status(500).send({ ok: false });
      } else if (existing.organization !== req.user.organization) {
        res.status(401).send({ ok: false, message: 'Not owner' });
      } else {
        challenge.updated_at = new Date();
        Market.insert(challenge, (insertErr, updated) => {
          if (insertErr) {
            console.log(err);
            res.status(500).send({ ok: false });
          } else {
            challenge._rev = updated.rev;
            res.status(200).send(challenge);
          }
        });
      }
    });
  }
});


// NOTE :: There is no clear mapping here to composer interface.
// Get challenges --> this will include entries
// Get workouts that map to challenge ??  How does a workout map to a challenge ?
// | GET    | /api/organization/challenges/summary/:id | view a challenge summary
router.get('/organization/challenges/:id/summary', checkAuthenticated, (req, res) => {
  console.log(`Retrieving challenge summary for ${req.user._id} / ${req.user.organization} / ${req.params.id}:`);

  async.waterfall([
    // get the challenge from the database
    // and ensure the challenge belong to the organization
    (callback) => {
      Market.get(req.params.id, (err, challenge) => {
        if (err) {
          callback(err);
        } else if (challenge && challenge.organization === req.user.organization) {
          callback(null, challenge);
        } else {
          callback(new Error('not found'));
        }
      });
    },
    // find all users who have signed up for this challenge
    (challenge, callback) => {
      console.log('Retrieving users subscribed to challenge', challenge._id);
      UserChallenges.find({
        selector: {
          challengeId: challenge._id
        }
      }, (err, result) => {
        if (err) {
          callback(err);
        } else {
          callback(null, challenge, result.docs);
        }
      });
    },
    // find all workouts linked to these challenges
    (challenge, userChallenges, callback) => {
      console.log('Retrieving workouts for challenge', challenge._id);
      UserWorkouts.find({
        selector: {
          challengeId: challenge._id
        }
      }, (err, result) => {
        if (err) {
          callback(err);
        } else {
          callback(null, challenge, userChallenges, result.docs);
        }
      });
    },
    // from the workout, count how many users are actively participating
    // from the workout, count how many users have completed the challenge
    (challenge, userChallenges, workouts, callback) => {
      let reserved = 0;
      let granted = 0;
      userChallenges.forEach((userChallenge) => {
        // for each user, count the workouts
        const count = workouts.filter(workout =>
          workout.accountId === userChallenge.accountId &&
          workout.activity === challenge.activity).length;
        if (count >= challenge.goal) {
          // goal reached, the user deserves the reward!
          granted += 1;
        } else {
          // goal not reached yet but we need to save a reward in case the user reaches the goal
          reserved += 1;
        }
      });
      const summary = {
        participants: userChallenges.length,
        workouts: workouts.length,
        rewards: {
          total: challenge.rewards,
          reserved,
          granted,
          remaining: challenge.rewards - reserved - granted
        }
      };
      callback(null, summary);
    },
  ], (err, result) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.send(result);
    }
  });
});


// NOTE -- no deletion is currently possible in fitchain composer
// TODO :: expose "close challege" transaction
// TODO :: enable deletion of "DRAFT" challenges

// | DELETE | /api/organization/challenges | allows to delete its challenge from the market
// requires authentication
// user must be an organization
// challenge must be owned by user
router.delete('/organization/challenges/:id', checkAuthenticated, (req, res) => {
  console.log(`Removing challenge for ${req.user._id} / ${req.user.organization}:`, req.body);
  const challenge = req.body;
  if (!challenge._id || !challenge._rev) {
    res.status(500).send({ message: 'Missing _id or _rev' });
  } else {
    Market.get(challenge._id, (err, existing) => {
      if (err) {
        console.log(err);
        res.status(500).send({ ok: false });
      } else if (existing.organization !== req.user.organization) {
        res.status(401).send({ ok: false, message: 'Not owner' });
      } else {
        Market.destroy(challenge._id, challenge._rev, (deleteErr, result) => {
          if (deleteErr) {
            res.status(500).send({ ok: false });
          } else {
            res.status(200).send(result);
          }
        });
      }
    });
  }
});

module.exports = (appEnv, _fabric, readyCallback) => {
  fabric = _fabric;
  const Database = require('../config/database');
  UserChallenges = Database(appEnv, challengesDbName, null, () => {
    UserWorkouts = Database(appEnv, workoutsDbName, null, () => {
      Market = Database(appEnv, marketDbName,
        path.resolve(`${__dirname}/../seed/market.json`), () => {
          readyCallback(null, router);
        });
    });
  });
};


//------------------------------------------------------------------------------
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------
