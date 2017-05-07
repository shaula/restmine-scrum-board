<template>
    <table id="trackerSummary" class="summary">
        <thead>
        <tr>
            <th>Issues by Tracker</th>
            <th>#</th>
            <th>SP</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="trackerEntry in trackerSummary" :class="'tracker' + trackerEntry.trackerId">
            <td>{{ trackerEntry.trackerName }}</td>
            <td>{{ trackerEntry.issues.length }}</td>
            <td>{{ estimationFrom(trackerEntry.issues) }}</td>
        </tr>
        </tbody>
        <tfoot>
        <tr>
            <th>Total</th>
            <th>{{ issuesLength }}</th>
            <th>{{ estimationFrom(issues) }}</th>
        </tr>
        </tfoot>
    </table>
</template>

<style scoped>

</style>

<script>
  import { estimationFrom } from '../helpers'

  export default {
    name: 'TrackerSummary',
    props: ['issues'],
    computed: {
      trackerSummary () {
        let data = {}

        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            let issue = this.issues[index]
            let dataKey = issue.tracker.id

            if (!data.hasOwnProperty(dataKey)) {
              data[dataKey] = {
                trackerId: issue.tracker.id,
                trackerName: issue.tracker.name,
                issues: []
              }
            }

            data[dataKey].issues.push(issue)
          }
        }

        // sort by tracker names
        data = Object.values(data).sort(function (a, b) {
          return String(a.trackerName).localeCompare(b.trackerName)
        })

        return data
      },
      issuesLength () {
        return Object.keys(this.issues).length
      }
    },
    methods: {
      estimationFrom: estimationFrom
    },
    data () {
      return {}
    }
  }
</script>
