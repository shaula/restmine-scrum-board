const http = require('http')
const https = require('https')
const url = require('url')
const path = require('path')
const SortedArrayMap = require('collections/sorted-array-map')

const proxy = require('express-http-proxy')
const express = require('express')

/**
 * @type {{ redmine: {url: string, api_key: string, customStoryPointsFieldId: number, customSprintNumberFieldId: number, userDisplay: string}, pollingCycleInSeconds: number, port: number, clientPort: number, velocityHistoryLength: number, sprintDurationInDays: number }}
 */
const config = require(path.join(__dirname, '..', 'config/config.json'))

function setupStaticServing (app) {
  app.use('/', express.static(__dirname + '/../dist'))
}

function setupProxy (app) {
  app.use(proxy(config.redmine.url, {
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
      proxyReqOpts.headers['Accept'] = 'application/json'
      proxyReqOpts.headers['X-Redmine-API-Key'] = config.redmine.api_key
      return proxyReqOpts
    },
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
      if (userRes) {
        userRes.header('Access-Control-Allow-Origin', '*')
      }
      return proxyResData
    }
  }))
}

function setupErrorHandler(app) {
  app.use(function (err, req, res, next) {
    // logic
    console.log('Caught error:', err)
    res.status(500).send({ error: err })
  })
}

function setupWebSocket (app) {
  app.ws('/ws', function (ws, req) {
    ws.on('message', function (msg) {
      const json = JSON.parse(msg)
      if (json.type === 'configChange') {

        for (let index in json.data) {
          if (json.data.hasOwnProperty(index)) {
            switch (json.data[index].type) {
              case 'sprintNumber':
                setSprintNumber(parseInt(json.data[index].value), ws)
                break;

              case 'sprintStartDate':
                setSprintStartDate(json.data[index].value, ws)
                break;

              case 'sprintDurationInDays':
                setSprintDurationInDays(parseInt(json.data[index].value), ws)
                break;
            }
          }
        }

      } else if (json.type === 'velocity') {

      } else if (json.type === 'getBurndown') {
          sendBurnDownDataPoints(ws)
      }
    })

    // send initial message (whatever is stored)
    sendConfig(ws)

    sendData(ws, {
      type: 'issues',
      sprintNumber: store.sprintNumber,
      lastModified: getLastModified(store.issuesBySprintNumber.get(store.sprintNumber) || []),
      issues: store.issuesBySprintNumber.get(store.sprintNumber) || []
    })
    if (store.sprintNumber) {
      loadAndSendVelocity(ws, store.sprintNumber)
    }
  })
}

/******************
 * Setup
 ******************/
let store = {
  issuesBySprintNumber: new SortedArrayMap(),
  issueDetails: new SortedArrayMap(),
  sprintNumber: null,
  sprintStartDate: null,
  sprintDurationInDays: config.sprintDurationInDays
}

let getIssuesData = {}

const app = express()
const wsInstance = require('express-ws')(app)

setupWebSocket(app)
setupStaticServing(app)
setupProxy(app)
setupErrorHandler(app)

app.listen(config.port)
console.log('Redmine proxy listening on port ' + config.port)

setInterval(function () {
  const sprintNumber = store.sprintNumber
  const clients = wsInstance.getWss().clients

  if (clients.size && sprintNumber) {
    getIssues(sprintNumber, 0, true)
      .then(function (issues) {
        store.issuesBySprintNumber.set(sprintNumber, issues)

        clients.forEach(function each (ws) {
          sendData(ws, {
            type: 'issues',
            sprintNumber: sprintNumber,
            lastModified: getLastModified(issues),
            issues: issues
          })
        })
      })
      .catch(function () {
        // ignore
      })
  }
}, config.pollingCycleInSeconds * 1000)

/******************
 * Helpers
 ******************/

function sendData (ws, data) {
  ws.send(JSON.stringify(data))
}


function sendConfig(ws) {
  const preparedConfig = {
    columns: config.redmine.columns,
    customStoryPointsFieldId: config.redmine.customStoryPointsFieldId,
    sprintNumber: store.sprintNumber,
    sprintStartDate: store.sprintStartDate,
    sprintDurationInDays: store.sprintDurationInDays,
    url: config.redmine.url,
    userDisplaySetting: config.redmine.userDisplay,
  }
  sendData(ws, {
    type: 'config',
    config: preparedConfig
  })
}

function setSprintNumber(sprintNumber, ws) {
  getIssues(sprintNumber, 0)
    .then(function (issues) {
      store.issuesBySprintNumber.set(sprintNumber, issues)
      store.sprintNumber = sprintNumber

      sendData(ws, {
        type: 'sprintNumberChange',
        sprintNumber: sprintNumber
      })

      sendData(ws, {
        type: 'issues',
        sprintNumber: sprintNumber,
        lastModified: getLastModified(issues),
        issues: issues
      })
    })
    .then(loadAndSendVelocity.bind(this, ws, sprintNumber))
    .then(houseKeepIssues)
    .catch(function () {
      // ignore
    })
}

