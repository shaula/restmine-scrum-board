<template>
    <table id="userSummary" class="summary">
        <thead>
        <tr>
            <th>Issues by User</th>
            <th>Type</th>
            <th>#</th>
            <th>SP</th>
            <th>Done</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="userEntry in userSummary" :key="userEntry.userId" :class="'user' + userEntry.userId">
            <td :title="userEntry.lastLogin">
                {{ userEntry.displayName }}
            </td>

            <td>
                <div v-for="issuesByTracker in userEntry.issuesByTracker" :key="issuesByTracker.trackerName">
                    {{ issuesByTracker.trackerName }}
                </div>
            </td>

            <td>
                <div v-for="issuesByTracker in userEntry.issuesByTracker" :key="issuesByTracker.trackerName">
                    {{ issuesByTracker.issues.length }}
                </div>
            </td>

            <td>
                <div v-for="issuesByTracker in userEntry.issuesByTracker" :key="issuesByTracker.trackerName"
                     v-html="estimationFrom(issuesByTracker.issues)"></div>
            </td>

            <td>
                <div v-for="issuesByTracker in userEntry.issuesByTracker" :key="issuesByTracker.trackerName"
                     v-html="doneRatioFrom(issuesByTracker.issues)"></div>
            </td>
        </tr>
        </tbody>
        <tfoot>
        <tr>
            <th>Total</th>
            <th></th>
            <th>{{ issuesLength }}</th>
            <th v-html="estimationFrom(issues)"></th>
            <th v-html="doneRatioFrom(issues)"></th>
        </tr>
        </tfoot>
    </table>
</template>

<style scoped>

</style>

<script>
  import { leftOfEstimationFrom, doneRatioFrom, estimationFrom} from '../helpers';

  export default {
    name: 'UserSummary',
    props: ['issues', 'users'],
    computed: {
      userSummary () {
        if (!Object.keys(this.users).length) {
          console.log('Waiting for users')
          return {}
        }

        let data = {}

        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            let issue = this.issues[index]
            let dataKey = issue.assigned_to ? issue.assigned_to.id : -1

            if (!data.hasOwnProperty(dataKey)) {
              data[dataKey] = {
                userId: issue.assigned_to ? issue.assigned_to.id : -1,
                displayName: dataKey > -1 ? this.users[issue.assigned_to.id].displayName : '- unassigned -',
                issuesByTracker: {}
              }
            }

            if (!data[dataKey].issuesByTracker.hasOwnProperty(issue.tracker.id)) {
              data[dataKey].issuesByTracker[issue.tracker.id] = {
                trackerId: issue.tracker.id,
                trackerName: issue.tracker.name,
                issues: []
              }
            }

            if (data[dataKey].issuesByTracker[issue.tracker.id].issues.indexOf(issue) === -1) {
							data[dataKey].issuesByTracker[issue.tracker.id].issues.push(issue)
						}
          }
        }

        // sort by user names
        data = Object.values(data).sort(function (a, b) {
          return String(a.userName).localeCompare(b.userName)
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
      }
    },
    methods: {
			doneRatioFrom (issues) {
				return doneRatioFrom(issues) + '%'
			},
			estimationFrom: estimationFrom,
			leftOfEstimationFrom: leftOfEstimationFrom
    },
    data () {
      return {}
    }
  }
</script>
