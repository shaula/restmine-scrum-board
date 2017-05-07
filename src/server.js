const http = require('http')
const https = require('https')
const url = require('url')
const path = require('path')
const SortedArrayMap = require('collections/sorted-array-map')

const proxy = require('express-http-proxy')
const express = require('express')

/**
 * @type {{ redmine: {server: string, api_key: string, customStoryPointsFieldId: number}, pollingCycleInSeconds: number, port: number, clientPort: number, velocityHistoryLength: number}}
 */
const config = require(path.join(__dirname, '..', 'config/config.json'))

function setupStaticServing (app) {
  app.use('/', express.static(__dirname + '/../dist'))
}

function setupProxy(app) {
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

function setupWebSocket(app) {
  app.ws('/ws', function(ws, req) {
    ws.on('message', function(msg) {
      const json = JSON.parse(msg)
      if (json.type === 'sprintNumberChange') {
        const sprintNumber = parseInt(json.data)

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
      } else if (json.type === 'velocity') {

      }
    })

    // send initial message (whatever is stored)
    sendData(ws, {
      type: 'config',
      config: {
        columns: config.redmine.columns,
        customStoryPointsFieldId: config.redmine.customStoryPointsFieldId,
        sprintNumber: store.sprintNumber,
        url: config.redmine.url
      }
    })

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
  sprintNumber: null
}

let getIssuesData = {}

const app = express()
const wsInstance = require('express-ws')(app)

setupWebSocket(app)
setupStaticServing(app)
setupProxy(app)

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
  }
}, config.pollingCycleInSeconds * 1000)

/******************
 * Helpers
 ******************/

function sendData (ws, data) {
  ws.send(JSON.stringify(data))
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
  https.get(options, function (response) {
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
      getIssuesData[sprintNumber] = getIssuesData[sprintNumber].concat(data.issues)

      const currentCount = parseInt(data.offset) + parseInt(data.limit)
      if (currentCount < parseInt(data.total_count)) {
        // need to load next page
        getIssues(sprintNumber, currentCount)
          .then(function () {
            deferred.resolve(getIssuesData[sprintNumber])
          })
      } else {
        // retrieved all issues within one page
        deferred.resolve(getIssuesData[sprintNumber])
      }
    })
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
      const issue = issues[index]
      for (let index in issue.custom_fields) {
        if (issue.custom_fields.hasOwnProperty(index)) {
          let customField = issue.custom_fields[index]
          if (customField.id === config.redmine.customStoryPointsFieldId) {
            if (customField.value) {
              velocity += parseInt(customField.value)
            }
          }
        }
      }
    }
  }
  return velocity
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