function setSprintStartDate(startDate, ws) {
  store.sprintStartDate = startDate
}

function setSprintDurationInDays(sprintDurationInDays, ws) {
  store.sprintDurationInDays = sprintDurationInDays
}

function getIssues (sprintNumber, offset = 0, reload = false) {
  let deferred = Promise.defer()

  if (offset === 0 && !reload && store.issuesBySprintNumber.has(sprintNumber)) {
    deferred.resolve(store.issuesBySprintNumber.get(sprintNumber))
  }

  if (offset === 0) {
    getIssuesData[sprintNumber] = []
  }

  const requestUrl = config.redmine.url + '/issues.json?sort=project&offset=' + offset + '&limit=10&cf_' + config.redmine.customSprintNumberFieldId + '=' + sprintNumber + '&status_id=*'
  let options = url.parse(requestUrl)
  options.headers = {
    'X-Redmine-API-Key': config.redmine.api_key
  }
  const getRequest = https.get(options, function (response) {
    // continuously update stream with data
    let body = ''

    response.on('data', function (d) {
      body += d
    })

    response.on('end', function () {
      let data
      try {
        data = JSON.parse(body)
      } catch (e) {
        // ignore
        console.error('Failed request', {
          url: requestUrl,
          response: body,
          exception: e
        })
        deferred.reject()
        return
      }
      getIssuesData[sprintNumber] = getIssuesData[sprintNumber].concat(data.issues)

      const currentCount = parseInt(data.offset) + parseInt(data.limit)
      if (currentCount < parseInt(data.total_count)) {
        // need to load next page
        getIssues(sprintNumber, currentCount)
          .then(function () {
            deferred.resolve(getIssuesData[sprintNumber])
          })
          .catch(function () {
            deferred.reject()
          })
      } else {
        // retrieved all issues within one page
        deferred.resolve(getIssuesData[sprintNumber])
      }
    })
  })

  getRequest.on('error', function (err) {
    console.log('Caught error, ignoring', err)
    deferred.reject()
  })

  return deferred.promise
}

function getIssueDetails (id, reload = false) {
  let deferred = Promise.defer()

  if (!reload && store.issueDetails.has(id)) {
    deferred.resolve(store.issueDetails.get(sprintNumber))
  }

  const requestUrl = config.redmine.url + '/issues/' + id + '.json?include=journals'
  let options = url.parse(requestUrl)
  options.headers = {
    'X-Redmine-API-Key': config.redmine.api_key
  }
  const getRequest = https.get(options, function (response) {
    // continuously update stream with data
    let body = ''

    response.on('data', function (d) {
      body += d
    })

    response.on('end', function () {
      let data
      try {
        data = JSON.parse(body)
      } catch (e) {
        // ignore
        console.error('Failed request', {
          url: requestUrl,
          response: body,
          exception: e
        })
        return
      }
      deferred.resolve(data.issue)
    })
  })

  getRequest.on('error', function (err) {
    console.log('Caught error, ignoring', err)
    deferred.reject()
  })

  return deferred.promise
}

function loadAndSendVelocity (ws, sprintNumber) {
  let previousSprintNumbers = []
  for (let i = sprintNumber - 1; i >= sprintNumber - config.velocityHistoryLength; i--) {
    previousSprintNumbers.push(i)
  }

  loadHistoricIssues(previousSprintNumbers)
    .then(function (historicIssues) {
      sendData(ws, {
        type: 'velocity',
        data: getVelocitiesFor(historicIssues)
      })
    })
}

function sendBurnDownDataPoints (ws) {
  getBurndownDataPoints().then(function (dataPoints) {
    sendData(ws, {
      type: 'burndown',
      data: dataPoints,
      sprintStartDate: store.sprintStartDate,
      sprintDurationInDays: store.sprintDurationInDays
    })
  })
}

function loadHistoricIssues (sprintNumbers, data = new SortedArrayMap()) {
  if (sprintNumbers.length === 0) {
    return Promise.resolve(data)
  }

  const sprintNumber = sprintNumbers.pop()
  return getIssues(sprintNumber)
    .then(function (issues) {
      store.issuesBySprintNumber.set(sprintNumber, issues)
      data.set(sprintNumber, issues)
      return loadHistoricIssues(sprintNumbers, data)
    })
    .catch(function () {
      // ignore
    })
}

/**
 * @param {SortedArrayMap} issuesBySprintNumber
 * @returns {Object<number, {sprintNumber: number, velocity: number}>}
 */
function getVelocitiesFor (issuesBySprintNumber) {
  let velocity = []
  let iterator = issuesBySprintNumber.keys()
  let entry
  while ((entry = iterator.next()) && !entry.done) {
    velocity.push({
      sprintNumber: entry.value,
      velocity: getVelocityFor(issuesBySprintNumber.get(entry.value))
    })
  }
  return velocity
}

function getVelocityFor (issues) {
  let velocity = 0
  for (let index in issues) {
    if (issues.hasOwnProperty(index)) {
      velocity += getStoryPointsFrom(issues[index])
    }
  }
  return velocity
}

