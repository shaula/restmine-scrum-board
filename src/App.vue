<template>
  <div id="app" v-cloak>
    <div id="tabs" class="c-tabs no-js">
      <ul class="c-tabs-nav">
        <li>
          <a href="#" class="c-tabs-nav__link disabled">
            <h1 class="sprint" @click="changeCurrentSprint">
              Sprint&nbsp;#{{ redmineConfig.sprintNumber }}
            </h1>
            <span class="status link" :class="'status-' + status" @click="reload" title="Click to reload">{{ status }}</span>
          </a>
        </li>
        <li class="with-settings is-active">
          <a href="#" class="c-tabs-nav__link">
            Issues
          </a>

          <span class="settings">
              <label><input type="radio" name="view" v-model="settings.view" value="default"> Default View</label>
              <label><input type="radio" name="view" v-model="settings.view" value="project"> Project View</label>
          </span>
        </li>
        <li>
          <a href="#" class="c-tabs-nav__link">Distribution</a>
        </li>
        <li>
          <a href="#" class="c-tabs-nav__link">Velocity</a>
        </li>
        <li>
          <a href="#" class="c-tabs-nav__link">Settings</a>
        </li>
      </ul>
      <div id="userListHandle" v-if="loadingCount == 0">
        <div id="userList">
          <UserList :headline="'Assignees'" :users="issueUsers" :inactiveUserIds="inactiveUserIds" />
        </div>
      </div>
      <div class="c-tab is-active">
        <div class="c-tab__content">
          <span v-show="loadingCount" class="icon icon-loader"></span>

          <div id="board" v-if="loadingCount == 0">
            <div id="head" class="row">
              <div v-for="column in redmineConfig.columns" class="column" :class="'column' + column.abbr" :key="column.abbr">
                <h3>
                  {{ column.name }}
                  <span class="issues-count">({{ issuesByStatuses(column.statuses).length }})</span>
                </h3>
              </div>
            </div>

            <DefaultSwimlane v-if="settings.view == 'default'"
                             :columns="redmineConfig.columns"
                             :issues="activeIssues"
                             :projectHierarchy="projectHierarchy"
                             :projects="projects"
                             :users="users" />

            <ProjectSwimlane v-if="settings.view == 'project'"
                             :columns="redmineConfig.columns"
                             :issues="activeIssues"
                             :projectHierarchy="projectHierarchy"
                             :projects="projects"
                             :users="users" />
          </div>
        </div>
      </div>
      <div class="c-tab">
        <div class="c-tab__content">
          <div id="stats">
            <TrackerSummary :issues="activeIssues" />
            <UserSummary :issues="activeIssues" :users="users" />
            <ProjectSummary :issues="activeIssues" :projects="projects" />
          </div>
        </div>
      </div>
      <div class="c-tab">
        <div class="c-tab__content">
          <VelocityHistory :velocity="velocity" />
        </div>
      </div>
      <div class="c-tab">
        <div class="c-tab__content">
          <div class="setting">
            <label>Sprint Number
              <input type="text" :value="redmineConfig.sprintNumber" @change="sprintNumberChange">
            </label>
          </div>
          <div class="setting">
            <label>Cache
              <button @click="invalidateCache" title="remove projects and users from cache">invalidate</button>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
  [v-cloak] {
    display: none
  }

  #app {
    font-family: 'Avenir', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
  }

  #app header {
    display: flex;
    align-items: center;
  }

  h1 {
    margin: 0 0 0 20px;
    font-size: 26px;
  }

  h1, h2 {
    text-align: left;
  }

  h1.sprint {
    text-align: center;
  }

  h3 {
    margin: 0;
  }

  .status-offline {
    color: darkred
  }

  .status-online {
    color: darkgreen;
  }

  .icon-loader {
    display: block;
    height: 24px;
    background: url(data:image/gif;base64,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) no-repeat center;
  }

  .row,
  #stats {
    display: flex;
    overflow: hidden;
  }

  .row .column {
    flex: 1 20%;
    max-width: 20%;
    margin: 0 1%;
  }

  #stats {
    flex: 1;
  }

  .issues-count {
    display: blocK;
  }

  .summary td,
  .summary th {
    text-align: right;
    padding: 0 4px;
  }

  .summary thead th:first-child {
    text-align: left
  }

  .summary tr td:first-child {
    /*padding-left: 0;*/
  }

  .summary tr td:last-child {
    /*padding-right: 0;*/
  }

  .summary thead,
  .summary tfoot {
    background-color: lightblue;
  }

  .summary tbody tr:nth-child(even) {
    background-color: #dbdbdb
  }

  .summary tbody tr:hover {
    background-color: #f3eacf
  }

  .link {
    cursor: pointer;
  }

  /**
   * Tab CSS
   */
  ul.c-tabs-nav {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .c-tabs-nav li {
    flex: 1;
    border: 1px solid transparent;
    border-radius: 6px 6px 0 0;
  }

  .c-tabs-nav li.is-active {
    margin-bottom: -1px;
    color: #555;
    cursor: default;
    background-color: #fff;
    border: 1px solid #ddd;
    border-bottom-color: transparent;
    font-weight: bold;
  }

  .c-tabs-nav__link.disabled {
    color: #333;
  }

  .c-tabs-nav__link {
    display: inline-block;
    width: 100%;
    height: 102%;
    line-height: 2em;
    vertical-align: middle;
    text-align: center;
    transition: color 0.3s;
    margin-right: 4px;
    text-decoration: none;
    outline: 0;
    color: rgb(66, 139, 202);
    font-size: 18px;
    border-radius: 6px 6px 0 0;
  }

  .c-tabs-nav__link:last-child {
    margin-right: 0;
  }

  .c-tabs-nav__link:hover {
    background-color: #dddddd;
  }

  li:last-child .c-tabs-nav__link:hover {
    border-bottom-right-radius: 4px;
  }

  li:first-child .c-tabs-nav__link:hover,
  li.is-active .c-tabs-nav__link:hover {
    background-color: transparent;
  }

  .is-active .c-tabs-nav__link:last-child:hover {
    border-bottom-right-radius: 0;
  }

  .c-tabs-nav__link i,
  .c-tabs-nav__link span {
    margin: 0;
    padding: 0;
    line-height: 1;
  }

  .c-tabs-nav__link i {
    font-size: 18px;
  }

  .c-tabs-nav__link span {
    display: none;
    font-size: 18px;
  }

  @media all and (min-width: 720px) {
    .c-tabs-nav__link i {
      margin-bottom: 12px;
      font-size: 22px;
    }

    .c-tabs-nav__link span {
      display: block;
    }
  }

  .c-tab {
    display: none;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 10px 10px 10px 20px;
    overflow: hidden;
  }

  .c-tab.is-active {
    display: block;
  }

  /* get rid */
  .c-tab:last-child.is-active {
    border-top-right-radius: 0;
  }

  .with-settings {
    display: flex;
  }

  .with-settings .c-tabs-nav__link,
  .with-settings .settings {
    flex: 1;
    justify-content: center;
  }

  .settings {
    font-weight: normal;
    text-align: left;
  }

  .settings label {
    border-radius: 6px;
    cursor: pointer;
    margin: 2px 0;
    display: block;
  }

  .with-settings .settings {
    color: #aaa;
  }

  .with-settings.is-active .settings {
    color: #333;
  }

  #userListHandle {
    width: 25px;
    overflow: hidden;
    position: fixed;
    top: 140px;
    left: 9px;
    background-color: rgb(66, 139, 202);
    color: white;
    border: 1px solid rgb(66, 139, 202);
    border-radius: 0 10px 10px 0;
    z-index: 100;
    max-height: 80%;
  }
  #userListHandle,
  #userListHandle .headline {
    height: 100px;
  }
  #userListHandle .headline {
    transform: rotate(-90deg);
    width: 100px;
  }
  #userListHandle .hasInactive .headline {
    color: #ffb6d7;
  }
  #userListHandle:hover {
    width: auto;
    height: auto;
    overflow-y: auto;
  }
  #userListHandle:hover .headline {
    margin: 0;
    transform: inherit;
    width: 100%;
    height: auto;
  }
  #userListHandle:hover .user:hover {
    border-color: darkblue;
  }
  .setting {
    margin: 10px;
  }
