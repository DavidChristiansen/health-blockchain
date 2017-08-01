// Licensed under the Apache License. See footer for details.
const express = require('express');
const path = require('path');

const router = express.Router();
const dba = 'workouts';
let Workouts;

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).send({ message: 'You need to be authenticated' });
  }
}

router.get('/', checkAuthenticated, (req, res) => {
  console.log(`Retrieving workouts for ${req.user._id}`);
  Workouts.find({
    selector: {
      accountId: req.user._id
    }
  }, (err, result) => {
    if (err) {
      res.status(500).send({ ok: false });
    } else {
      res.send(result.docs);
    }
  });
});

router.post('/', checkAuthenticated, (req, res) => {
  console.log(`Storing workout for ${req.user._id}:`, req.body);
  const workout = req.body;
  // sanity check
  delete workout._id;
  delete workout._rev;
  // assign this workout to the current user
  workout.accountId = req.user._id;
  Workouts.insert(workout, (err, result) => {
    if (err) {
      res.status(500).send({ ok: false });
    } else {
      workout._id = result.id;
      workout._rev = result.rev;
      res.status(201).send(workout);
    }
  });
});

router.put('/:id', checkAuthenticated, (req, res) => {
  console.log(`Updating workout for ${req.user._id}:`, req.body);
  const workout = req.body;
  if (workout.accountId !== req.user._id) {
    res.status(401).send({ message: 'Wrong account id' });
  } else if (!workout._id || !workout._rev) {
    res.status(500).send({ message: 'Missing _id or _rev' });
  } else {
    workout.updated_at = new Date();
    Workouts.insert(workout, (err, result) => {
      if (err) {
        res.status(500).send({ ok: false });
      } else {
        workout._rev = result.rev;
        res.status(200).send(workout);
      }
    });
  }
});

router.delete('/:id', checkAuthenticated, (req, res) => {
  console.log(`Removing workout for ${req.user._id}:`, req.body);
  const workout = req.body;
  if (workout.accountId !== req.user._id) {
    res.status(401).send({ message: 'Wrong account id' });
  } else if (!workout._id || !workout._rev) {
    res.status(500).send({ message: 'Missing _id or _rev' });
  } else {
    Workouts.destroy(workout._id, workout._rev, (err, result) => {
      if (err) {
        res.status(500).send({ ok: false });
      } else {
        res.status(201).send(result);
      }
    });
  }
});

module.exports = (appEnv, fabric, readyCallback) => {
  Workouts = require('../../config/database')(appEnv, dba,
    path.resolve(`${__dirname}/../../seed/workouts.json`), () => {
      readyCallback(null, router);
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
