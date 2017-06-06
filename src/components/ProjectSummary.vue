<template>
    <table id="projectSummary" class="summary">
        <thead>
        <tr>
            <th>Issues by Project</th>
            <th>Type</th>
            <th>#</th>
            <th>SP</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="projectEntry in projectSummary" :key="projectEntry.projectId">
            <td :title="projectEntry.projectBreadcrumb">
                {{ projectEntry.projectPrefix }}
                <span class="project" :project="'project' + projectEntry.projectId" @click="bus.$emit('projectClick', projectEntry.projectId)">
                    {{ projectEntry.projectName }}
                </span>
            </td>

            <td>
                <div v-for="issuesByTracker in projectEntry.issuesByTracker" :key="issuesByTracker.trackerName">
                    {{ issuesByTracker.trackerName }}
                </div>
            </td>

            <td>
                <div v-for="issuesByTracker in projectEntry.issuesByTracker" :key="issuesByTracker.trackerName">
                    {{ issuesByTracker.issues.length }}
                </div>
            </td>

            <td>
                <div v-for="issuesByTracker in projectEntry.issuesByTracker" :key="issuesByTracker.trackerName">
                    {{ estimationFrom(issuesByTracker.issues) }}
                </div>
            </td>
        </tr>
        </tbody>
        <tfoot>
        <tr>
            <th>Total</th>
            <th></th>
            <th>{{ issuesLength }}</th>
            <th>{{ estimationFrom(issues)}}</th>
        </tr>
        </tfoot>
    </table>
</template>

<script>
  import { estimationFrom } from '../helpers'

  export default {
    name: 'ProjectSummary',
    props: ['issues', 'projects'],
    computed: {
      projectSummary () {
        if (!Object.keys(this.projects).length) {
          console.log('Waiting for projects')
          return {}
        }

        let data = {}

        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            let issue = this.issues[index]
            let dataKey = issue.project.id

            if (!data.hasOwnProperty(dataKey)) {
              this.addProject(issue.project.id, data)
            }

            if (!data[dataKey].issuesByTracker.hasOwnProperty(issue.tracker.id)) {
              data[dataKey].issuesByTracker[issue.tracker.id] = {
                trackerId: issue.tracker.id,
                trackerName: issue.tracker.name,
                issues: []
              }
            }

            data[dataKey].issuesByTracker[issue.tracker.id].issues.push(issue)
          }
        }

        // sort by project names
        data = Object.values(data).sort(function (a, b) {
          return String(a.projectBreadcrumb + a.projectName).localeCompare(b.projectBreadcrumb + b.projectName)
        })

        // sort by tracker names
        data.forEach(function (projectEntry) {
          projectEntry.issuesByTracker = Object.values(projectEntry.issuesByTracker).sort(function (a, b) {
            return String(a.trackerName).localeCompare(b.trackerName)
          })
        })

        return data
      },
      issuesLength () {
        return Object.keys(this.issues).length
      },
      maxProjectDepth () {
        let maxDepth = 0
        for (let index in this.projects) {
          if (this.projects.hasOwnProperty(index)) {
            let project = this.projects[index]
            let depth = 0
            while (project && project.parent) {
              depth++
              project = this.projects[project.parent.id]
            }
            maxDepth = Math.max(maxDepth, depth)
          }
        }
        return maxDepth
      }
    },
    methods: {
      estimationFrom: estimationFrom,
      projectBreadcrumbOf (projectId, separator = ' --> ') {
        if (!Object.keys(this.projects).length) {
          console.log('Waiting for projects')
          return ''
        } else if (!projectId) {
          return '-'
        } else if (!this.projects[projectId]) {
          return '-'
        }

        let breadcrumb = []
        let project = this.projects[projectId]
        while (project.parent) {
          project = this.projects[project.parent.id]
          breadcrumb.push(project.name)
        }
        return breadcrumb.reverse().join(separator) + (breadcrumb.length ? separator : '')
      },
      projectLevelOf (projectId) {
        if (!Object.keys(this.projects).length) {
          console.log('Waiting for projects')
          return ''
        }

        let depth = 0
        let project = this.projects[projectId]
        while (project.parent) {
          project = this.projects[project.parent.id]
          depth++
        }
        return depth
      },
      addProject (projectId, data, level = 0) {
        const indention = 3

        let project = this.projects[projectId]
        let depth = this.projectLevelOf(project.id)
        data[project.id] = {
          projectId: project.id,
          projectBreadcrumb: this.projectBreadcrumbOf(project.id, ' → '),
          projectLevel: depth,
          projectPrefix: project.parent ? new Array(depth * indention).join('\u00A0').concat('↳') : '',
          projectName: project.name,
          issuesByTracker: {}
        }
        if (project.parent) {
          this.addProject(project.parent.id, data, level + 1)
        }
      }
    },
    data () {
      return {
        levelByProject: {}
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
    #projectSummary thead td:first-child,
    #projectSummary tbody td:first-child{
        text-align: left;
    }
</style>