</style>

<script>
  import Avatar from './components/Avatar'
  import TrackerSummary from './components/TrackerSummary'
  import UserList from './components/UserList'
  import UserSummary from './components/UserSummary'
  import VelocityHistory from './components/VelocityHistory'
  import ProjectSummary from './components/ProjectSummary'
  import DefaultSwimlane from './components/DefaultSwimlane'
  import ProjectSwimlane from './components/ProjectSwimlane'

  /**
   * Tab JS
   */
  (function () {
    'use strict'

    /**
     * tabs
     *
     * @description The Tabs component.
     * @param {Object} options The options hash
     */
    var tabs = function (options) {
      var el = document.querySelector(options.el)

      var tabNavigationLinks = el.querySelectorAll(options.tabNavigationLinks)
      var tabContentContainers = el.querySelectorAll(options.tabContentContainers)
      var activeIndex = 0
      var initCalled = false

      /**
       * init
       *
       * @description Initializes the component by removing the no-js class from
       *   the component, and attaching event listeners to each of the nav items.
       *   Returns nothing.
       */
      var init = function () {
        if (!initCalled) {
          initCalled = true
          el.classList.remove('no-js')

          for (var i = 0; i < tabNavigationLinks.length; i++) {
            var link = tabNavigationLinks[i]
            handleClick(link, i)
          }
        }
      }

      /**
       * handleClick
       *
       * @description Handles click event listeners on each of the links in the
       *   tab navigation. Returns nothing.
       * @param {HTMLElement} link The link to listen for events on
       * @param {Number} index The index of that link
       */
      var handleClick = function (link, index) {
        link.addEventListener('click', function (e) {
          e.preventDefault()
          goToTab(index)
        })
      }

      /**
       * goToTab
       *
       * @description Goes to a specific tab based on index. Returns nothing.
       * @param {Number} index The index of the tab to go to
       */
      var goToTab = function (index) {
        if (index !== activeIndex && index >= 0 && index <= tabNavigationLinks.length) {
          tabNavigationLinks[activeIndex].parentNode.classList.remove('is-active')
          tabNavigationLinks[index].parentNode.classList.add('is-active')
          tabContentContainers[activeIndex].classList.remove('is-active')
          tabContentContainers[index].classList.add('is-active')
          activeIndex = index
        }
      }

      /**
       * Returns init and goToTab
       */
      return {
        init: init,
        goToTab: goToTab
      }
    }

    /**
     * Attach to global namespace
     */
    window.tabs = tabs
  })()

  export default {
    name: 'app',
    props: ['loadingCount', 'issues', 'projects', 'redmineConfig', 'status', 'users', 'velocity'],
    data () {
      return {
        settings: {
          view: 'default'
        },
        inactiveUserIds: []
      }
    },
    created () {
      this.bus.$on('toggleUserSelection', function (idsOrId) {
        let ids = []
        if (idsOrId instanceof Array) {
          ids = idsOrId
        } else {
          ids.push(parseInt(idsOrId))
        }

        for (let idsIndex in ids) {
          let id = ids[idsIndex]
          const index = this.inactiveUserIds.indexOf(id)
          if (index === -1) {
            this.inactiveUserIds.push(id)
          } else {
            this.inactiveUserIds.splice(index, 1)
          }
        }
      }.bind(this))

      this.bus.$on('loaded', function (type) {
        if (type === 'websocket' && !this.redmineConfig.sprintNumber) {
          window.setTimeout(this.changeCurrentSprint)
        }
      }.bind(this))
    },
    mounted () {
      const myTabs = window.tabs({
        el: '#tabs',
        tabNavigationLinks: '.c-tabs-nav__link:not(.disabled)',
        tabContentContainers: '.c-tab'
      })
      myTabs.init()
    },
    computed: {
      /**
       * Returns root
       */
      projectHierarchy () {
        if (!Object.keys(this.projects).length || !Object.keys(this.issues).length) {
          console.log('Waiting for projects & issues')
          return {}
        }

        let data = {}
        let hierarchy = {}

        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            let issue = this.issues[index]
            let dataKey = issue.project.id

            if (!data.hasOwnProperty(dataKey)) {
              this.addProject(issue.project.id, data, hierarchy)
            }
          }
        }

        if (!hierarchy.hasOwnProperty('subProjects')) {
          // introduce virtual root to leverage sorting
          hierarchy = {
            id: 0,
            name: 'All Projects',
            subProjects: hierarchy
          }
        }

        // sort projects
        this.sortProjectHierarchy(hierarchy)

        return hierarchy
      },
      issueUsers () {
        if (!Object.keys(this.projects).length || !Object.keys(this.issues).length) {
          console.log('Waiting for projects & issues')
          return {}
        }

        let users = {}

        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            let issue = this.issues[index]

            if (issue.assigned_to) {
              let userId = issue.assigned_to.id
              users[userId] = this.users[userId]
            } else {
              users[0] = {
                id: 0,
                login: '--',
              }
            }
          }
        }

        return users
      },
      activeUserIds () {
        if (!Object.keys(this.issueUsers).length) {
          console.log('Waiting for issueUsers')
          return []
        }

        const activeUserIds = []
        for (let id in this.issueUsers) {
          if (this.issueUsers.hasOwnProperty(id)) {
            id = parseInt(id)
            if (this.inactiveUserIds.indexOf(id) === -1) {
              activeUserIds.push(id)
            }
          }
        }

        return activeUserIds
      },
      activeIssues () {
        const activeIssues = {}
        for (let id in this.issues) {
          if (this.issues.hasOwnProperty(id)) {
            const assigneeId = this.issues[id].assigned_to ? this.issues[id].assigned_to.id : 0
            if (this.activeUserIds.indexOf(assigneeId) !== -1) {
              activeIssues[id] = this.issues[id]
            }
          }
        }
        return activeIssues
      }
    },
    methods: {
      changeCurrentSprint: function () {
        const sprintNumber = window.prompt('Please enter the current sprint number', this.redmineConfig.sprintNumber ? this.redmineConfig.sprintNumber : '')
        if (sprintNumber) {
          this.bus.$emit('sprintNumberChange', sprintNumber)
        }
      },
      issuesByStatuses (statuses) {
        let data = []
        for (let index in this.activeIssues) {
          if (this.activeIssues.hasOwnProperty(index)) {
            if (statuses.indexOf(this.issues[index].status.name) > -1) {
              data.push(this.issues[index])
            }
          }
        }
        return data
      },
      /**
       * Recursive method.
       *
       * @param {number} projectId
       * @param {Object<number, {id: number, name: string, subProjects: Object}>} flatData
       * @param {Object<number, {id: number, name: string, subProjects: Object}>} hierarchyData
       * @param {{id: number, name: string, subProjects: Object}|null} subProject
       */
      addProject (projectId, flatData, hierarchyData, subProject = null) {
        let project = this.projects[projectId]
        flatData[project.id] = flatData[projectId] ||
          {
            id: project.id,
            name: project.name, // used for sorting
            parentId: project.parent ? project.parent.id : null,
            subProjects: {}
          }

        if (subProject) {
          flatData[project.id].subProjects[subProject.id] = subProject
        }

        if (project.parent) {
          this.addProject(project.parent.id, flatData, hierarchyData, flatData[project.id])
        } else {
          // is a root - add to hierarchy
          hierarchyData[project.id] = flatData[project.id]
        }
      },
      /**
       * Recursive method.
       *
       * @param {{id: number, name: string, subProjects: Object}} hierarchy
       */
      sortProjectHierarchy (hierarchy) {
        hierarchy.subProjects = Object.values(hierarchy.subProjects)
        hierarchy.subProjects.sort(function (a, b) {
          return String(a.name).localeCompare(b.name)
        })

        for (let index in hierarchy.subProjects) {
          if (hierarchy.subProjects.hasOwnProperty(index)) {
            let subProject = hierarchy.subProjects[index]
            this.sortProjectHierarchy(subProject)
          }
        }
      },
      sprintNumberChange (evt) {
        this.bus.$emit('sprintNumberChange', evt.target.value)
      },
      invalidateCache () {
        window.localStorage.clear()
      },
      reload () {
        location.reload()
      },
    },
    components: {
      Avatar,
      DefaultSwimlane,
      ProjectSummary,
      ProjectSwimlane,
      TrackerSummary,
      UserList,
      UserSummary,
      VelocityHistory
    }
  }
</script>
