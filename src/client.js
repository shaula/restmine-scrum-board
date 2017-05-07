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
      url: null
    },
    users: {},
    velocity: []
  },
  created () {
    this.bus.$on('sprintNumberChange', function (sprintNumber) {
      this.issues = {}
      this.velocity = []

      this.bus.$emit('loading')

      this.ws.send(JSON.stringify({
        type: 'sprintNumberChange',
        data: sprintNumber
      }))
    }.bind(this))

    this.bus.$on('loading', function () {
      this.loadingCount++
    }.bind(this))

    this.bus.$on('loaded', function () {
      this.loadingCount--
    }.bind(this))

    // setup data
    this.setupWebSocket() // loads issues as well

    this.bus.$emit('loading', 'projects')
    this.loadProjects().then(function () {
      this.bus.$emit('loaded', 'projects')
    }.bind(this))

    this.bus.$emit('loading', 'users')
    this.loadUsers().then(function () {
      this.bus.$emit('loaded', 'users')
    }.bind(this))
  },
  methods: {
    setupWebSocket () {
      this.bus.$emit('loading', 'websocket')

      let isFirstMessage = true
      this.ws = new WebSocket(this.apiUrl.replace('http://', 'ws://'))
      /*this.ws.onopen = function () {
        this.ws.send(JSON.stringify({type: 'init'}));
      }.bind(this);*/

      this.ws.onmessage = function (response) {
        /** @type {{lastModified: string, issues: [], sprintNumber: number}} */
        const json = JSON.parse(response.data)

        if (json.type === 'config') {
          this.redmineConfig = json.config
        } else if (json.type === 'sprintNumberChange') {
          this.redmineConfig.sprintNumber = json.sprintNumber
          this.bus.$emit('loaded')
        } else if (json.type === 'issues') {
          this.setIssues(json.issues, json.lastModified)
          this.redmineConfig.sprintNumber = json.sprintNumber
        } else if (json.type === 'velocity') {
          this.velocity = json.data
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
            this.tmpUsers[user.id] = user
          }

          return response
        }.bind(this))
        .then(function (response) {
          if (response.offset + response.limit < response.total_count) {
            return this.loadUsers(response.offset + response.limit)
          } else {
            this.users = this.tmpUsers
          }
        }.bind(this))
    },
    loadProjects (offset = 0) {
      let params = {
        offset: offset,
        limit: 100
      }

      return fetch(this.apiUrl + '/projects.json' + window.paramsToQuery(params), {mode: 'cors'})
        .then(function (response) {
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
          }
        }.bind(this))
    }
  },
  template: '<App :loadingCount="loadingCount" :issues="issues" :users="users" :projects="projects" :redmineConfig="redmineConfig" :velocity="velocity" />',
  components: {App}
})
