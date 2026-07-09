'use strict';

const exhibitEndpoints = require('./exhibit-endpoints');
const mediaEndpoints = require('./media-endpoints');
const gridEndpoints = require('./grid-endpoints');
const itemEndpoints = require('./item-endpoints');
const headingEndpoints = require('./heading-endpoints');
const timelineEndpoints = require('./timeline-endpoints');
const workflowEndpoints = require('./workflow-endpoints');
const utilityEndpoints = require('./utility-endpoints');

const ENDPOINTS = {
    exhibits: {
        ...exhibitEndpoints,
        ...mediaEndpoints,
        ...gridEndpoints,
        ...itemEndpoints,
        ...headingEndpoints,
        ...timelineEndpoints,
        ...workflowEndpoints,
        ...utilityEndpoints
    }
};

module.exports = function() {
    return ENDPOINTS;
};
