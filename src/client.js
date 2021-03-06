/*global API_URL*/

// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import VueDraggable from 'vue-draggable'

import App from './App'

window.getStoryPointsFrom = function (issue) {
  const customStoryPointsFieldId = vue.redmineConfig.customStoryPointsFieldId
  for (let index in issue.custom_fields) {
    if (issue.custom_fields[index].id === customStoryPointsFieldId) {
      if (issue.custom_fields[index].value) {
        return parseInt(issue.custom_fields[index].value)
      }
    }
  }
  return 0
}

window.paramsToQuery = function (params) {
  let esc = encodeURIComponent
  let query = Object.keys(params)
    .map(k => esc(k) + '=' + esc(params[k]))
    .join('&')

  return query.length ? '?' + query : ''
}

Vue.use(VueDraggable)

Vue.config.productionTip = false

Vue.prototype.bus = new Vue()


/* eslint-disable no-new */
const vue = new Vue({
  el: '#app',
  data: {
    apiUrl: (typeof API_URL !== 'undefined') ? API_URL : window.location.origin,
    loadingCount: 0,
    issues: {},
    issuesLastModified: null,
    projects: {},
    redmineConfig: {
      columns: {},
      customStoryPointsFieldId: null,
      sprintNumber: null,
      url: null,
      sprintDurationInDays: null,
      sprintStartDate: null
    },
    status: 'offline',
    users: {},
    velocity: [],
    burndown: {},
    loadingBurndown: false
  },
  created () {
    this.bus.$on('sprintNumberChange', function (sprintNumber) {
      this.issues = {}
      this.velocity = []
      this.burndown = {}

      this.redmineConfig.sprintNumber = ''

      this.bus.$emit('loading')

      this.ws.send(JSON.stringify({
        type: 'configChange',
        data: [
          {
            type: 'sprintNumber',
            value: sprintNumber
          }
        ]
      }))
    }.bind(this))

    this.bus.$on('getBurndown', function () {
      if (this.loadingBurndown === false) {
        this.burndown = {}
        this.loadingBurndown = true

        this.ws.send(JSON.stringify({
          type: 'getBurndown'
        }))
      }
    }.bind(this))

    this.bus.$on('burndownChange', function (payload) {
      this.ws.send(JSON.stringify({
        type: 'configChange',
        data: [
          {
            type: 'sprintDurationInDays',
            value: payload.sprintDurationInDays
          },
          {
            type: 'sprintStartDate',
            value: payload.sprintStartDate
          }
        ]
      }))

      this.redmineConfig.sprintStartDate = payload.sprintStartDate
      this.redmineConfig.sprintDurationInDays = payload.sprintDurationInDays
    }.bind(this))

    this.bus.$on('loading', function () {
      if (this.loadingCount !== false) {
        this.loadingCount++
      }
    }.bind(this))

    this.bus.$on('loaded', function () {
      this.loadingCount--
    }.bind(this))

    this.bus.$on('offline', function (evt) {
      if (evt.message.match(/NetworkError/)) {
        this.status = 'offline'
        this.loadingCount = false
      }
    }.bind(this))

    window.addEventListener('offline', function() {
      this.status = 'offline'
      this.loadingCount = false
    }.bind(this), true)

    // setup data
    this.setupWebSocket() // loads issues as well

    this.bus.$emit('loading', 'projects')
    this.loadProjects()
      .then(function () {
        this.bus.$emit('loaded', 'projects')
      }.bind(this))
      .catch(function (evt) {
        this.bus.$emit('offline', evt)
      }.bind(this))

    this.bus.$emit('loading', 'users')
    this.loadUsers()
      .then(function () {
        this.bus.$emit('loaded', 'users')
      }.bind(this))
      .catch(function (evt) {
        this.bus.$emit('offline', evt)
      }.bind(this))
  },
  methods: {
    setupWebSocket () {
      this.bus.$emit('loading', 'websocket')

      let isFirstMessage = true
      this.ws = new WebSocket(this.apiUrl.replace(/^http/, 'ws') + '/ws/')
      this.ws.onopen = function () {
        this.status = 'online'
      }.bind(this)

      this.ws.onmessage = function (response) {
        /** @type {{lastModified: string, issues: [], sprintNumber: number}} */
        const json = JSON.parse(response.data)

        if (json.type === 'config') {
          this.redmineConfig = json.config
          Vue.prototype.redmineUrl = this.redmineConfig.url
        } else if (json.type === 'sprintNumberChange') {
          this.redmineConfig.sprintNumber = json.sprintNumber
          this.bus.$emit('getBurndown')
          this.bus.$emit('loaded')
        } else if (json.type === 'issues') {
          this.setIssues(json.issues, json.lastModified)
          this.redmineConfig.sprintNumber = json.sprintNumber
        } else if (json.type === 'velocity') {
          this.velocity = json.data
        } else if (json.type === 'burndown') {
          this.burndown = json.data
          this.loadingBurndown = false
        } else {
          console.log('Unhandled WS message: ' + response.data)
        }

        if (isFirstMessage) {
          isFirstMessage = false
          Vue.nextTick(function () {
            this.bus.$emit('loaded', 'websocket')
          }.bind(this))
        }
      }.bind(this)

      this.ws.onclose = function (evt) {
        if (evt.code === 3001) {
          console.log('WebSocket closed')
        } else {
          console.log('WebSocket connection error')
        }
        this.reconnectWebSocket()
      }.bind(this)

      this.ws.onerror = function (evt) {
        if (this.ws.readyState === 1) {
          console.log('WebSocket error:' + evt.type)
          this.reconnectWebSocket()
        }
      }.bind(this)
    },
    reconnectWebSocket: function () {
      console.error('set offline')
      this.status = 'offline'
      this.loadingCount = false

      window.setTimeout(function () {
        console.debug('Try to re-establish WebSocket connection')
        this.loadingCount = 0
        this.setupWebSocket()
      }.bind(this), 10000)
    },
    setIssues (data, lastModified) {
      if (Object.keys(this.issues).length !== data.length || this.issuesLastModified !== lastModified) {
        console.log('set ' + data.length + ' issues with lastModified of ' + lastModified)

        let tmpIssues = {}
        for (let index in data) {
          if (data.hasOwnProperty(index)) {
            tmpIssues[data[index].id] = data[index]
          }
        }
        this.issues = tmpIssues

        this.issuesLastModified = lastModified
      }
    },
    loadUsers (offset = 0) {
      let params = {
        offset: offset,
        limit: 100
      }

      let cachedValue = this.getCachedValue('users', 86400)
      if (cachedValue) {
        this.users = cachedValue
        return Promise.resolve()
      }

      return fetch(this.apiUrl + '/users.json' + window.paramsToQuery(params), {mode: 'cors'})
        .then(function (response) {
          return response.json()
        })
        .then(function (response) {
          if (offset === 0) {
            this.tmpUsers = {}
          }

          for (let index in response.users) {
            let user = response.users[index]
            user.displayName = this.getUserDisplayName(user);
            this.tmpUsers[user.id] = user
          }

          return response
        }.bind(this))
        .then(function (response) {
          if (response.offset + response.limit < response.total_count) {
            return this.loadUsers(response.offset + response.limit)
          } else {
            this.users = this.tmpUsers

            this.cacheValue('users', this.users)
          }
        }.bind(this))
    },
    getUserDisplayName (user) {
      switch (this.redmineConfig.userDisplaySetting) {
        case "firstname_lastname":
          return user.firstname + ' ' + user.lastname;

        case 'firstname_lastinitial':
					return user.firstname + ' ' + String(user.lastname).substr(0, 1)

        case 'firstinitial_lastname':
					return String(user.firstname).substr(0, 1) + ' ' + user.lastname;

        case 'firstname':
          return user.firstname;

        case 'lastname_firstname':
					return user.lastname + ' ' + user.firstname;

        case 'lastnamefirstname':
					return user.lastname + user.firstname;

        case 'lastname_comma_firstname':
					return user.lastname + ', ' + user.firstname;

        case 'lastname':
					return user.lastname;

        case 'username':
        default:
					return user.login;
      }
    },
    loadProjects (offset = 0) {
      let params = {
        offset: offset,
        limit: 100
      }

      let cachedValue = this.getCachedValue('projects', 86400)
      if (cachedValue) {
        this.projects = cachedValue
        return Promise.resolve()
      }

      return fetch(this.apiUrl + '/projects.json' + window.paramsToQuery(params), {mode: 'cors'})
        .then(function (response) {
          if (response.status !== 200) {
            throw {message: 'NetworkError: ' + response.status}
          }
          return response.json()
        })
        .then(function (response) {
          if (offset === 0) {
            this.tmpProjects = {}
          }

          for (let index in response.projects) {
            let project = response.projects[index]
            this.tmpProjects[project.id] = project
          }

          return response
        }.bind(this))
        .then(function (response) {
          if (response.offset + response.limit < response.total_count) {
            return this.loadProjects(response.offset + response.limit)
          } else {
            this.projects = this.tmpProjects

            this.cacheValue('projects', this.projects)
          }
        }.bind(this))
    },
    getCachedValue (key, ttlInSeconds) {
      let items = window.localStorage.getItem(key)
      if (items) {
        items = JSON.parse(items)
        if (items.timestamp + (ttlInSeconds * 1000) > new Date().getTime()) {
          console.log('using ' + key + ' from localStorage, trigger cache invalidation at settings')
          return items.value
        }
      }
      return false
    },
    cacheValue (key, value) {
      window.localStorage.setItem(key, JSON.stringify({
        timestamp: new Date().getTime(),
        value: value
      }))
    }
  },
  template: '<App :loadingCount="loadingCount" :status="status" :issues="issues" :users="users" :projects="projects"' +
  ' :redmineConfig="redmineConfig" :velocity="velocity" :burndown="burndown" />',
  components: {App}
})
