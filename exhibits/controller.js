/**

 Copyright 2023 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

const MODEL = require('../exhibits/model');

exports.create_exhibit_record = (req, res) => {

    let is_member_of_exhibit = req.body.is_member_of_exhibit;

    if (is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
    }

    MODEL.create_exhibit_record(is_member_of_exhibit, (data) => {
        res.status(data.status).send(data.data);
    });
};

exports.get_exhibit_records = (req, res) => {

    if (req.query.uuid === undefined || req.query.uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }
};

exports.update_exhibit_record = () => {

};

exports.delete_record = (req, res) => {

    let uuid = req.query.uuid;
    let delete_reason = req.query.delete_reason;

    if (uuid === undefined || delete_reason === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }
};