function getStoryPointsFrom (issue) {
  for (let index in issue.custom_fields) {
    if (issue.custom_fields.hasOwnProperty(index)) {
      let customField = issue.custom_fields[index]
      if (customField.id === config.redmine.customStoryPointsFieldId) {
        if (customField.value) {
          return parseInt(customField.value)
        }
      }
    }
  }
  return 0
}

function getLastModified (issues) {
  return new Date(
    Math.max.apply(
      null,
      issues.map(function (issue) {
        return new Date(issue.updated_on)
      })
    )
  )
}

/**
 * Deletes those cached issues which are:
 *  - beyond the current sprint, or
 *  - past the velocity history issues
 */
function houseKeepIssues () {
  if (store.issuesBySprintNumber.length > config.velocityHistoryLength + 1) {
    let iterator = store.issuesBySprintNumber.keys()
    let entry
    while ((entry = iterator.next()) && !entry.done) {
      if (Math.abs(store.sprintNumber - entry.value) > 10 || store.sprintNumber < entry.value) {
        store.issuesBySprintNumber.delete(entry.value)
      }
    }
  }
}

/**
 * @returns {number}
 */
function getBurndownDataPoints () {
  let deferred = Promise.defer()

  let getIssueDetailsPromises = []
  let issues = []
  store.issuesBySprintNumber.get(store.sprintNumber).map(function (issue) {
    let promise = getIssueDetails(issue.id)
    promise.then(function (issue) {
      issues.push(issue)
    })
    getIssueDetailsPromises.push(promise)
  })

  Promise.all(getIssueDetailsPromises).then(function () {
    const relativePointsByTime = {}

    const pushRelativePoints = function (time, value) {
      relativePointsByTime[time] = relativePointsByTime[time] || []
      relativePointsByTime[time].push(value)
    }

    issues.forEach(function (issue) {
      // estimation was maybe different in a historic context
      let currentEstimation = getStoryPointsFrom(issue) || 1

      let previousEstimation = null
      for (let j = issue.journals.length - 1; j >= 0; j--) { // loop backwards through journals (and stop if former sprint was reached)
        if (issue.journals.hasOwnProperty(j)) {
          let journalEntry = issue.journals[j]
          let time = (new Date(journalEntry.created_on)).getTime()

          let percentageDelta = 0
          let hasEstimationChanged = false
          for (let i = 0; i < journalEntry.details.length; i++) {
            if (issue.journals.hasOwnProperty(j)) {
              let detail = journalEntry.details[i]

              if (detail.property === 'attr' && detail.name === 'done_ratio') {
                percentageDelta = parseFloat(detail.new_value) - parseFloat(detail.old_value)
                pushRelativePoints(time, {
                  points: -(currentEstimation * percentageDelta / 100),
                  issue: issue.tracker.name + ' #' + issue.id,
                  content: 'done ratio changed from ' + detail.old_value + '% to ' + detail.new_value + '%'
                })

              } else if (detail.property === 'cf' && detail.name == config.redmine.customStoryPointsFieldId) {
                previousEstimation = parseFloat(detail.old_value)
                hasEstimationChanged = true

                pushRelativePoints(time, {
                  points: (parseFloat(detail.new_value) || 0) - (parseFloat(detail.old_value) || 0),
                  issue: issue.tracker.name + ' #' + issue.id,
                  content: 'story point estimation changed from ' + (detail.old_value || '?') + 'SP to ' + detail.new_value + 'SP'
                })
              }
            }
          }

          if (hasEstimationChanged) { // looping backwards; therefore setting previous value
            currentEstimation = previousEstimation || 1
          }
        }
      }

      if (previousEstimation === null || previousEstimation > 0) {
        let time = (new Date(issue.created_on)).getTime()

        pushRelativePoints(time, {
          points: currentEstimation,
          issue: issue.tracker.name + ' #' + issue.id,
          content: 'estimation was set initially to ' + currentEstimation + 'SP'
        })
      }
    })

    // now provide timestamp for x-axis and absolute points for y-axis
    const absolutePointsByTime = {}
    let timestamps = Object.keys(relativePointsByTime)
    if (timestamps.length) {
      // sort points by time
      timestamps = timestamps.sort()

      // calculate absolute values
      let currentPoints = 0
      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps.hasOwnProperty(i)) {
          let time = timestamps[i]
          let content = []

          for (let j = 0; j < relativePointsByTime[time].length; j++) {
            if (relativePointsByTime[time].hasOwnProperty(j)) {
              currentPoints += relativePointsByTime[time][j].points
              content.push([
                relativePointsByTime[time][j].issue,
                ': ',
                relativePointsByTime[time][j].content
              ].join(''))
            }
          }

          absolutePointsByTime[time] = {
            points: currentPoints > 0 ? Math.floor(currentPoints) : 0,
            content: '<ul><li>' + content.join("</li><li>") + '</li></ul>'
          }
        }
      }
    }

    deferred.resolve({
      pointsByTime: absolutePointsByTime
    })
  })

  return deferred.promise
}
